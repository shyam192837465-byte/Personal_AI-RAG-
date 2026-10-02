import type { AppSettings, ServerHealth, DocumentMetadata } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  modelName: 'mistral:latest',
  temperature: 0.2,
  systemPrompt: 'You are an advanced, intelligent Personal AI Assistant powered by Ollama and MongoDB Atlas Vector Search. Answer questions using the retrieved knowledge context concisely and accurately.',
  backendUrl: 'http://localhost:8000',
};

const SETTINGS_STORAGE_KEY = 'personal_ai_assistant_settings';
const DOCS_STORAGE_KEY = 'personal_ai_assistant_documents';

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-migrate legacy Groq models to Ollama default
      if (
        !parsed.modelName ||
        parsed.modelName.includes('gpt-oss-120b') ||
        parsed.modelName.includes('llama-3.3') ||
        parsed.modelName.includes('llama-3.1-70b')
      ) {
        parsed.modelName = 'mistral:latest';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Error loading settings from localStorage:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings to localStorage:', e);
  }
}

export function loadCachedDocuments(): DocumentMetadata[] {
  try {
    const saved = localStorage.getItem(DOCS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading cached documents:', e);
  }
  return [];
}

export function cacheDocuments(docs: DocumentMetadata[]): void {
  try {
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error('Error saving documents to cache:', e);
  }
}

export async function fetchHealth(backendUrl: string): Promise<ServerHealth | null> {
  try {
    const res = await fetch(`${backendUrl}/api/health`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend health check error:', e);
  }
  return null;
}

export async function fetchDocuments(backendUrl: string): Promise<DocumentMetadata[]> {
  try {
    const res = await fetch(`${backendUrl}/api/documents`);
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];
      cacheDocuments(docs);
      return docs;
    }
  } catch (e) {
    console.error('Error fetching documents:', e);
  }
  return loadCachedDocuments();
}

export async function uploadDocumentFile(
  backendUrl: string,
  file: File
): Promise<{ success: boolean; message: string; chunks?: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${backendUrl}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  return { success: true, message: data.message, chunks: data.chunks_indexed };
}

export async function ingestSnippet(
  backendUrl: string,
  title: string,
  content: string
): Promise<{ success: boolean; chunks?: number }> {
  const res = await fetch(`${backendUrl}/api/documents/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || 'Failed to ingest note');
  }

  return await res.json();
}

export async function deleteDocumentFile(backendUrl: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/api/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    console.error('Error deleting document:', e);
    return false;
  }
}

export function getDocumentContentUrl(backendUrl: string, filename: string): string {
  return `${backendUrl}/api/documents/${encodeURIComponent(filename)}/content`;
}

export async function fetchDocumentRaw(backendUrl: string, filename: string): Promise<any> {
  const res = await fetch(`${backendUrl}/api/documents/${encodeURIComponent(filename)}/raw`);
  if (!res.ok) {
    throw new Error(`Failed to load document content: ${res.statusText}`);
  }
  return await res.json();
}

export async function verifyBackendCredentials(
  backendUrl: string,
  groqKey: string,
  mongoUri: string
) {
  const res = await fetch(`${backendUrl}/api/settings/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groq_api_key: groqKey, mongodb_uri: mongoUri }),
  });

  if (!res.ok) {
    throw new Error(`Verification failed with status ${res.status}`);
  }

  return await res.json();
}
