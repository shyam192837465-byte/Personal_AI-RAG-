import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UploadCloud,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Plus,
  Layers,
  Clock,
  HardDrive,
  RefreshCw,
  Trash2,
  Eye,
} from 'lucide-react';
import type { DocumentMetadata } from '../types';

interface KnowledgeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentMetadata[];
  isUploading: boolean;
  uploadProgress: number;
  statusMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  onUploadFile: (file: File) => Promise<void>;
  onAddTextSnippet: (title: string, content: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onDeleteDocument?: (filename: string) => Promise<void>;
  onOpenDocument?: (doc: DocumentMetadata) => void;
}

export const KnowledgeDrawer: React.FC<KnowledgeDrawerProps> = ({
  isOpen,
  onClose,
  documents,
  isUploading,
  uploadProgress,
  statusMessage,
  onUploadFile,
  onAddTextSnippet,
  onRefresh,
  onDeleteDocument,
  onOpenDocument,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'snippet'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippetContent, setSnippetContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap & Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await onUploadFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onUploadFile(file);
      e.target.value = '';
    }
  };

  const handleSnippetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snippetTitle.trim() || !snippetContent.trim()) return;
    await onAddTextSnippet(snippetTitle, snippetContent);
    setSnippetTitle('');
    setSnippetContent('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Slide-over Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            role="dialog"
            aria-modal="true"
            aria-label="Knowledge Base Manager"
            className="relative z-10 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 border border-blue-200 text-blue-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Knowledge Base</h2>
                  <p className="text-xs text-slate-500">Manage vector embeddings & documents</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRefresh()}
                  title="Refresh document list"
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close knowledge drawer"
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pt-3 border-b border-slate-200 gap-4 bg-slate-50/40">
              <button
                onClick={() => setActiveTab('upload')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Files</span>
              </button>
              <button
                onClick={() => setActiveTab('snippet')}
                className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'snippet'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Quick Snippet</span>
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 bg-white">
              {/* Status Message Notification */}
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : statusMessage.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                  <span className="leading-tight font-medium">{statusMessage.text}</span>
                </motion.div>
              )}

              {/* Upload Tab */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.json,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      PDF, TXT, Markdown, JSON (up to 20MB)
                    </p>
                  </div>

                  {/* Upload Progress Bar */}
                  {isUploading && (
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex justify-between text-xs font-semibold text-blue-700">
                        <span>Chunking & Indexing...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Snippet Tab */}
              {activeTab === 'snippet' && (
                <form onSubmit={handleSnippetSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Snippet Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Project Architecture Notes"
                      value={snippetTitle}
                      onChange={(e) => setSnippetTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Content / Notes
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Paste guidelines, documentation, or custom reference notes..."
                      value={snippetContent}
                      onChange={(e) => setSnippetContent(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUploading || !snippetTitle.trim() || !snippetContent.trim()}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Index Note into Vector Store
                  </button>
                </form>
              )}

              {/* Indexed Documents List */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Indexed Documents ({documents.length})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {documents.reduce((acc, d) => acc + (d.chunks || 0), 0)} Total Chunks
                  </span>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No documents indexed yet. Upload a PDF or TXT to get started.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {documents.map((doc, idx) => (
                      <div
                        key={idx}
                        onClick={() => onOpenDocument && onOpenDocument(doc)}
                        className={`group p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-xs ${
                          onOpenDocument ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 font-semibold text-slate-800 group-hover:text-blue-700 transition-colors min-w-0">
                            {doc.source.endsWith('.pdf') ? (
                              <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                            ) : (
                              <FileCode className="w-4 h-4 text-blue-600 shrink-0" />
                            )}
                            <span className="truncate max-w-[200px]" title={doc.source}>
                              {doc.source}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded-full">
                              {doc.chunks} chunks
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 text-[10px] text-slate-500 font-mono">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3 text-slate-400" />
                              {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : 'Local'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Active'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {onOpenDocument && (
                              <button
                                onClick={() => onOpenDocument(doc)}
                                title="Open & view document content"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-blue-200 font-sans cursor-pointer font-semibold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Open</span>
                              </button>
                            )}

                            {onDeleteDocument && doc.source !== 'assistant_knowledge.txt' && (
                              <button
                                onClick={() => onDeleteDocument(doc.source)}
                                title="Delete document"
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
