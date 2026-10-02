import { useState, useEffect, useCallback } from 'react';
import type { DocumentMetadata } from '../types';
import { fetchDocuments, uploadDocumentFile, ingestSnippet, deleteDocumentFile, loadCachedDocuments } from '../utils/api';

export function useKnowledgeBase(backendUrl: string) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>(() => loadCachedDocuments());
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await fetchDocuments(backendUrl);
      setDocuments(docs);
    } catch (e) {
      console.error('Error refreshing documents:', e);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(20);
    setStatusMessage({ type: 'info', text: `Indexing "${file.name}" into vector space...` });

    try {
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 150);

      const result = await uploadDocumentFile(backendUrl, file);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setStatusMessage({
        type: 'success',
        text: `Indexed "${file.name}" (${result.chunks || 1} chunks ready)`,
      });

      await refreshDocuments();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || `Failed to index "${file.name}"`,
      });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  const addTextSnippet = async (title: string, content: string) => {
    setIsUploading(true);
    try {
      await ingestSnippet(backendUrl, title, content);
      setStatusMessage({
        type: 'success',
        text: `Created and indexed "${title}" successfully.`,
      });
      await refreshDocuments();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to add snippet.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (filename: string) => {
    try {
      await deleteDocumentFile(backendUrl, filename);
      await refreshDocuments();
    } catch (err: any) {
      console.error('Failed to delete document:', err);
    }
  };

  return {
    documents,
    isLoading,
    isUploading,
    uploadProgress,
    statusMessage,
    refreshDocuments,
    uploadFile,
    addTextSnippet,
    deleteFile,
    clearStatusMessage: () => setStatusMessage(null),
  };
}
