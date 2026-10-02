import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-xs">
      <div className="flex items-center gap-1.5 text-blue-600">
        <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
        <span className="text-xs font-semibold text-slate-700">Generating response</span>
      </div>

      <div className="flex items-center gap-1 pl-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-xs"
            animate={{
              y: [0, -5, 0],
              opacity: [0.4, 1, 0.4],
              scale: [0.9, 1.2, 0.9],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.18,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
};
