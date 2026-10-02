# 🤖 Personal AI Assistant (Full-Stack RAG System)

A production-grade Personal AI Assistant featuring a dynamic, animated **React + TypeScript + Tailwind CSS** frontend and a Python-powered **RAG (Retrieval-Augmented Generation)** backend using **LangChain (Modern LCEL Architecture)**, **Groq** (`llama-3.3-70b-versatile`), and **MongoDB Atlas Vector Search**.

---

## 🌟 Key Architecture & Highlights

```
┌─────────────────────────────────────────────────────────────┐
│             React + TypeScript + Framer Motion              │
│  - SSE Streaming Client (ReadableStream + TextDecoder)      │
│  - AbortController "Stop Generation" floating trigger       │
│  - Virtualized auto-scrolling chat & Markdown code blocks   │
│  - Slide-over Knowledge Drawer & Drag-and-Drop Ingestion    │
│  - Settings Modal with live credential verification         │
└──────────────────────────────┬──────────────────────────────┘
                               │ SSE / Streaming HTTP
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend Server                   │
│  - POST /api/chat/stream (Server-Sent Events)               │
│  - POST /api/documents/upload (Multi-format chunking)       │
│  - GET  /api/health & GET /api/documents                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ LCEL Pipeline
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Modern LangChain LCEL RAG Chain               │
│  - create_stuff_documents_chain + create_retrieval_chain    │
│  - Strict avoidance of deprecated RetrievalQA               │
│  - Ingests PDF / TXT via RecursiveCharacterTextSplitter     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Groq Cloud LLM API      │ │ MongoDB Atlas Vector Search│
│   (llama-3.3-70b-versatile)  │ │ (with local vector cache)  │
└──────────────────────────────┘ └────────────────────────────┘
```

### 1. Modern LangChain LCEL vs Deprecated `RetrievalQA`
Traditional LangChain applications historically relied on monolithic, black-box classes like `RetrievalQA`. This application adopts modern **LangChain Expression Language (LCEL)** using:
- **`create_stuff_documents_chain`**: Formats and combines retrieved document chunks into dynamic prompt templates with context variables.
- **`create_retrieval_chain`**: Connects vector store retrievers with document chains while automatically retaining and forwarding source citation metadata to the stream output.
- **Asynchronous Streaming (`astream`)**: Yields Server-Sent Events (SSE) in real-time.

---

## 🚀 Quickstart Guide

> 📖 **Step-by-Step Local Guide**: For full instructions on running both frontend and backend locally with troubleshooting tips, see **[RUN_LOCALLY.md](./RUN_LOCALLY.md)**.

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **Groq API Key** (Free tier available at [console.groq.com](https://console.groq.com/keys))
- **MongoDB Atlas Cluster** (Optional; an in-memory high-speed vector store is automatically enabled if not provided)

---

### 1. Backend Setup & Credentials

1. Open `backend/config.py` (or `backend/.env`) and define your credentials directly in code:
   ```python
   # backend/config.py
   GROQ_API_KEY = "gsk_your_groq_api_key_here"
   MONGODB_ATLAS_URI = "mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority"
   ```
   Or via `backend/.env`:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   MONGODB_ATLAS_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
   ```

2. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Launch the FastAPI server:
   ```bash
   python -m uvicorn app:app --host 127.0.0.1 --port 8000
   ```

The backend will be available at `http://127.0.0.1:8000`.

---

### 2. Frontend Setup

1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

The animated React client will be accessible at `http://localhost:5173`.

---

## 🗄️ MongoDB Atlas Vector Search Index Configuration

To index semantic vectors in MongoDB Atlas, create a Vector Search Index on your target collection (`personal_ai_assistant.knowledge_vectors`):

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "source"
    },
    {
      "type": "filter",
      "path": "file_type"
    }
  ]
}
```

---

## 🧩 Frontend Features & Interactions

- **Micro-Interactions**: Smooth spring transitions and pulsating active-streaming indicators with `framer-motion`.
- **Source Citation Chips**: Displays referenced document names and chunk previews alongside generated answers.
- **Code Highlighting**: Syntax-highlighted code blocks with 1-click clipboard copy.
- **Interactive Knowledge Drawer**: Drag-and-drop file upload with live indexing progress bars.
- **Stream Interruption**: Floating "Stop Generation" button linked to active `AbortController`.
- **Keyboard Shortcuts**:
  - `Enter`: Submit message
  - `Shift + Enter`: Multi-line prompt input
  - `Escape`: Close modals and drawers

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | System health, vector store type, and active LLM status. |
| `/api/chat/stream` | `POST` | SSE stream yielding citation metadata and token chunks. |
| `/api/documents/upload`| `POST` | Multipart upload for PDF, TXT, and Markdown files. |
| `/api/documents/text` | `POST` | Ingests direct text snippets into the vector store. |
| `/api/documents` | `GET` | Returns all indexed documents and chunk statistics. |
| `/api/settings/verify` | `POST` | Real-time credential testing for Groq and MongoDB Atlas. |
