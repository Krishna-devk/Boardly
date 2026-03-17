import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useWhiteboard } from '../../hooks/useWhiteboard.ts';
import DrawingTools from './DrawingTools.tsx';
import CursorLayer from './CursorLayer.tsx';

interface WhiteboardProps {
  boardId: string;
  isDrawingDisabled?: boolean;
}

export interface WhiteboardRef {
  downloadImage: () => void;
}

const Whiteboard = forwardRef<WhiteboardRef, WhiteboardProps>(({ boardId, isDrawingDisabled = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { fabricCanvas, tool, setTool, color, setColor, brushSize, setBrushSize, undo, redo } = useWhiteboard(boardId, canvasRef, isDrawingDisabled);

  useImperativeHandle(ref, () => ({
    downloadImage: () => {
      if (fabricCanvas.current) {
        const dataURL = fabricCanvas.current.toDataURL({
          format: 'png',
          quality: 1,
        });
        const link = document.createElement('a');
        link.download = `whiteboard-${boardId}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }));

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200 flex flex-col items-center justify-center">
      
      {/* 
        Wrap fabric canvas in its own isolated container 
        so React doesn't interfere with Fabric's wrapper nodes 
        when conditionally rendering siblings 
      */}
      <div className="absolute inset-0 z-0">
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </div>
      
      {!isDrawingDisabled && (
        <DrawingTools
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          undo={undo}
          redo={redo}
        />
      )}
      
      <CursorLayer boardId={boardId} />
    </div>
  );
});

export default Whiteboard;
