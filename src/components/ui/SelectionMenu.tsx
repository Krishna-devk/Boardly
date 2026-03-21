import React from 'react';
import { Wand2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SelectionMenuProps {
  bounds: { left: number; top: number; width: number; height: number } | null;
  onRefine: () => void;
  isRefining: boolean;
}

export function SelectionMenu({ bounds, onRefine, isRefining }: SelectionMenuProps) {
  if (!bounds) return null;

  // Position the menu above the selection
  const top = bounds.top - 60;
  const left = bounds.left + bounds.width / 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        style={{
          position: 'absolute',
          top: Math.max(20, top),
          left: left,
          transform: 'translateX(-50%)',
          zIndex: 60,
        }}
        className="pointer-events-auto"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefine();
          }}
          disabled={isRefining}
          className="group relative flex items-center gap-2.5 px-6 py-2.5 glass shadow-premium border border-purple-500/30 rounded-full text-[var(--foreground)] hover:text-white transition-all overflow-hidden"
        >
          {/* Animated Background for AI Feel */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-gradient-x" />
          
          <div className="relative flex items-center gap-2.5 font-bold tracking-tight">
            {isRefining ? (
              <>
                <Loader2 size={18} className="animate-spin text-purple-400 group-hover:text-white" />
                <span className="text-sm">Refining...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} className="text-purple-500 group-hover:text-white" />
                <span className="text-sm">AI Refine</span>
                <Wand2 size={14} className="opacity-40 group-hover:opacity-100" />
              </>
            )}
          </div>

          {/* Particle Effects (Subtle) */}
          {!isRefining && (
             <div className="absolute -right-2 top-0 bottom-0 w-8 bg-gradient-to-l from-purple-500/20 to-transparent blur-xl group-hover:animate-pulse" />
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
