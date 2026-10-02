import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, Citation } from '../types';
import { CodeBlock } from './CodeBlock';

interface MessageBubbleProps {
  message: Message;
  onOpenSource?: (sourceName: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onOpenSource }) => {
  const isUser = message.role === 'user';
  const [showCitations, setShowCitations] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy message:', e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 p-[1.5px] shadow-sm shadow-blue-500/20 mt-0.5">
          <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
        </div>
      )}

      {/* Bubble Container */}
      <div className={`flex flex-col max-w-[90%] sm:max-w-[82%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative group px-4 py-3.5 rounded-2xl transition-all shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs font-medium shadow-blue-500/20'
              : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200 shadow-slate-200/50'
          }`}
        >
          {/* Markdown Content */}
          <div
            role="log"
            aria-live={message.isStreaming ? 'polite' : 'off'}
            className={`prose max-w-none text-sm leading-relaxed break-words ${
              isUser ? 'text-white prose-invert' : 'text-slate-800'
            }`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <CodeBlock
                      language={match[1]}
                      value={String(children).replace(/\n$/, '')}
                    />
                  ) : (
                    <code
                      className={`px-1.5 py-0.5 rounded font-mono text-[13px] border ${
                        isUser
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-slate-100 text-blue-700 border-slate-200'
                      }`}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>,
                li: ({ children }) => <li className={isUser ? 'text-white' : 'text-slate-700'}>{children}</li>,
                h1: ({ children }) => <h1 className={`text-lg font-bold mt-3 mb-2 ${isUser ? 'text-white' : 'text-slate-900'}`}>{children}</h1>,
                h2: ({ children }) => <h2 className={`text-base font-bold mt-2.5 mb-1.5 ${isUser ? 'text-white' : 'text-blue-700'}`}>{children}</h2>,
                h3: ({ children }) => <h3 className={`text-sm font-semibold mt-2 mb-1 ${isUser ? 'text-white' : 'text-slate-800'}`}>{children}</h3>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full text-xs text-left border-collapse border border-slate-200">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 font-bold">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-slate-50/50">{children}</tr>,
                th: ({ children }) => <th className="px-3 py-2 border border-slate-200 font-semibold">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border border-slate-200 text-slate-700">{children}</td>,
                blockquote: ({ children }) => (
                  <blockquote className={`border-l-2 pl-3 italic my-2 ${isUser ? 'border-white/70 text-blue-100' : 'border-blue-500 text-slate-600'}`}>
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-blue-600 animate-pulse align-middle rounded" />
            )}
          </div>

          {/* Quick Copy Message action */}
          <button
            onClick={handleCopyMessage}
            title="Copy message"
            aria-label="Copy full message text"
            className={`absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
              isUser
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        {/* Source Citations Drawer/Chips (for assistant messages) */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setShowCitations((prev) => !prev)}
              aria-expanded={showCitations}
              aria-label="Toggle cited sources"
              className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 font-medium cursor-pointer"
            >
              <FileText className="w-3 h-3 text-blue-600" />
              <span>
                {message.citations.length} Cited Source{message.citations.length > 1 ? 's' : ''}
              </span>
              {showCitations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
              {showCitations && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1.5 overflow-hidden"
                >
                  {message.citations.map((cite: Citation, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => onOpenSource && onOpenSource(cite.source)}
                      className={`p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 text-xs text-slate-700 shadow-xs transition-colors ${
                        onOpenSource ? 'cursor-pointer hover:bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-blue-700 mb-1">
                        <span className="flex items-center gap-1.5 hover:underline truncate">
                          <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                          {cite.source}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onOpenSource && (
                            <span className="text-[10px] text-blue-600 hover:text-blue-800 underline font-mono">
                              View
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                            Chunk #{cite.chunk_index + 1}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-600 font-mono text-[11px] leading-relaxed line-clamp-3 bg-slate-50 p-2 rounded border border-slate-200">
                        {cite.snippet}
                      </p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-slate-400 mt-1 px-1">{message.timestamp}</span>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
};
