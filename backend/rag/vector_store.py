import os
import re
import json
import math
import logging
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun, AsyncCallbackManagerForRetrieverRun
from config import config

logger = logging.getLogger("rag.vector_store")

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage")
DOCS_STORAGE_DIR = os.path.join(STORAGE_DIR, "documents")
REGISTRY_FILE = os.path.join(STORAGE_DIR, "documents_registry.json")

os.makedirs(DOCS_STORAGE_DIR, exist_ok=True)


# =========================================================================
# 1. Fast Embeddings with Ollama Support & Caching
# =========================================================================
class FastLocalEmbeddings(Embeddings):
    def __init__(self, model_name: str = "nomic-embed-text", base_url: Optional[str] = None):
        self.model_name = model_name
        self.base_url = base_url or config.ollama_base_url
        self._model = None
        self._is_ollama = "nomic" in model_name.lower() or "bge" in model_name.lower() or "mxbai" in model_name.lower() or "arctic" in model_name.lower()
        self._cache: Dict[str, List[float]] = {}

    @property
    def model(self):
        if self._model is None:
            # Try Ollama embeddings first if configured or requested
            if self._is_ollama:
                try:
                    from langchain_ollama import OllamaEmbeddings
                    self._model = OllamaEmbeddings(
                        model=self.model_name,
                        base_url=self.base_url
                    )
                    logger.info(f"Initialized Ollama embeddings using model '{self.model_name}' at {self.base_url}.")
                    return self._model
                except Exception as e:
                    logger.warning(f"Could not initialize OllamaEmbeddings ({e}). Trying sentence-transformers...")
            
            try:
                import importlib
                st = importlib.import_module("sentence_transformers")
                SentenceTransformer = getattr(st, "SentenceTransformer")
                fallback_name = "all-MiniLM-L6-v2" if self._is_ollama else self.model_name
                self._model = SentenceTransformer(fallback_name)
                logger.info(f"Initialized SentenceTransformer embeddings with '{fallback_name}'.")
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ({e}). Using algorithmic fallback embeddings.")
                self._model = "fallback"
        return self._model

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        m = self.model
        if hasattr(m, "embed_documents"):
            return m.embed_documents(texts)
        if hasattr(m, "encode"):
            embeddings = m.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return embeddings.tolist()
        return [self._fallback_embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        if text in self._cache:
            return self._cache[text]
        m = self.model
        if hasattr(m, "embed_query"):
            vec = m.embed_query(text)
        elif hasattr(m, "encode"):
            embedding = m.encode(text, normalize_embeddings=True, show_progress_bar=False)
            vec = embedding.tolist()
        else:
            vec = self._fallback_embed(text)
        
        # Cache query vector (up to 1000 items)
        if len(self._cache) > 1000:
            self._cache.clear()
        self._cache[text] = vec
        return vec

    def _fallback_embed(self, text: str) -> List[float]:
        import hashlib
        vec = []
        for i in range(768 if self._is_ollama else 384):
            val = int(hashlib.md5(f"{text}_{i}".encode()).hexdigest()[:6], 16) / 0xFFFFFF
            vec.append(val)
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]


# =========================================================================
# 2. BM25 Lexical Keyword Index
# =========================================================================
class BM25Index:
    """
    Self-contained, lightning-fast BM25Okapi implementation for lexical keyword search.
    Provides exact term matching for names, codes, acronyms, and technical terms.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.documents: List[Document] = []
        self.corpus_size = 0
        self.avgdl = 0.0
        self.doc_lengths: List[int] = []
        self.doc_freqs: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.tokenized_corpus: List[List[str]] = []

    def _tokenize(self, text: str) -> List[str]:
        # Lowercase, alphanumeric words, strip punctuation
        tokens = re.findall(r'\b[a-zA-Z0-9_\-\.]{2,}\b', text.lower())
        return tokens

    def fit(self, documents: List[Document]):
        self.documents = documents
        self.corpus_size = len(documents)
        if self.corpus_size == 0:
            return

        self.tokenized_corpus = [self._tokenize(doc.page_content) for doc in documents]
        self.doc_lengths = [len(doc) for doc in self.tokenized_corpus]
        self.avgdl = sum(self.doc_lengths) / self.corpus_size if self.corpus_size > 0 else 0.0

        # Calculate document frequencies
        self.doc_freqs = {}
        for tokens in self.tokenized_corpus:
            seen = set(tokens)
            for token in seen:
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

        # Calculate IDF with floor to prevent negative scores
        self.idf = {}
        for token, freq in self.doc_freqs.items():
            # Standard Lucene/BM25 IDF formula
            idf_val = math.log(1 + (self.corpus_size - freq + 0.5) / (freq + 0.5))
            self.idf[token] = max(idf_val, 0.01)

    def search(self, query: str, k: int = 10) -> List[Tuple[Document, float]]:
        if self.corpus_size == 0:
            return []
        
        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []

        scores = np.zeros(self.corpus_size, dtype=np.float32)
        for token in q_tokens:
            if token not in self.idf:
                continue
            idf_val = self.idf[token]
            for i, doc_tokens in enumerate(self.tokenized_corpus):
                tf = doc_tokens.count(token)
                if tf > 0:
                    denom = tf + self.k1 * (1 - self.b + self.b * (self.doc_lengths[i] / (self.avgdl or 1.0)))
                    scores[i] += idf_val * (tf * (self.k1 + 1)) / denom

        top_indices = np.argsort(scores)[::-1]
        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score > 0.0:
                results.append((self.documents[idx], score))
            if len(results) >= k:
                break
        return results


# =========================================================================
# 3. Fast Vector Store with NumPy Acceleration
# =========================================================================
class SimpleMemoryVectorStore:
    """High-speed in-memory vector store with NumPy matrix operations."""
    def __init__(self, embedding: Embeddings):
        self.embedding = embedding
        self.docs: List[Document] = []
        self.matrix: Optional[np.ndarray] = None

    def add_documents(self, documents: List[Document]):
        if not documents:
            return
        texts = [doc.page_content for doc in documents]
        vectors = np.array(self.embedding.embed_documents(texts), dtype=np.float32)
        
        self.docs.extend(documents)
        if self.matrix is None:
            self.matrix = vectors
        else:
            self.matrix = np.vstack([self.matrix, vectors])

    def similarity_search_with_score(self, query: str, k: int = 10) -> List[Tuple[Document, float]]:
        if not self.docs or self.matrix is None or len(self.matrix) == 0:
            return []
        
        q_vec = np.array(self.embedding.embed_query(query), dtype=np.float32)
        
        # Norms
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            q_norm = 1.0
        q_vec_unit = q_vec / q_norm

        matrix_norms = np.linalg.norm(self.matrix, axis=1, keepdims=True)
        matrix_norms[matrix_norms == 0] = 1.0
        matrix_unit = self.matrix / matrix_norms

        # Fast dot product cosine similarities
        cosine_scores = np.dot(matrix_unit, q_vec_unit)
        top_indices = np.argsort(cosine_scores)[::-1][:k]

        return [(self.docs[idx], float(cosine_scores[idx])) for idx in top_indices]

    def similarity_search(self, query: str, k: int = 10) -> List[Document]:
        scored = self.similarity_search_with_score(query, k=k)
        return [doc for doc, _ in scored]


# =========================================================================
# 4. Hybrid Retriever with Reciprocal Rank Fusion & Guardrails
# =========================================================================
class HybridRetriever(BaseRetriever):
    """
    State-of-the-art Hybrid Retriever combining:
    1. Dense Vector Search (semantic similarity)
    2. BM25 Lexical Keyword Search (exact keyword/term matching)
    3. Reciprocal Rank Fusion (RRF) for optimal score merging
    4. Similarity Thresholding Guardrails to discard low-confidence noise.
    """
    vector_store: Any
    bm25_index: BM25Index
    k: int = 4
    dense_weight: float = 0.7
    bm25_weight: float = 0.3
    similarity_threshold: float = 0.35
    rrf_k: int = 60

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        return self._retrieve_hybrid(query)

    async def _aget_relevant_documents(
        self, query: str, *, run_manager: AsyncCallbackManagerForRetrieverRun
    ) -> List[Document]:
        return self._retrieve_hybrid(query)

    def _retrieve_hybrid(self, query: str) -> List[Document]:
        # 1. Retrieve Dense Candidates (fetch top 20 candidates for fusion)
        dense_candidates: List[Tuple[Document, float]] = []
        try:
            if hasattr(self.vector_store, "similarity_search_with_score"):
                dense_candidates = self.vector_store.similarity_search_with_score(query, k=20)
            elif hasattr(self.vector_store, "similarity_search"):
                docs = self.vector_store.similarity_search(query, k=20)
                dense_candidates = [(d, 1.0 - (i * 0.03)) for i, d in enumerate(docs)]
        except Exception as e:
            logger.warning(f"Dense vector retrieval notice: {e}")

        # 2. Retrieve BM25 Lexical Candidates
        bm25_candidates: List[Tuple[Document, float]] = self.bm25_index.search(query, k=20)

        # If no documents at all, return empty
        if not dense_candidates and not bm25_candidates:
            return []

        # 3. Reciprocal Rank Fusion (RRF) Scoring
        doc_scores: Dict[str, Dict[str, Any]] = {}

        # Process Dense rankings
        for rank, (doc, sim_score) in enumerate(dense_candidates):
            key = f"{doc.metadata.get('source', '')}_{doc.metadata.get('chunk_index', rank)}_{doc.page_content[:60]}"
            if key not in doc_scores:
                doc_scores[key] = {
                    "doc": doc,
                    "rrf_score": 0.0,
                    "dense_score": sim_score,
                    "bm25_score": 0.0
                }
            doc_scores[key]["rrf_score"] += self.dense_weight * (1.0 / (self.rrf_k + rank + 1))
            doc_scores[key]["dense_score"] = sim_score

        # Process BM25 rankings
        for rank, (doc, bm25_score) in enumerate(bm25_candidates):
            key = f"{doc.metadata.get('source', '')}_{doc.metadata.get('chunk_index', rank)}_{doc.page_content[:60]}"
            if key not in doc_scores:
                doc_scores[key] = {
                    "doc": doc,
                    "rrf_score": 0.0,
                    "dense_score": 0.0,
                    "bm25_score": bm25_score
                }
            doc_scores[key]["rrf_score"] += self.bm25_weight * (1.0 / (self.rrf_k + rank + 1))
            doc_scores[key]["bm25_score"] = bm25_score

        # 4. Sort candidates by RRF score
        sorted_results = sorted(doc_scores.values(), key=lambda x: x["rrf_score"], reverse=True)

        # 5. Apply Similarity Threshold Guardrail
        filtered_docs: List[Document] = []
        for item in sorted_results:
            doc = item["doc"]
            dense_s = item["dense_score"]
            bm25_s = item["bm25_score"]

            # Store similarity metadata directly on doc for citation scoring & UI display
            doc.metadata["similarity_score"] = round(dense_s, 3)
            doc.metadata["bm25_score"] = round(bm25_s, 3)
            doc.metadata["rrf_score"] = round(item["rrf_score"], 4)

            # Accept document if either dense similarity meets threshold OR strong BM25 keyword match occurred
            if dense_s >= self.similarity_threshold or bm25_s > 0.5:
                filtered_docs.append(doc)
            
            if len(filtered_docs) >= self.k:
                break

        # If strict threshold filtered everything out but we have non-zero results, allow best 1 chunk if not garbage
        if not filtered_docs and sorted_results and sorted_results[0]["dense_score"] > 0.20:
            filtered_docs.append(sorted_results[0]["doc"])

        return filtered_docs


# =========================================================================
# 5. Vector Store Manager
# =========================================================================
class VectorStoreManager:
    """
    Enterprise Vector Store Manager combining:
    - Hybrid Search (Dense Vectors + BM25)
    - Fast In-Memory caching & persistent disk backing
    - MongoDB Atlas support with instant fallback
    """
    def __init__(self):
        self.embeddings = FastLocalEmbeddings(config.embedding_model_name)
        self.local_backup_store = SimpleMemoryVectorStore(self.embeddings)
        self.bm25_index = BM25Index()
        self.vector_store = None
        self.is_atlas = False
        self.local_docs: List[Document] = []
        self.doc_registry: Dict[str, Dict[str, Any]] = self._load_registry()
        self.initialize_store()

    def _load_registry(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(REGISTRY_FILE):
            try:
                with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not read registry: {e}")
        return {}

    def _save_registry(self):
        try:
            with open(REGISTRY_FILE, "w", encoding="utf-8") as f:
                json.dump(self.doc_registry, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save registry: {e}")

    def initialize_store(self, custom_mongodb_uri: Optional[str] = None):
        uri = custom_mongodb_uri or config.mongodb_uri
        if uri and "mongodb" in uri:
            try:
                import importlib
                import certifi
                pymongo = importlib.import_module("pymongo")
                lm = importlib.import_module("langchain_mongodb")
                MongoDBAtlasVectorSearch = getattr(lm, "MongoDBAtlasVectorSearch")
                
                client = pymongo.MongoClient(
                    uri,
                    serverSelectionTimeoutMS=1000,
                    connectTimeoutMS=1000,
                    tls=True,
                    tlsCAFile=certifi.where(),
                    tlsAllowInvalidCertificates=True
                )
                client.admin.command('ping')
                
                db = client[config.mongodb_db_name]
                collection = db[config.mongodb_collection_name]
                
                self.vector_store = MongoDBAtlasVectorSearch(
                    collection=collection,
                    embedding=self.embeddings,
                    index_name=config.mongodb_index_name,
                    text_key="text",
                    embedding_key="embedding"
                )
                self.is_atlas = True
                logger.info("Successfully connected to MongoDB Atlas Vector Search.")
                return
            except Exception as e:
                logger.warning(f"MongoDB Atlas connection notice: {e}. Using local hybrid vector store.")
        
        # Local fallback in-memory store
        self._init_local_store()

    def _init_local_store(self):
        self.vector_store = self.local_backup_store
        self.is_atlas = False
        logger.info("Initialized local high-performance hybrid vector store.")

    def add_documents(self, documents: List[Document], source_metadata: Optional[Dict[str, Any]] = None) -> int:
        if not documents:
            return 0
        
        # 1. Add to active store (MongoDB Atlas if available)
        if self.is_atlas and self.vector_store:
            try:
                self.vector_store.add_documents(documents)
            except Exception as e:
                logger.warning(f"Notice adding to MongoDB Atlas: {e}")

        # 2. Add to local memory store & document list
        self.local_backup_store.add_documents(documents)
        self.local_docs.extend(documents)

        # 3. Fit BM25 lexical index on all cumulative documents
        self.bm25_index.fit(self.local_docs)

        # 4. Update registry if metadata provided
        if source_metadata and "source" in source_metadata:
            src = source_metadata["source"]
            self.doc_registry[src] = {
                "source": src,
                "chunks": len(documents),
                "type": source_metadata.get("file_type", "document"),
                "size": source_metadata.get("file_size", 0),
                "created_at": source_metadata.get("created_at", "")
            }
            self._save_registry()

        return len(documents)

    def get_retriever(
        self,
        k: int = 4,
        similarity_threshold: float = 0.35,
        dense_weight: float = 0.7,
        bm25_weight: float = 0.3
    ) -> BaseRetriever:
        """Returns a configured HybridRetriever with BM25 fusion and similarity threshold guardrails."""
        target_vector_store = self.vector_store if self.is_atlas and self.vector_store else self.local_backup_store
        return HybridRetriever(
            vector_store=target_vector_store,
            bm25_index=self.bm25_index,
            k=k,
            similarity_threshold=similarity_threshold,
            dense_weight=dense_weight,
            bm25_weight=bm25_weight
        )

    def list_documents_metadata(self) -> List[Dict[str, Any]]:
        sources: Dict[str, Dict[str, Any]] = dict(self.doc_registry)
        for doc in self.local_docs:
            src = doc.metadata.get("source", "unknown")
            if src not in sources:
                sources[src] = {
                    "source": src,
                    "chunks": 0,
                    "type": doc.metadata.get("file_type", "TXT"),
                    "size": doc.metadata.get("file_size", 0),
                    "created_at": doc.metadata.get("timestamp", "")
                }
            sources[src]["chunks"] = max(sources[src]["chunks"], doc.metadata.get("total_chunks", 1))
        return list(sources.values())


# Global Vector Store instance
vector_store_manager = VectorStoreManager()
