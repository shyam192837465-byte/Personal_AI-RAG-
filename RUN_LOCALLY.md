# 🚀 Local Setup & Run Guide: Personal AI Assistant

This guide provides clear, step-by-step instructions to run the full-stack **Personal AI Assistant (AI-ForenSight_)** locally on Windows, macOS, or Linux.

---

## 📌 Architecture at a Glance

The project consists of two independent services running in parallel:

| Service | Technology | Default Port | URL |
| :--- | :--- | :--- | :--- |
| **Backend** | Python / FastAPI / LangChain | `8000` | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **Frontend** | React 19 / TypeScript / Vite / Tailwind | `5173` | [http://localhost:5173](http://localhost:5173) |
| **API Docs** | FastAPI Swagger UI | `8000` | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |

---

## 📋 Prerequisites

Ensure the following tools are installed on your machine:
- **Node.js**: `v18.0.0` or higher (verified on Node `v24+`)
- **npm**: `v9.0.0` or higher (verified on npm `11+`)
- **Python**: `v3.10` or higher (verified on Python `3.14+`)
- *(Optional)* **Ollama**: If you want to run models locally (e.g. `mistral`, `llama3`). Download from [ollama.com](https://ollama.com).
- *(Optional)* **Groq API Key**: For cloud inference. Get a free key at [console.groq.com](https://console.groq.com/keys).

---

## 🛠️ Step 1: Start the Backend (Terminal 1)

### 1. Open a terminal and navigate to the `backend/` folder
```powershell
cd backend
```

### 2. (Optional but recommended) Create and activate a Virtual Environment
```powershell
# Windows PowerShell
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Python Dependencies
```powershell
pip install -r requirements.txt
```

### 4. Configure Environment Variables
A sample configuration is already present in `backend/.env`. You can edit `backend/.env` with your preferred settings:

```env
# Ollama Local Configuration
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=mistral:latest
EMBEDDING_MODEL_NAME=nomic-embed-text
DEFAULT_TEMPERATURE=0.2

# Groq Cloud API Key (Optional fallback)
GROQ_API_KEY="gsk_your_groq_key_here"

# MongoDB Atlas Vector Search URI (Optional)
MONGODB_ATLAS_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME=personal_ai_assistant
MONGODB_COLLECTION_NAME=knowledge_vectors
MONGODB_INDEX_NAME=vector_index
```

> [!NOTE]
> **Graceful Fallbacks**:
> - If MongoDB Atlas is unavailable or unreachable, the system automatically runs with the built-in **In-Memory High-Speed Hybrid Vector Store**.
> - If neither Ollama nor a Groq API key is present, the app automatically switches to **Interactive Demo Mode** without crashing.

### 5. Launch the FastAPI Server
```powershell
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

When started successfully, you will see:
```text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Startup complete: persistent document(s) loaded
```

---

## 💻 Step 2: Start the Frontend (Terminal 2)

### 1. Open a second terminal and navigate to the `frontend/` folder
```powershell
cd frontend
```

### 2. Install Node Dependencies
*(Only required the first time or when dependencies change)*
```powershell
npm install
```

### 3. Start the Vite Development Server
```powershell
npm run dev
```

You will see output similar to:
```text
  VITE v8.2.1  ready in 250 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 4. Open the Web Application
Open your browser and navigate to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🔍 Step 3: Verify Everything Is Working

1. **Verify Backend Health**:
   Visit [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) in your browser. You should receive a JSON response:
   ```json
   {
     "status": "healthy",
     "vector_store_type": "High-Speed Local Vector Store",
     "is_atlas": false,
     "is_ollama_active": false,
     "default_model": "mistral:latest"
   }
   ```

2. **Verify Frontend UI**:
   - Open [http://localhost:5173](http://localhost:5173).
   - In the top-right corner, check that the connection badge shows green.
   - Click the **Knowledge Base** button to upload a document (`.txt`, `.pdf`, `.md`).
   - Ask a question in the chat bar to test streaming responses and document citations.

---

## 🛑 How to Stop the Project

To stop both services:
- Go to the **Backend Terminal** and press `Ctrl + C`.
- Go to the **Frontend Terminal** and press `Ctrl + C`.

---

## ❓ Troubleshooting & FAQs

### 1. Port 8000 or 5173 is already in use
- **Backend**: You can specify another port:
  ```powershell
  python -m uvicorn app:app --reload --host 127.0.0.1 --port 8080
  ```
  *(If you change this, update `backendUrl` in the Frontend Settings modal).*
- **Frontend**: Vite will automatically offer the next port (e.g., `5174`).

### 2. Windows PowerShell: Script Execution Disabled
If you encounter `cannot be loaded because running scripts is disabled on this system` when activating `.venv`, run:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 3. MongoDB Atlas Connection Timeout or DNS error
If you see `The DNS query name does not exist` or `ServerSelectionTimeoutError`:
- Ensure your IP address is whitelisted in your MongoDB Atlas Network Access (`0.0.0.0/0` for development).
- Alternatively, you can leave `MONGODB_ATLAS_URI=""` empty in `backend/.env`. The application will seamlessly use its local vector store.

### 4. Connecting to Ollama Locally
- Ensure Ollama is running on your machine:
  ```powershell
  ollama serve
  ```
- Pull your chosen model before prompting:
  ```powershell
  ollama run mistral
  ```
