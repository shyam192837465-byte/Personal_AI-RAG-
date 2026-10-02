export interface Citation {
  source: string;
  chunk_index: number;
  snippet: string;
  file_type?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: Citation[];
  isStreaming?: boolean;
  error?: string;
}

export interface DocumentMetadata {
  source: string;
  chunks: number;
  type: string;
  size: number;
  created_at: string;
}

export interface AppSettings {
  modelName: string;
  temperature: number;
  systemPrompt: string;
  backendUrl: string;
}

export interface ServerHealth {
  status: string;
  vector_store_type: string;
  is_atlas: boolean;
  is_ollama_active?: boolean;
  ollama_base_url?: string;
  has_groq_key: boolean;
  default_model: string;
  embedding_model: string;
  total_documents: number;
}
