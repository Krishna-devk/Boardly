import React, { useEffect, useState, useRef } from 'react';
import { Share2, Download, Cloud, CloudOff, Sun, Moon, Lock, Unlock, Edit2, Check, X, ChevronRight, Settings2 } from 'lucide-react';
import { Button } from './Button.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { getSocket } from '../../services/socket.ts';
import { useDarkModeStore } from '../../store/darkModeStore.ts';

interface ToolbarProps {
  boardName: string;
  boardId: string;
  onShare: () => void;
  onDownload: () => void;
  isOwner: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
  onRename: (newName: string) => void;
}

export function Toolbar({ boardName, boardId, onShare, onDownload, isOwner, isLocked, onToggleLock, onRename }: ToolbarProps) {
  const [isSaved, setIsSaved] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(boardName);
  const [isExpanded, setIsExpanded] = useState(true);
  const { isDark, toggleDarkMode } = useDarkModeStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditNameValue(boardName);
  }, [boardName]);

  useEffect(() => {
    const socket = getSocket();
    
    const handleDraw = () => {
      setIsSaved(false);
      setTimeout(() => setIsSaved(true), 1000);
    };

    socket.on('draw', handleDraw);
    
    const handleLocalDraw = () => {
      setIsSaved(false);
      setTimeout(() => setIsSaved(true), 1000);
    };
    window.addEventListener('local-draw', handleLocalDraw);

    return () => {
      socket.off('draw', handleDraw);
      window.removeEventListener('local-draw', handleLocalDraw);
    };
  }, []);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleSaveName = () => {
    if (editNameValue.trim() && editNameValue !== boardName) {
      onRename(editNameValue.trim());
    } else {
      setEditNameValue(boardName);
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') {
      setEditNameValue(boardName);
      setIsEditingName(false);
    }
  };

  const containerVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      originX: 1,
      originY: 1,
      filter: 'blur(8px)',
      transition: {
        type: "spring", stiffness: 200, damping: 25, duration: 0.5
      }
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      originX: 1,
      originY: 1,
      filter: 'blur(0px)',
      transition: { 
        type: "spring",
        bounce: 0.3,
        duration: 0.7,
        staggerChildren: 0.05
      } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.5 } }
  };

  return (
    <div className="absolute bottom-6 sm:bottom-8 right-4 sm:right-6 flex items-end gap-3 z-20 pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="pointer-events-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] rounded-3xl flex flex-col sm:flex-row items-end sm:items-center border border-white/60 dark:border-gray-700/50 ring-1 ring-black/5 dark:ring-white/10 px-4 py-3 sm:px-5 sm:py-3 gap-3 overflow-hidden origin-bottom-right"
          >
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-end sm:items-center gap-3 mr-0 sm:mr-2 whitespace-nowrap">
              {/* Name Editing Area */}
              {isEditingName ? (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg pr-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none font-semibold text-gray-800 dark:text-gray-200 px-3 py-1 w-32 sm:w-40 text-sm focus:ring-0"
                  />
                  <button onClick={handleSaveName} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-md transition-colors">
                    <Check size={14} />
                  </button>
                  <button onClick={() => { setIsEditingName(false); setEditNameValue(boardName); }} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h1 className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px] sm:max-w-[200px]">
                    {boardName}
                  </h1>
                  {isOwner && (
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              )}

              <div className="hidden sm:flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-2.5 py-1 rounded-full border border-gray-200/50 dark:border-gray-700/50">
                {isSaved ? (
                  <><Cloud size={12} className="mr-1.5 text-green-500 dark:text-green-400" /> Saved</>
                ) : (
                  <><CloudOff size={12} className="mr-1.5 text-gray-400 dark:text-gray-500" /> Saving...</>
                )}
              </div>
              {isLocked && (
                <div className="flex items-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full border border-amber-200/50 dark:border-amber-700/50">
                  <Lock size={12} className="mr-1.5" /> Locked
                </div>
              )}
            </motion.div>
            
            <motion.div variants={itemVariants} className="w-full h-px sm:w-px sm:h-8 bg-gray-200 dark:bg-gray-700/50" />
            
            <motion.div variants={itemVariants} className="flex flex-row sm:flex-row items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <Button variant="ghost" size="sm" onClick={onShare} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-xl px-2 sm:px-3 font-medium">
                <Share2 size={16} className="sm:mr-2" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={onDownload} className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl px-2 sm:px-3" title="Download Image">
                <Download size={18} />
              </Button>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleLock}
                  className={`rounded-xl px-2 sm:px-3 ${isLocked ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  title={isLocked ? 'Unlock board for collaborators' : 'Lock board to prevent collaborators from drawing'}
                >
                  {isLocked ? <Unlock size={18} /> : <Lock size={18} />}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={toggleDarkMode} className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl px-2 sm:px-3" title="Toggle Dark Mode">
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="pointer-events-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 dark:border-gray-700 rounded-full p-3 sm:p-3.5 text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 flex-shrink-0"
        title={isExpanded ? "Collapse Toolbar" : "Expand Toolbar"}
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div key="right" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={20} />
            </motion.div>
          ) : (
            <motion.div key="gear" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Settings2 size={20} className="text-indigo-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
