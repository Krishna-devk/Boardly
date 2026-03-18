import React, { useState, useEffect } from 'react';
import { Pencil, Square, Circle, Type, Eraser, MousePointer2, Minus, ArrowRight, Undo2, Redo2, ChevronLeft, Palette, Hand } from 'lucide-react';
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
    { id: 'pan', icon: Hand },
    { id: 'select', icon: MousePointer2 },
    { id: 'draw', icon: Pencil },
    { id: 'line', icon: Minus },
    { id: 'arrow', icon: ArrowRight },
    { id: 'rect', icon: Square },
    { id: 'circle', icon: Circle },
    { id: 'text', icon: Type },
    { id: 'eraser', icon: Eraser },
  ];

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
              className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] rounded-[28px] py-3 px-2 flex flex-col items-center justify-start gap-1.5 border border-white/60 dark:border-gray-700/50 ring-1 ring-black/5 dark:ring-white/10 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-h-[calc(100vh-140px)]"
            >
              {tools.map((t) => (
                <motion.button
                  key={t.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.15, x: 2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTool(t.id)}
                  title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
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
                title="Undo"
                className="p-2.5 rounded-[14px] w-11 h-11 flex items-center justify-center hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <Undo2 size={20} />
              </motion.button>
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.1, x: 2 }}
                whileTap={{ scale: 0.9 }}
                onClick={redo}
                title="Redo"
                className="p-2.5 rounded-[14px] w-11 h-11 flex items-center justify-center hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <Redo2 size={20} />
              </motion.button>
              
              <motion.div variants={itemVariants} className="h-px w-8 bg-gray-200 dark:bg-gray-700/50 my-1 flex-shrink-0" />
              
              <motion.div variants={itemVariants} className="flex flex-col items-center gap-3 bg-gray-50/80 dark:bg-gray-800/80 p-2 rounded-[18px] border border-gray-200/50 dark:border-gray-700/50 flex-shrink-0 w-11 pb-3">
                <motion.input
                  whileHover={{ scale: 1.1 }}
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 bg-transparent ring-2 ring-offset-2 ring-transparent hover:ring-indigo-500 dark:hover:ring-indigo-400 transition-all flex-shrink-0"
                />
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
        className="pointer-events-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 dark:border-gray-700 rounded-full p-3.5 text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 z-20 flex-shrink-0"
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
