import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, Paperclip, Sparkles } from 'lucide-react';

interface PromptInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (value: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  onOpenKnowledge: () => void;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  input,
  setInput,
  onSend,
  isStreaming,
  onStop,
  onOpenKnowledge,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        onSend(input);
        setInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStreaming && input.trim()) {
      onSend(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-6 pt-2">
      {/* Floating Stop Generation Button */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="flex justify-center mb-3"
          >
            <button
              onClick={onStop}
              aria-label="Stop generation"
              className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-semibold shadow-md shadow-rose-600/30 border border-rose-500 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-rose-400 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Generating</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Container */}
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col bg-white border border-slate-300 hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-2xl shadow-lg shadow-slate-200/50 transition-all"
      >
        <div className="flex items-end px-3 py-2.5">
          {/* Document attachment trigger */}
          <button
            type="button"
            onClick={onOpenKnowledge}
            aria-label="Upload knowledge document"
            title="Upload Document to Knowledge Base"
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0 mb-0.5 focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your documents... (Shift + Enter for new line)"
            aria-label="Chat query input"
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none px-2 py-1 max-h-[180px] leading-relaxed"
          />

          {/* Send Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={!input.trim() || isStreaming}
            aria-label="Send message"
            className={`p-2.5 rounded-xl transition-all shrink-0 mb-0.5 shadow-sm flex items-center justify-center cursor-pointer ${
              input.trim() && !isStreaming
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            } focus-visible:ring-2 focus-visible:ring-blue-400`}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Input Footer Note */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-100 text-[11px] text-slate-400 bg-slate-50/50 rounded-b-2xl">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            Groq High-Speed RAG Pipeline
          </span>
          <span className="hidden sm:inline">Press Enter to send, Shift + Enter for new line</span>
        </div>
      </form>
    </div>
  );
};
