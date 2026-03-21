import React, { useState, useEffect } from 'react';
import { Pencil, Square, Circle, Type, Eraser, MousePointer2, Minus, ArrowRight, Undo2, Redo2, ChevronLeft, Palette, Hand, StickyNote, Spline, ImagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DrawingToolsProps {
  tool: string;
  setTool: (tool: string) => void;
  color: string;
  setColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  undo: () => void;
  redo: () => void;
}

export default function DrawingTools({ tool, setTool, color, setColor, brushSize, setBrushSize, undo, redo }: DrawingToolsProps) {
  const tools = [
    { id: 'pan', icon: Hand, shortcut: 'H / Space' },
    { id: 'select', icon: MousePointer2, shortcut: 'V' },
    { id: 'draw', icon: Pencil, shortcut: 'P' },
    { id: 'line', icon: Minus, shortcut: 'L' },
    { id: 'arrow', icon: ArrowRight, shortcut: 'A' },
    { id: 'rect', icon: Square, shortcut: 'R' },
    { id: 'circle', icon: Circle, shortcut: 'C' },
    { id: 'text', icon: Type, shortcut: 'T' },
    { id: 'sticky', icon: StickyNote, shortcut: 'S' },
    { id: 'connector', icon: Spline, shortcut: 'N' },
    { id: 'image', icon: ImagePlus, shortcut: 'I' },
    { id: 'eraser', icon: Eraser, shortcut: 'E' },
  ];

  const presetColors = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
  const [showColors, setShowColors] = useState(false);
  const [isExpanded, setIsExpanded] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsExpanded(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stagger variants for tools
  const containerVariants = {
    hidden: { opacity: 0, width: 0, scale: 0.8, filter: 'blur(10px)', originX: 0 },
    visible: { 
      opacity: 1, 
      width: 'auto',
      scale: 1, 
      filter: 'blur(0px)',
      transition: { 
        type: "spring", 
        bounce: 0.3, 
        duration: 0.6,
        staggerChildren: 0.04
      } 
    },
    exit: { 
      opacity: 0, 
      width: 0,
      scale: 0.8, 
      filter: 'blur(10px)',
      transition: { type: "spring", bounce: 0.3, duration: 0.4 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20, scale: 0.8 },
    visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", bounce: 0.5 } }
  };

  return (
    <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-[45%] flex flex-row items-center gap-4 sm:gap-6 z-20 h-auto max-h-[calc(100vh-120px)] pointer-events-none mt-4 sm:mt-6">
      <div className="flex flex-col items-center justify-center pointer-events-auto h-full max-h-[calc(100vh-120px)]">
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-2 h-full min-h-0 pointer-events-none"
            >
              <div className="glass shadow-premium rounded-[32px] py-4 px-2.5 flex flex-col items-center justify-start gap-2 border border-[var(--border)] ring-1 ring-black/5 dark:ring-white/10 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-1 min-h-0 pointer-events-auto">
                {tools.map((t) => (
                  <motion.button
                    key={t.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.15, x: 2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setTool(t.id)}
                    title={`${t.id.charAt(0).toUpperCase() + t.id.slice(1)} (${t.shortcut})`}
                    className={`p-2.5 rounded-[14px] transition-colors duration-200 flex-shrink-0 w-11 h-11 flex items-center justify-center ${
                      tool === t.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 dark:bg-indigo-500' 
                        : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <t.icon size={20} strokeWidth={tool === t.id ? 2.5 : 2} />
                  </motion.button>
                ))}
                
                <motion.div variants={itemVariants} className="h-px w-8 bg-gray-200 dark:bg-gray-700/50 my-1 flex-shrink-0" />
                
                <motion.button
                  variants={itemVariants}
                  whileHover={{ scale: 1.1, x: 2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={undo}
                  title="Undo (Ctrl+Z)"
                  className="p-2.5 rounded-[14px] w-11 h-11 flex items-center justify-center hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <Undo2 size={20} />
                </motion.button>
                <motion.button
                  variants={itemVariants}
                  whileHover={{ scale: 1.1, x: 2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={redo}
                  title="Redo (Ctrl+Y)"
                  className="p-2.5 rounded-[14px] w-11 h-11 flex items-center justify-center hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <Redo2 size={20} />
                </motion.button>
              </div>

              <motion.div 
                variants={itemVariants} 
                className="glass shadow-premium rounded-[24px] p-2.5 flex flex-col items-center gap-3 border border-[var(--border)] ring-1 ring-black/5 dark:ring-white/10 overflow-visible flex-shrink-0 pointer-events-auto relative"
              >
                <div className="relative z-50">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowColors(!showColors)}
                    className="w-7 h-7 rounded-full cursor-pointer ring-2 ring-offset-1 ring-transparent hover:ring-indigo-500/50 dark:hover:ring-indigo-400/50 shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all flex-shrink-0 border-2 border-white/80 dark:border-gray-600 block relative"
                    style={{ backgroundColor: color }}
                    title="Select Color"
                  />
                  <AnimatePresence>
                    {showColors && (
                      <div className="absolute top-1/2 left-1/2 w-0 h-0 pointer-events-none z-[100]">
                        {presetColors.map((c, index) => {
                          const angle = -75 + (150 / (presetColors.length - 1)) * index;
                          const rad = (angle * Math.PI) / 180;
                          const a = 75; // X radius
                          const b = 135; // Y radius
                          const x = a * Math.cos(rad);
                          const y = b * Math.sin(rad);

                          return (
                            <motion.button
                              key={c}
                              initial={{ opacity: 0, x, y, scale: 0 }}
                              animate={{ opacity: 1, x, y, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.4 }}
                              transition={{
                                type: 'spring',
                                stiffness: 500,
                                damping: 28,
                                delay: index * 0.018,
                                exit: { duration: 0.12, ease: 'easeIn', delay: 0 },
                              }}
                              onClick={() => { setColor(c); setShowColors(false); }}
                              className={`absolute -ml-4 -mt-4 w-8 h-8 rounded-full border shadow-[0_8px_16px_rgba(0,0,0,0.25)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)] pointer-events-auto transition-all ${color === c ? 'ring-4 ring-indigo-500/60 ring-offset-2 border-transparent dark:ring-offset-gray-900 scale-110' : 'border-white/90 dark:border-gray-500 hover:scale-105'}`}
                              style={{ backgroundColor: c }}
                            />
                          );
                        })}
                        
                        <motion.div
                           initial={{ opacity: 0, x: 105, y: 0, scale: 0 }}
                           animate={{ opacity: 1, x: 105, y: 0, scale: 1 }}
                           exit={{ opacity: 0, scale: 0.4 }}
                           transition={{
                             type: 'spring',
                             stiffness: 500,
                             damping: 28,
                             delay: presetColors.length * 0.018,
                             exit: { duration: 0.12, ease: 'easeIn', delay: 0 },
                           }}
                           title="Custom Color Picker"
                           className="absolute -ml-5 -mt-5 w-10 h-10 pointer-events-auto rounded-[16px] bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-[0_10px_25px_rgba(0,0,0,0.2)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex items-center justify-center border border-gray-200 dark:border-gray-600 transition-all cursor-pointer hover:bg-white dark:hover:bg-gray-800"
                        >
                          <input 
                            type="color" 
                            value={color} 
                            onChange={(e) => setColor(e.target.value)} 
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                          />
                          <Palette size={20} className="text-gray-700 dark:text-gray-300 pointer-events-none" />
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="h-24 w-4 relative flex items-center justify-center flex-shrink-0 mb-1 mt-1">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-24 accent-indigo-600 dark:accent-indigo-500 cursor-pointer absolute origin-center -rotate-90"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="pointer-events-auto glass shadow-premium border border-[var(--border)] rounded-full p-4 text-[var(--foreground)] hover:text-indigo-600 transition-all z-20 flex-shrink-0 group"
        title={isExpanded ? "Collapse Drawing Tools" : "Expand Drawing Tools"}
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div key="collapse" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <ChevronLeft size={24} />
            </motion.div>
          ) : (
            <motion.div key="expand" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Palette size={24} className="text-indigo-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
