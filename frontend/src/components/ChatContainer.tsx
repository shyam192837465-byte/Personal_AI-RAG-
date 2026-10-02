import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { Sparkles, FileText, Code2, Database } from 'lucide-react';

interface ChatContainerProps {
  messages: Message[];
  isStreaming: boolean;
  onSelectPrompt: (promptText: string) => void;
  onOpenSource?: (sourceName: string) => void;
}

const QUICK_SUGGESTIONS = [
  {
    icon: Database,
    title: 'RAG Pipeline Tech Stack',
    prompt: 'What technology stack and LangChain primitives are used to build this assistant?',
  },
  {
    icon: FileText,
    title: 'Knowledge Base Summary',
    prompt: 'Summarize the loaded knowledge base documents and their cited sources.',
  },
  {
    icon: Code2,
    title: 'LCEL Chain Architecture',
    prompt: 'Explain why create_stuff_documents_chain and create_retrieval_chain replace legacy RetrievalQA.',
  },
];

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isStreaming,
  onSelectPrompt,
  onOpenSource,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new tokens/messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-4 max-w-5xl mx-auto w-full">
      {/* Welcome & Suggestions if new chat */}
      {showSuggestions && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="my-6 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2.5 mb-2 text-blue-600">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-900">Ask your Personal Knowledge Base</h2>
          </div>
          <p className="text-xs text-slate-600 mb-5 leading-relaxed">
            This assistant retrieves vector-indexed knowledge from MongoDB Atlas using LangChain LCEL and generates streamed answers with ChatGroq.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_SUGGESTIONS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt(item.prompt)}
                  className="flex flex-col text-left p-3.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-900 transition-all shadow-xs group focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-blue-100 border border-blue-200 text-blue-600 w-fit mb-2 group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 mb-1">{item.title}</span>
                  <span className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                    {item.prompt}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Messages List */}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onOpenSource={onOpenSource} />
      ))}

      {/* Active Streaming Typing Indicator */}
      {isStreaming && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-1"
        >
          <TypingIndicator />
        </motion.div>
      )}

      <div ref={bottomRef} className="h-4" />
    </div>
  );
};
