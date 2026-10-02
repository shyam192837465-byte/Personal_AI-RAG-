import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sliders,
  Database,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Save,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { AppSettings, ServerHealth } from '../types';
import { fetchHealth } from '../utils/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [isVerifying, setIsVerifying] = useState(false);
  const [healthStatus, setHealthStatus] = useState<ServerHealth | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings, isOpen]);

  // Focus trap and Escape key listener
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

  const handleCheckHealth = async () => {
    setIsVerifying(true);
    try {
      const h = await fetchHealth(form.backendUrl);
      setHealthStatus(h);
    } catch (e: any) {
      setHealthStatus(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings and System Configuration"
            className="relative z-10 w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 border border-blue-200 text-blue-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">System Settings</h2>
                  <p className="text-xs text-slate-500">Manage LLM parameters & backend directives</p>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close Settings"
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-white">
              {/* Code-Level Credentials Notice Card */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-blue-700 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Backend Configuration</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Ollama (<code className="text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono">mistral:latest</code> & <code className="text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono">nomic-embed-text</code>) and MongoDB Atlas URI are defined in <code className="text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono">backend/config.py</code> and <code className="text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono">backend/.env</code>.
                </p>
              </div>

              {/* Backend Status Live Feedback */}
              {healthStatus && (
                <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Ollama Local Service:</span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        healthStatus.is_ollama_active ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {healthStatus.is_ollama_active ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      {healthStatus.is_ollama_active ? 'Active (http://localhost:11434)' : 'Offline / Checking'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Embedding Model:</span>
                    <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {healthStatus.embedding_model || 'nomic-embed-text'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Vector Store:</span>
                    <span className="flex items-center gap-1 font-semibold text-blue-700">
                      <Database className="w-3.5 h-3.5 text-blue-600" />
                      {healthStatus.vector_store_type}
                    </span>
                  </div>
                </div>
              )}

              {/* Temperature Slider */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Temperature</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-bold border border-blue-200">
                    {form.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0.0 (Precise / Factual)</span>
                  <span>1.0 (Creative)</span>
                </div>
              </div>

              {/* Custom System Prompt */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  System Prompt (RAG Directive)
                </label>
                <textarea
                  rows={4}
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder="Define your assistant's core persona and citation rules..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed font-mono"
                />
              </div>

              {/* Backend API Connection String */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                  Backend API Connection String
                </label>
                <input
                  type="text"
                  value={form.backendUrl}
                  onChange={(e) => setForm({ ...form, backendUrl: e.target.value })}
                  placeholder="http://127.0.0.1:8000"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 gap-3">
                <button
                  type="button"
                  onClick={handleCheckHealth}
                  disabled={isVerifying}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isVerifying ? 'Checking...' : 'Check Backend Status'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Settings</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
