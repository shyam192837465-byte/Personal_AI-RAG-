import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface ErrorBannerProps {
  error: {
    message: string;
    statusCode?: number;
    retryFn?: () => void;
  } | null;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="mx-4 lg:mx-8 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 shadow-sm flex items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="truncate font-medium">{error.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {error.retryFn && (
              <button
                onClick={error.retryFn}
                aria-label="Retry failed request"
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}

            <button
              onClick={onDismiss}
              aria-label="Dismiss error banner"
              className="p-1 text-rose-500 hover:text-rose-800 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
