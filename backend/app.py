import os
import shutil
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from pydantic import BaseModel

from config import config
from rag.vector_store import vector_store_manager
from rag.ingestion import process_and_index_document, process_raw_text
from rag.chain import stream_rag_response

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("api.main")

STORAGE_DOCS_DIR = os.path.join(os.path.dirname(__file__), "storage", "documents")
os.makedirs(STORAGE_DOCS_DIR, exist_ok=True)

app = FastAPI(
    title="Personal AI Assistant RAG API",
    description="Enterprise RAG backend powered by LangChain LCEL, Groq, and MongoDB Atlas Vector Search",
    version="1.0.0"
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event: Ingest all persisted knowledge docs from storage
@app.on_event("startup")
async def startup_event():
    # If storage folder has no files yet, copy default sample doc
    sample_file = os.path.join(os.path.dirname(__file__), "sample_docs", "assistant_knowledge.txt")
    existing_files = os.listdir(STORAGE_DOCS_DIR)
    if not existing_files and os.path.exists(sample_file):
        dest = os.path.join(STORAGE_DOCS_DIR, "assistant_knowledge.txt")
        shutil.copy(sample_file, dest)
        existing_files = [ "assistant_knowledge.txt" ]

    total_chunks = 0
    for fname in os.listdir(STORAGE_DOCS_DIR):
        fpath = os.path.join(STORAGE_DOCS_DIR, fname)
        if os.path.isfile(fpath):
            try:
                count = process_and_index_document(fpath, fname)
                total_chunks += count
                logger.info(f"Loaded persistent document '{fname}' ({count} chunks).")
            except Exception as e:
                logger.warning(f"Error loading persistent document '{fname}': {e}")

    logger.info(f"Startup complete: {len(existing_files)} persistent document(s) loaded ({total_chunks} total vector chunks).")


# Request Models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatStreamRequest(BaseModel):
    query: str
    model_name: Optional[str] = "mistral:latest"
    temperature: Optional[float] = 0.2
    groq_api_key: Optional[str] = None
    mongodb_uri: Optional[str] = None
    custom_system_prompt: Optional[str] = None
    chat_history: Optional[List[ChatMessage]] = []

class TextIngestRequest(BaseModel):
    title: str
    content: str

class VerifySettingsRequest(BaseModel):
    groq_api_key: Optional[str] = None
    mongodb_uri: Optional[str] = None
    ollama_base_url: Optional[str] = None


@app.get("/api/health")
async def health_check():
    """Returns the operational status of the backend, vector store, and LLM configuration."""
    docs = vector_store_manager.list_documents_metadata()
    
    # Check Ollama connectivity
    ollama_active = False
    try:
        import urllib.request
        req = urllib.request.Request(f"{config.ollama_base_url}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                ollama_active = True
    except Exception:
        ollama_active = False

    return {
        "status": "healthy",
        "vector_store_type": "MongoDB Atlas Vector Search" if vector_store_manager.is_atlas else "High-Speed Local Vector Store",
        "is_atlas": vector_store_manager.is_atlas,
        "is_ollama_active": ollama_active,
        "ollama_base_url": config.ollama_base_url,
        "has_groq_key": bool(config.groq_api_key and len(config.groq_api_key.strip()) > 5),
        "default_model": config.default_model,
        "embedding_model": config.embedding_model_name,
        "total_documents": len(docs)
    }


@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatStreamRequest):
    """
    Streams the RAG response using Server-Sent Events (SSE).
    Returns citations and incremental text chunks.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if request.mongodb_uri and request.mongodb_uri != config.mongodb_uri:
        vector_store_manager.initialize_store(request.mongodb_uri)

    history_payload = [{"role": msg.role, "content": msg.content} for msg in request.chat_history] if request.chat_history else []

    generator = stream_rag_response(
        query=request.query,
        model_name=request.model_name,
        temperature=request.temperature,
        groq_api_key=request.groq_api_key or config.groq_api_key,
        custom_system_prompt=request.custom_system_prompt,
        chat_history=history_payload
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...)
):
    """
    Uploads, saves permanently to disk storage, and indexes a document (PDF, TXT, MD) into the vector store.
    """
    allowed_exts = [".pdf", ".txt", ".md", ".json", ".csv"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(allowed_exts)}"
        )

    # Save file permanently into persistent storage
    persistent_path = os.path.join(STORAGE_DOCS_DIR, file.filename)

    try:
        with open(persistent_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks_count = process_and_index_document(persistent_path, file.filename)
        return {
            "success": True,
            "filename": file.filename,
            "chunks_indexed": chunks_count,
            "message": f"Successfully indexed and persisted '{file.filename}' ({chunks_count} vector chunks)."
        }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@app.post("/api/documents/text")
async def ingest_raw_text(payload: TextIngestRequest):
    """Ingests and persists direct text or note snippet into the vector store."""
    try:
        source_name = payload.title if payload.title.endswith(".txt") else f"{payload.title}.txt"
        persistent_path = os.path.join(STORAGE_DOCS_DIR, source_name)
        
        with open(persistent_path, "w", encoding="utf-8") as f:
            f.write(payload.content)

        chunks_count = process_and_index_document(persistent_path, source_name)
        return {
            "success": True,
            "filename": source_name,
            "chunks_indexed": chunks_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
async def list_documents():
    """Lists all persistently indexed documents and their chunk counts."""
    docs = vector_store_manager.list_documents_metadata()
    return {
        "documents": docs,
        "total_sources": len(docs)
    }


@app.get("/api/documents/{filename}/content")
async def get_document_content(filename: str):
    """
    Serves the document file directly (PDF, TXT, MD, etc.) with inline header
    allowing in-browser previewing, iframe rendering, and downloads.
    """
    file_path = os.path.join(STORAGE_DOCS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found on server.")

    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".txt": "text/plain; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".csv": "text/csv; charset=utf-8"
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename,
        content_disposition_type="inline"
    )


@app.get("/api/documents/{filename}/raw")
async def get_document_raw(filename: str):
    """
    Returns document text and metadata as JSON for fast in-modal rendering.
    """
    file_path = os.path.join(STORAGE_DOCS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found.")

    ext = os.path.splitext(filename)[1].lower()
    file_size = os.path.getsize(file_path)

    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            pages = []
            for i, p in enumerate(reader.pages):
                txt = p.extract_text() or ""
                pages.append({"page": i + 1, "text": txt})
            return {
                "filename": filename,
                "file_type": "PDF",
                "size": file_size,
                "pages_count": len(pages),
                "pages": pages,
                "is_binary": False
            }
        except Exception as e:
            return {
                "filename": filename,
                "file_type": "PDF",
                "size": file_size,
                "error": f"Could not parse PDF text: {str(e)}",
                "is_binary": True
            }
    else:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return {
                "filename": filename,
                "file_type": ext.replace(".", "").upper() or "TXT",
                "size": file_size,
                "content": content,
                "is_binary": False
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    """Deletes a document from persistent storage and updates vector store."""
    file_path = os.path.join(STORAGE_DOCS_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Could not remove file: {e}")

    # Remove from registry
    if filename in vector_store_manager.doc_registry:
        del vector_store_manager.doc_registry[filename]
        vector_store_manager._save_registry()

    # Re-initialize vector store and reindex remaining files
    vector_store_manager.local_docs = []
    vector_store_manager._init_local_store()
    
    for fname in os.listdir(STORAGE_DOCS_DIR):
        fpath = os.path.join(STORAGE_DOCS_DIR, fname)
        if os.path.isfile(fpath):
            try:
                process_and_index_document(fpath, fname)
            except Exception:
                pass

    return {"success": True, "message": f"Deleted '{filename}'."}


@app.post("/api/settings/verify")
async def verify_settings(payload: VerifySettingsRequest):
    """Verifies API credentials for Ollama, Groq, and MongoDB Atlas."""
    results = {
        "ollama_valid": False,
        "groq_valid": False,
        "mongodb_valid": False,
        "ollama_message": "",
        "groq_message": "",
        "mongodb_message": ""
    }

    # Verify Ollama
    ollama_url = payload.ollama_base_url or config.ollama_base_url
    try:
        import urllib.request
        req = urllib.request.Request(f"{ollama_url}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status == 200:
                results["ollama_valid"] = True
                results["ollama_message"] = f"Connected to Ollama service at {ollama_url}."
            else:
                results["ollama_message"] = f"Ollama returned HTTP status {resp.status}."
    except Exception as e:
        results["ollama_valid"] = False
        results["ollama_message"] = f"Could not connect to Ollama at {ollama_url}: {str(e)}"

    # Verify Groq
    groq_key = payload.groq_api_key or config.groq_api_key
    if groq_key and len(groq_key.strip()) > 5:
        try:
            import importlib
            groq_pkg = importlib.import_module("langchain_groq")
            ChatGroq = getattr(groq_pkg, "ChatGroq")
            test_llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=groq_key)
            res = await test_llm.ainvoke("Ping")
            results["groq_valid"] = True
            results["groq_message"] = "Groq API key verified successfully."
        except Exception as e:
            results["groq_valid"] = False
            results["groq_message"] = f"Groq validation notice: {str(e)}"
    else:
        results["groq_message"] = "No Groq API key supplied."

    # Verify MongoDB Atlas
    mongo_uri = payload.mongodb_uri or config.mongodb_uri
    if mongo_uri and "mongodb" in mongo_uri:
        try:
            import importlib
            import certifi
            pymongo = importlib.import_module("pymongo")
            client = pymongo.MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                tls=True,
                tlsCAFile=certifi.where(),
                tlsAllowInvalidCertificates=True
            )
            client.admin.command('ping')
            results["mongodb_valid"] = True
            results["mongodb_message"] = "MongoDB Atlas connection established."
        except Exception as e:
            results["mongodb_valid"] = False
            results["mongodb_message"] = f"MongoDB connection notice: {str(e)}"
    else:
        results["mongodb_message"] = "Using local vector store."

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.host, port=config.port)
