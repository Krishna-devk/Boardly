import React from 'react';
import { Pencil, Square, Circle, Type, Eraser, MousePointer2, Minus, ArrowRight, Undo2, Redo2 } from 'lucide-react';

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
    { id: 'select', icon: MousePointer2 },
    { id: 'draw', icon: Pencil },
    { id: 'line', icon: Minus },
    { id: 'arrow', icon: ArrowRight },
    { id: 'rect', icon: Square },
    { id: 'circle', icon: Circle },
    { id: 'text', icon: Type },
    { id: 'eraser', icon: Eraser },
  ];

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl rounded-[32px] px-6 py-3 flex items-center gap-3 z-10 border border-white/40 dark:border-gray-800 transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/20">
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
          className={`p-3 rounded-2xl transition-all duration-200 ${
            tool === t.id 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 dark:bg-indigo-500 dark:shadow-indigo-500/30 scale-110' 
              : 'hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 hover:scale-105'
          }`}
        >
          <t.icon size={22} strokeWidth={tool === t.id ? 2.5 : 2} />
        </button>
      ))}
      <div className="w-px h-10 bg-gray-200 dark:bg-gray-700/50 mx-2" />
      <button
        onClick={undo}
        title="Undo"
        className="p-3 rounded-2xl hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-all hover:scale-105 active:scale-95"
      >
        <Undo2 size={22} />
      </button>
      <button
        onClick={redo}
        title="Redo"
        className="p-3 rounded-2xl hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-all hover:scale-105 active:scale-95"
      >
        <Redo2 size={22} />
      </button>
      <div className="w-px h-10 bg-gray-200 dark:bg-gray-700/50 mx-2" />
      <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/80 p-2 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent ring-2 ring-offset-2 ring-transparent hover:ring-indigo-500 dark:hover:ring-indigo-400 transition-all"
        />
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-24 accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
        />
      </div>
    </div>
  );
}
