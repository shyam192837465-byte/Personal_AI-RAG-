import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  FileCode,
  ExternalLink,
  Download,
  Copy,
  Check,
  Eye,
  Code,
  HardDrive,
  Clock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DocumentMetadata } from '../types';
import { getDocumentContentUrl, fetchDocumentRaw } from '../utils/api';
import { CodeBlock } from './CodeBlock';

interface DocumentViewerModalProps {
  document: DocumentMetadata | null;
  backendUrl: string;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  backendUrl,
  onClose,
}) => {
  const [docData, setDocData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'raw' | 'pdf'>('preview');
  const [copied, setCopied] = useState(false);

  const isPdf = document?.source?.toLowerCase().endsWith('.pdf');
  const isMarkdown = document?.source?.toLowerCase().endsWith('.md') || document?.source?.toLowerCase().endsWith('.markdown');

  // Load document content whenever opened
  useEffect(() => {
    if (!document) {
      setDocData(null);
      setError(null);
      return;
    }

    if (isPdf) {
      setViewMode('pdf');
    } else {
      setViewMode('preview');
    }

    let isMounted = true;
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = await fetchDocumentRaw(backendUrl, document.source);
        if (isMounted) {
          setDocData(raw);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load document preview.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [document, backendUrl, isPdf]);

  // Escape key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document, onClose]);

  if (!document) return null;

  const contentUrl = getDocumentContentUrl(backendUrl, document.source);

  const handleCopyText = async () => {
    const textToCopy = docData?.content || (docData?.pages ? docData.pages.map((p: any) => `--- Page ${p.page} ---\n${p.text}`).join('\n\n') : '');
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-5xl h-[88vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Top Bar Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-blue-100 border border-blue-200 text-blue-600 shrink-0">
                {isPdf ? <FileText className="w-5 h-5 text-rose-500" /> : <FileCode className="w-5 h-5 text-blue-600" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 truncate" title={document.source}>
                    {document.source}
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {document.chunks} Chunks
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5 font-mono">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-slate-400" />
                    {document.size ? `${(document.size / 1024).toFixed(1)} KB` : 'Local Document'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {document.created_at ? new Date(document.created_at).toLocaleString() : 'Indexed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Tab Selector for Markdown & Text */}
              {!isPdf && (
                <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl gap-1 mr-2">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'preview'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Formatted</span>
                  </button>
                  <button
                    onClick={() => setViewMode('raw')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'raw'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Raw Text</span>
                  </button>
                </div>
              )}

              {/* Copy Text Button */}
              <button
                onClick={handleCopyText}
                title="Copy full document text"
                className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Open in New Tab */}
              <a
                href={contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open document in new browser tab"
                className="p-2 text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">New Tab</span>
              </a>

              {/* Download File */}
              <a
                href={contentUrl}
                download={document.source}
                title="Download original file"
                className="p-2 text-slate-600 hover:text-blue-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
              </a>

              {/* Close Button */}
              <button
                onClick={onClose}
                aria-label="Close document viewer"
                className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors ml-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-hidden relative bg-white">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 z-20">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-xs text-slate-600 font-mono">Loading document content...</p>
              </div>
            )}

            {error && (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-3 h-full">
                <div className="p-3 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-rose-700">{error}</p>
                <a
                  href={contentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-blue-600 border border-slate-200 rounded-xl transition-colors"
                >
                  Try opening directly in new tab
                </a>
              </div>
            )}

            {!loading && !error && isPdf && (
              <div className="w-full h-full flex flex-col">
                <iframe
                  src={`${contentUrl}#toolbar=1&navpanes=1`}
                  className="w-full h-full border-none bg-slate-50"
                  title={document.source}
                />
              </div>
            )}

            {!loading && !error && !isPdf && viewMode === 'preview' && (
              <div className="w-full h-full overflow-y-auto p-6 sm:p-8">
                {isMarkdown ? (
                  <div className="prose max-w-none text-slate-800 prose-headings:text-slate-900 prose-a:text-blue-600 prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {docData?.content || ''}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {docData?.content || 'No text content available.'}
                  </div>
                )}
              </div>
            )}

            {!loading && !error && !isPdf && viewMode === 'raw' && (
              <div className="w-full h-full overflow-y-auto p-6 font-mono text-xs">
                <CodeBlock
                  language={document.source.split('.').pop() || 'text'}
                  value={docData?.content || ''}
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
