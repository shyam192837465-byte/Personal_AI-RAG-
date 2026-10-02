import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, BookOpen, Settings, Trash2, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AppSettings, ServerHealth } from '../types';

interface HeaderProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenKnowledge: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
  docCount: number;
  health: ServerHealth | null;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenKnowledge,
  onOpenSettings,
  onClearChat,
  docCount,
  health,
}) => {
  const isOnline = Boolean(health);
  const isGroqActive = Boolean(health?.has_groq_key);

  return (
    <header className="sticky top-0 z-30 w-full glass-header px-4 lg:px-8 py-3.5 flex items-center justify-between transition-all bg-white/90 border-b border-slate-200/90 shadow-xs">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 p-[1.5px] shadow-md shadow-blue-500/20"
          >
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
          </motion.div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
              isOnline ? 'bg-emerald-500' : 'bg-rose-500'
            } animate-pulse`}
          />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              Personal <span className="text-gradient">AI Assistant</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-blue-50 border border-blue-200 text-blue-700 rounded-full">
              <Sparkles className="w-3 h-3 text-blue-500" />
              RAG v2.0
            </span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>LangChain LCEL</span>
            <span className="text-slate-300">•</span>
            <span>{health?.is_atlas ? 'MongoDB Atlas' : 'Local Vector Store'}</span>
          </p>
        </div>
      </div>

      {/* Center: Controls (Model Selector & Status) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Model Selection Dropdown */}
        <div className="relative flex items-center bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs transition-colors">
          <Cpu className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" />
          <select
            aria-label="Select AI Model"
            value={settings.modelName}
            onChange={(e) =>
              onUpdateSettings({
                modelName: e.target.value,
              })
            }
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
          >
            <option value="mistral:latest" className="bg-white text-slate-800">
              mistral:latest (Ollama)
            </option>
            <option value="deepseek-r1:8b" className="bg-white text-slate-800">
              deepseek-r1:8b (Ollama)
            </option>
            <option value="llama3.1:latest" className="bg-white text-slate-800">
              llama3.1:latest (Ollama)
            </option>
            <option value="llama3.2:1b" className="bg-white text-slate-800">
              llama3.2:1b (Ollama)
            </option>
            <option value="Qwen3:latest" className="bg-white text-slate-800">
              Qwen3:latest (Ollama)
            </option>
            <option value="gpt-oss:20b" className="bg-white text-slate-800">
              gpt-oss:20b (Ollama)
            </option>
            <option value="openai/gpt-oss-120b" className="bg-white text-slate-800">
              gpt-oss-120b (Groq)
            </option>
          </select>
        </div>

        {/* API Status Badge */}
        <div
          title={
            health?.is_ollama_active
              ? 'Ollama Local Service Active'
              : isGroqActive
              ? 'Groq API Key Active'
              : 'Checking model service status'
          }
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
            health?.is_ollama_active || isGroqActive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          {health?.is_ollama_active || isGroqActive ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span>{health?.is_ollama_active ? 'Ollama Active' : isGroqActive ? 'Groq Active' : 'Local Fallback'}</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Knowledge Drawer Button */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenKnowledge}
          aria-label="Open Knowledge Base Drawer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 hover:text-blue-800 rounded-lg text-xs font-semibold transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Knowledge</span>
          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
            {docCount}
          </span>
        </motion.button>

        {/* Clear Chat Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClearChat}
          aria-label="Clear chat messages"
          title="Clear Conversation"
          className="p-2 text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>

        {/* Settings Modal Button */}
        <motion.button
          whileHover={{ scale: 1.05, rotate: 15 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          aria-label="Open Settings"
          title="Settings"
          className="p-2 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-blue-400 shadow-xs"
        >
          <Settings className="w-4 h-4" />
        </motion.button>
      </div>
    </header>
  );
};
