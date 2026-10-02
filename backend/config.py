import os
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# =========================================================================
# 🔑 BACKEND CODE CONFIGURATION: Enter your credentials directly below
# =========================================================================
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
MONGODB_ATLAS_URI: str = os.getenv("MONGODB_ATLAS_URI", "")
MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "personal_ai_assistant")
MONGODB_COLLECTION_NAME: str = os.getenv("MONGODB_COLLECTION_NAME", "knowledge_vectors")
MONGODB_INDEX_NAME: str = os.getenv("MONGODB_INDEX_NAME", "vector_index")
# =========================================================================

class AppConfig(BaseModel):
    ollama_base_url: str = OLLAMA_BASE_URL
    groq_api_key: Optional[str] = GROQ_API_KEY
    mongodb_uri: Optional[str] = MONGODB_ATLAS_URI
    mongodb_db_name: str = MONGODB_DB_NAME
    mongodb_collection_name: str = MONGODB_COLLECTION_NAME
    mongodb_index_name: str = MONGODB_INDEX_NAME
    default_model: str = os.getenv("DEFAULT_MODEL", "mistral:latest")
    default_temperature: float = float(os.getenv("DEFAULT_TEMPERATURE", "0.2"))
    embedding_model_name: str = os.getenv("EMBEDDING_MODEL_NAME", "nomic-embed-text")
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))

# Global singleton config
config = AppConfig()
