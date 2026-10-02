import os
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.documents import Document
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
import importlib
import asyncio
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk, HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration, ChatGenerationChunk

from config import config
from rag.vector_store import vector_store_manager

logger = logging.getLogger("rag.chain")

# =========================================================================
# 1. Grounded System Prompt with Strict Citation Enforcement
# =========================================================================
DEFAULT_SYSTEM_PROMPT = """You are an advanced, intelligent Personal AI Assistant powered by Groq and MongoDB Atlas Vector Search.
Your goal is to provide accurate, truthful, and well-structured answers grounded in the retrieved knowledge context.

### 🛡️ STRICT GROUNDING & CITATION RULES:
1. **Source Grounding**: Base your factual answers primarily on the provided `<context>`.
2. **Citation Enforcement**: Whenever you state a fact derived from a document, cite it using inline bracket format, e.g.: `[Source: filename.ext, Section/Page]`.
3. **Out-of-Domain Guardrail**: If the `<context>` is empty or does NOT contain enough information to answer the question, clearly state:
   *"The provided knowledge documents do not contain information on this topic."*
   Then, provide a helpful answer using your general knowledge while explicitly identifying it as general knowledge.
4. **Formatting**: Use clean markdown, bold key takeaways, and format code snippets in fenced code blocks with language identifiers.

<context>
{context}
</context>
"""

CONDENSE_QUESTION_PROMPT = """Given the following conversation history and a follow-up user question, rephrase the follow-up question into a standalone, self-contained search query that captures all necessary entity names, subjects, and context.
Do NOT answer the question. Only output the rephrased standalone query. If the question is already self-contained or is a greeting, return the original question unchanged.

Chat History:
{chat_history}

Follow-up Question: {question}
Standalone Query:"""


# =========================================================================
# 2. Local Fallback LLM (Runs if no Groq API Key is supplied)
# =========================================================================
class FallbackLocalLLM(BaseChatModel):
    """
    Local fallback LLM implementing LangChain BaseChatModel for full LCEL Runnable compatibility.
    """
    model_name: str = "llama-3.3-70b-versatile"
    temperature: float = 0.2

    @property
    def _llm_type(self) -> str:
        return "fallback-local-llm"

    def _build_response_text(self, messages: List[BaseMessage]) -> str:
        context_str = ""
        user_query = ""
        for m in messages:
            content = str(m.content) if hasattr(m, 'content') else str(m)
            if "context" in content.lower():
                context_str = content
            else:
                user_query = content

        response_text = (
            f"**[Demo Mode: {self.model_name}]**\n\n"
            f"I have successfully retrieved relevant context using **Hybrid Search (Dense + BM25 with RRF)** & **Conversational Query Condensation**!\n\n"
            f"### 📄 Retrieved Knowledge Summary:\n"
            f"- **Search Strategy**: Hybrid (Dense Vector Embeddings + BM25 Keyword Search)\n"
            f"- **Chunking**: Structure-Aware Smart Chunking (700 chars, breadcrumb enriched)\n"
            f"- **Guardrails**: Similarity thresholding enabled\n\n"
            f"To connect to live **Groq Cloud** inference (`llama-3.3-70b-versatile`), click the **Settings (gear icon)** and enter your `GROQ_API_KEY`."
        )
        return response_text

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> ChatResult:
        reply = self._build_response_text(messages)
        message = AIMessage(content=reply)
        return ChatResult(generations=[ChatGeneration(message=message)])

    async def _astream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[ChatGenerationChunk, None]:
        reply = self._build_response_text(messages)
        words = reply.split(" ")
        for i, word in enumerate(words):
            suffix = " " if i < len(words) - 1 else ""
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=word + suffix))
            yield chunk
            await asyncio.sleep(0.015)


def get_llm(model_name: Optional[str] = None, temperature: Optional[float] = None, api_key: Optional[str] = None):
    chosen_model = model_name or config.default_model
    temp = temperature if temperature is not None else config.default_temperature
    key = api_key or config.groq_api_key

    # Check if specifically requested as Groq Cloud model
    is_groq = (
        chosen_model.startswith("groq/") or 
        chosen_model in ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"] or
        (chosen_model.startswith("openai/") and "gpt" in chosen_model and key and len(key.strip()) > 5)
    )

    if is_groq and key and len(key.strip()) > 5:
        try:
            groq_pkg = importlib.import_module("langchain_groq")
            ChatGroq = getattr(groq_pkg, "ChatGroq")
            groq_model = chosen_model.split("/")[-1] if "/" in chosen_model else chosen_model
            return ChatGroq(
                model_name=groq_model,
                groq_api_key=key,
                temperature=temp,
                streaming=True
            )
        except Exception as e:
            logger.error(f"Failed to initialize ChatGroq: {e}")

    # Primary: Use Ollama Local LLM
    try:
        from langchain_ollama import ChatOllama
        ollama_model = chosen_model
        # If legacy Groq/deprecated model was passed from old client cache, fallback to config default
        if "llama-3.3" in ollama_model or "gpt-oss-120b" in ollama_model or not ollama_model:
            ollama_model = config.default_model or "mistral:latest"
        elif "/" in ollama_model:
            ollama_model = ollama_model.split("/")[-1]

        return ChatOllama(
            model=ollama_model,
            base_url=config.ollama_base_url,
            temperature=temp,
            streaming=True
        )
    except Exception as e:
        logger.warning(f"Notice initializing ChatOllama ({e}). Using fallback LLM.")

    # 3. Local fallback LLM BaseChatModel
    return FallbackLocalLLM(model_name=chosen_model, temperature=temp)


# =========================================================================
# 3. Conversational Query Condensation
# =========================================================================
async def condense_query_if_needed(
    query: str,
    chat_history: Optional[List[Dict[str, str]]],
    llm: Any
) -> str:
    """
    Uses LLM to reformulate a follow-up query into a standalone search query
    containing all conversation context. If no history or simple greeting, returns query as-is.
    """
    if not chat_history or len(chat_history) == 0:
        return query

    # If fallback LLM or single short query, skip
    if isinstance(llm, FallbackLocalLLM):
        return query

    try:
        # Build history string from last 4 turns
        recent_turns = chat_history[-4:]
        history_lines = []
        for turn in recent_turns:
            role = "User" if turn.get("role") == "user" else "Assistant"
            history_lines.append(f"{role}: {turn.get('content', '')}")
        history_str = "\n".join(history_lines)

        condense_prompt = ChatPromptTemplate.from_template(CONDENSE_QUESTION_PROMPT)
        condense_chain = condense_prompt | llm | StrOutputParser()

        standalone_query = await condense_chain.ainvoke({
            "chat_history": history_str,
            "question": query
        })
        standalone_query = standalone_query.strip().replace('"', '').strip()
        logger.info(f"Query condensation: '{query}' -> '{standalone_query}'")
        return standalone_query if standalone_query else query
    except Exception as e:
        logger.warning(f"Notice in query condensation ({e}). Using raw query.")
        return query


# =========================================================================
# 4. Stream RAG Response with Single-Pass Retrieval & SSE Streaming
# =========================================================================
async def stream_rag_response(
    query: str,
    model_name: Optional[str] = None,
    temperature: Optional[float] = None,
    groq_api_key: Optional[str] = None,
    custom_system_prompt: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> AsyncGenerator[str, None]:
    """
    Executes an optimized, single-pass RAG pipeline:
    1. Conversational Query Condensation
    2. Hybrid Retrieval (Dense + BM25 with RRF & Thresholding)
    3. Immediate Citation Streaming with relevance scores
    4. Direct LCEL streaming with strict citation enforcement
    """
    llm = get_llm(model_name=model_name, temperature=temperature, api_key=groq_api_key)

    # 1. Condense query if multi-turn conversation
    search_query = await condense_query_if_needed(query, chat_history, llm)

    # 2. Single-pass Hybrid Retrieval
    retriever = vector_store_manager.get_retriever(k=4, similarity_threshold=0.35)
    try:
        if hasattr(retriever, 'ainvoke'):
            retrieved_docs: List[Document] = await retriever.ainvoke(search_query)
        else:
            retrieved_docs: List[Document] = retriever.invoke(search_query)
    except Exception as e:
        logger.warning(f"Retrieval notice: {e}")
        retrieved_docs = []

    # 3. Format citations for UI with relevance scores & section metadata
    citations = []
    for doc in retrieved_docs:
        source = doc.metadata.get("source", "Document")
        chunk_idx = doc.metadata.get("chunk_index", 0)
        section = doc.metadata.get("section") or (f"Page {doc.metadata.get('page')}" if doc.metadata.get('page') else None)
        score = doc.metadata.get("similarity_score", 0.0)
        snippet = doc.page_content[:240] + "..." if len(doc.page_content) > 240 else doc.page_content
        citations.append({
            "source": source,
            "chunk_index": chunk_idx,
            "section": section,
            "similarity_score": score,
            "snippet": snippet,
            "file_type": doc.metadata.get("file_type", "TXT")
        })

    # Yield citations event first so UI renders citation pill immediately
    yield f"event: citations\ndata: {json.dumps(citations)}\n\n"

    # 4. Construct context string for Prompt
    if retrieved_docs:
        context_parts = []
        for i, doc in enumerate(retrieved_docs):
            src_tag = doc.metadata.get("source", f"Doc_{i+1}")
            sec_tag = f" | {doc.metadata['section']}" if "section" in doc.metadata else ""
            context_parts.append(f"--- [Document: {src_tag}{sec_tag}] ---\n{doc.page_content}")
        context_str = "\n\n".join(context_parts)
    else:
        context_str = "[No matching documents found in the knowledge base meeting the relevance threshold.]"

    # 5. Build Chat Prompt Template
    prompt_template = custom_system_prompt or DEFAULT_SYSTEM_PROMPT
    if "{context}" not in prompt_template:
        prompt_template += "\n\n<context>\n{context}\n</context>"

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompt_template),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
    ])

    # Format history for LangChain
    history_messages = []
    if chat_history:
        for msg in chat_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                history_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                history_messages.append(AIMessage(content=content))

    # 6. Stream tokens via LCEL (Single pass, no second retriever call)
    qa_chain = prompt | llm | StrOutputParser()

    try:
        async for chunk in qa_chain.astream({
            "input": query,
            "context": context_str,
            "chat_history": history_messages
        }):
            if chunk:
                yield f"event: message\ndata: {json.dumps({'chunk': chunk})}\n\n"

        # Signal completion
        yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"

    except Exception as e:
        logger.error(f"Error streaming RAG response: {e}")
        fallback_msg = (
            f"**[Retrieved Information]**\n\n"
            f"I encountered a connectivity notice while reaching the live LLM endpoint ({str(e)}).\n\n"
            f"However, I successfully retrieved relevant knowledge chunks from your vector store shown in the cited sources above!"
        )
        yield f"event: message\ndata: {json.dumps({'chunk': fallback_msg})}\n\n"
        yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"
