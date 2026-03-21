import React from 'react';
import { Sparkles, X, BrainCircuit, ListTodo, MessageSquareText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  analysis: string | null;
  error: string | null;
}

export function AIPanel({ isOpen, onClose, isLoading, analysis, error }: AIPanelProps) {
  // Simple markdown renderer for the analysis
  const renderLine = (line: string, index: number) => {
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+/, '').trim();
      if (level === 1) return <h2 key={index} className="text-xl font-bold mt-4 mb-2 text-indigo-600 dark:text-indigo-400">{content}</h2>;
      return <h3 key={index} className="text-lg font-bold mt-3 mb-1">{content}</h3>;
    }
    if (line.startsWith('-') || line.startsWith('*')) {
      return <li key={index} className="ml-4 mb-1 list-disc text-gray-700 dark:text-gray-300">{line.substring(1).trim()}</li>;
    }
    if (line.trim() === '') return <br key={index} />;
    return <p key={index} className="mb-2 text-gray-700 dark:text-gray-300 leading-relaxed">{line}</p>;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 400 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 400 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-24 bottom-24 right-6 w-[380px] z-50 glass shadow-premium rounded-[32px] flex flex-col overflow-hidden border border-[var(--border)]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--foreground)] tracking-tight">AI Analyst</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Llama 3.3 70B</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 size={40} className="animate-spin text-indigo-500" />
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200">Analyzing your board...</p>
                  <p className="text-sm text-gray-400 px-10">This will only take a moment. Thinking about your project.</p>
                </div>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center text-red-600 mb-4">
                   <MessageSquareText size={24} />
                </div>
                <h4 className="font-bold text-red-700 dark:text-red-400 mb-1">Ouch! Something went wrong</h4>
                <p className="text-sm text-red-600/70 dark:text-red-400/70">{error}</p>
              </div>
            ) : analysis ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {analysis.split('\n').map((line, idx) => renderLine(line, idx))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-500">
                    <BrainCircuit size={40} className="animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100" />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-200" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-[var(--foreground)] text-lg mb-1">Board Intelligence</h4>
                  <p className="text-sm text-gray-500 px-6">Click the AI button to analyze your board's contents and generate insights.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Card */}
          {!isLoading && analysis && (
            <div className="p-4 bg-indigo-600 m-4 rounded-2xl flex items-center gap-3 text-white shadow-xl shadow-indigo-600/30 group">
              <div className="w-10 h-10 bg-white/20 rounded-[14px] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                 <ListTodo size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-0.5">Ready for next steps?</p>
                <p className="text-sm font-medium">Try adding a new sticky note for each action item!</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
