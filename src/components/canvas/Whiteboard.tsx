import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback, useEffect } from 'react';
import { useWhiteboard } from '../../hooks/useWhiteboard.ts';
import DrawingTools from './DrawingTools.tsx';
import CursorLayer from './CursorLayer.tsx';
import Minimap from './Minimap.tsx';
import * as fabric from 'fabric';

interface WhiteboardProps {
  boardId: string;
  isDrawingDisabled?: boolean;
  isOwner?: boolean;
  onSelectionChange?: (hasSelection: boolean, bounds?: { left: number, top: number, width: number, height: number }) => void;
}

export interface WhiteboardRef {
  downloadImage: () => void;
  startSpotlight: () => void;
  stopSpotlight: () => void;
  getAllText: () => string;
  getCanvasImage: () => string;
  refineSelection: () => Promise<string | null>;
  replaceSelectionWithRefinedContent: (content: string) => void;
}

const Whiteboard = forwardRef<WhiteboardRef, WhiteboardProps>(({ boardId, isDrawingDisabled = false, isOwner = false, onSelectionChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { socket, fabricCanvas, undo, redo, tool, setTool, color, setColor, brushSize, setBrushSize, isRemoteUpdate, emitDraw } = useWhiteboard(boardId as string, canvasRef, isDrawingDisabled);
  const spotlightIntervalRef = useRef<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Add selection listeners
  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    // These listeners are likely already in useWhiteboard, but adding them here for context if they were to be moved.
    // canvas.on('object:added', () => !isRemoteUpdate.current && emitDraw(true));
    // canvas.on('object:modified', () => !isRemoteUpdate.current && emitDraw(true));
    // canvas.on('object:removed', () => !isRemoteUpdate.current && emitDraw(true));

    // Selection listeners
    const updateSelection = () => {
      const active = canvas.getActiveObject();
      if (!active) {
        onSelectionChange?.(false);
      } else {
        const bounds = active.getBoundingRect();
        onSelectionChange?.(true, bounds);
      }
    };

    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', updateSelection);
    canvas.on('object:moving', updateSelection);
    canvas.on('object:scaling', updateSelection);

    return () => {
      canvas.off('selection:created', updateSelection);
      canvas.off('selection:updated', updateSelection);
      canvas.off('selection:cleared', updateSelection);
      canvas.off('object:moving', updateSelection);
      canvas.off('object:scaling', updateSelection);
    };
  }, [fabricCanvas, onSelectionChange]);


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
    },
    startSpotlight: () => {
      if (spotlightIntervalRef.current) return;
      spotlightIntervalRef.current = window.setInterval(() => {
        if (!fabricCanvas.current) return;
        const vpt = fabricCanvas.current.viewportTransform;
        const zoom = fabricCanvas.current.getZoom();
        if (vpt) {
          socket.emit('spotlight', { boardId, vpt, zoom });
        }
      }, 60);
    },
    stopSpotlight: () => {
      if (spotlightIntervalRef.current) {
        clearInterval(spotlightIntervalRef.current);
        spotlightIntervalRef.current = null;
      }
    },
    getAllText: () => {
      if (!fabricCanvas.current) return '';
      const objects = fabricCanvas.current.getObjects();
      let allText = '';
      objects.forEach((obj: any) => {
        if (obj.text) {
          allText += `${obj.text}\n`;
        } else if (obj._objects) {
          // Handle grouped objects if any
          obj._objects.forEach((child: any) => {
            if (child.text) allText += `${child.text} `;
          });
        }
      });
      return allText.trim();
    },
    getCanvasImage: () => {
      if (!fabricCanvas.current) return '';
      // We take a snapshot of the current viewport
      return fabricCanvas.current.toDataURL({
        format: 'jpeg',
        quality: 0.8,
      });
    },
    refineSelection: async () => {
      if (!fabricCanvas.current) return null;
      const activeObject = fabricCanvas.current.getActiveObject();
      if (!activeObject) return null;

      // Capture only the bounds of the active object/selection
      const bounds = activeObject.getBoundingRect();
      
      // Use toDataURL with cropping to the selection area
      // We add a little padding for context
      const padding = 20;
      const dataURL = fabricCanvas.current.toDataURL({
        format: 'jpeg',
        quality: 0.9,
        left: bounds.left - padding,
        top: bounds.top - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      });

      return dataURL;
    },
    replaceSelectionWithRefinedContent: (content: string) => {
      if (!fabricCanvas.current) return;
      const activeObject = fabricCanvas.current.getActiveObject();
      if (!activeObject) return;

      const { left, top, width, height } = activeObject.getBoundingRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;

      isRemoteUpdate.current = true;
      fabricCanvas.current.remove(activeObject);

      if (content.startsWith('[') && content.endsWith(']')) {
        const shapeType = content.slice(1, -1).toLowerCase().trim();
        let newShape: fabric.Object | null = null;
        
        const style = {
          left: left,
          top: top,
          stroke: (activeObject as any).stroke || '#6366f1',
          strokeWidth: (activeObject as any).strokeWidth || 4,
          fill: 'transparent',
          strokeLineCap: 'round' as const,
          strokeLineJoin: 'round' as const,
        };

        if (shapeType === 'circle' || shapeType === 'ellipse') {
          newShape = new fabric.Circle({ ...style, radius: Math.max(width, height) / 2 });
        } else if (['rectangle', 'rect', 'rectangel', 'box', 'square'].includes(shapeType)) {
          newShape = new fabric.Rect({ ...style, width, height });
        } else if (shapeType === 'triangle') {
          newShape = new fabric.Triangle({ ...style, width, height });
        } else if (shapeType === 'star') {
          // A simple 5-point star SVG path
          const starPath = "M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z";
          newShape = new fabric.Path(starPath, {
              ...style,
              scaleX: width / 100,
              scaleY: height / 100,
          });
        } else if (shapeType === 'arrow') {
            const headlen = 20;
            const angle = 0;
            const pathData = `M 0 ${height/2} L ${width} ${height/2} M ${width - headlen} ${height/2 - 10} L ${width} ${height/2} L ${width - headlen} ${height/2 + 10}`;
            newShape = new fabric.Path(pathData, { ...style });
        } else if (shapeType === 'line') {
            newShape = new fabric.Line([0, height/2, width, height/2], { ...style });
        } else {
          // Fallback if shape mentioned but not explicitly drawn as object
          newShape = new fabric.IText(shapeType.toUpperCase(), { 
              left, top, 
              fontSize: 32, 
              fontFamily: '"Outfit", sans-serif',
              fill: style.stroke,
              fontWeight: 800
          });
        }
        
        if (newShape) fabricCanvas.current.add(newShape);
      } else {
        // AI Transcribed Text - Making it "Impressive"
        const textHeight = Math.max(48, height * 1.2);
        const text = new fabric.IText(content, {
          left,
          top: top - (textHeight - height) / 2, // Center vertically
          fontSize: textHeight,
          fontFamily: '"Outfit", "Inter", sans-serif',
          fill: (activeObject as any).stroke || '#6366f1',
          fontWeight: 800,
          editable: true,
          shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.15)',
            blur: 15,
            offsetX: 0,
            offsetY: 8
          }),
          charSpacing: -20, // Modern tight tracking
        });

        // Add a subtle fade-in animation
        text.set('opacity', 0);
        fabricCanvas.current.add(text);
        text.animate({ opacity: 1 }, {
          duration: 400,
          onChange: fabricCanvas.current.renderAll.bind(fabricCanvas.current),
        });
      }

      isRemoteUpdate.current = false;
      fabricCanvas.current.discardActiveObject();
      fabricCanvas.current.renderAll();
      
      // Emit the change
      const json = fabricCanvas.current.toJSON();
      socket.emit('draw', { boardId: boardId as string, elements: json });
    },
  }));

  // ── Drag and Drop Media ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!fabricCanvas.current || isDrawingDisabled) return;
    const canvas = fabricCanvas.current;
    const dropX = e.clientX;
    const dropY = e.clientY;

    // Check for dropped files (images)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      files.forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const imgUrl = ev.target?.result as string;
            const imgEl = new Image();
            imgEl.onload = () => {
              const fImg = new fabric.FabricImage(imgEl, {
                left: dropX,
                top: dropY,
                scaleX: Math.min(500 / imgEl.width, 1),
                scaleY: Math.min(500 / imgEl.width, 1),
              });
              canvas.add(fImg);
              canvas.setActiveObject(fImg);
              canvas.renderAll();
              const json = canvas.toJSON();
              socket.emit('draw', { boardId, elements: json });
              window.dispatchEvent(new Event('local-draw'));
            };
            imgEl.src = imgUrl;
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          // For PDFs, create an annotation card
          const pdfNote = new fabric.Textbox(`📄 ${file.name}`, {
            left: dropX,
            top: dropY,
            width: 220,
            fontSize: 14,
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            backgroundColor: '#f1f5f9',
            fill: '#334155',
            padding: 14,
            textAlign: 'left',
            borderColor: '#6366f1',
            shadow: new fabric.Shadow({
              color: 'rgba(0,0,0,0.1)',
              blur: 12,
              offsetX: 0,
              offsetY: 4,
            }),
          });
          canvas.add(pdfNote);
          canvas.setActiveObject(pdfNote);
          canvas.renderAll();
          const json = canvas.toJSON();
          socket.emit('draw', { boardId, elements: json });
          window.dispatchEvent(new Event('local-draw'));
        }
      });
      return;
    }

    // Check for dropped URL text (e.g., YouTube link)
    const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (droppedText) {
      const ytMatch = droppedText.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if (ytMatch) {
        const videoId = ytMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.onload = () => {
          const fImg = new fabric.FabricImage(imgEl, {
            left: dropX,
            top: dropY,
            scaleX: 320 / imgEl.width,
            scaleY: 320 / imgEl.width,
          });
          canvas.add(fImg);

          // Add YouTube label
          const label = new fabric.Textbox(`▶ YouTube: ${videoId}`, {
            left: dropX,
            top: dropY + (imgEl.height * (320 / imgEl.width)) + 4,
            width: 320,
            fontSize: 12,
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            fill: '#6366f1',
            textAlign: 'center',
            selectable: true,
            evented: true,
          });
          canvas.add(label);
          canvas.renderAll();
          const json = canvas.toJSON();
          socket.emit('draw', { boardId, elements: json });
          window.dispatchEvent(new Event('local-draw'));
        };
        imgEl.onerror = () => {
          const card = new fabric.Textbox(`▶ ${droppedText}`, {
            left: dropX, top: dropY, width: 300, fontSize: 14,
            fontFamily: '"Inter", sans-serif',
            fill: '#6366f1', padding: 12,
          });
          canvas.add(card);
          canvas.renderAll();
          const json = canvas.toJSON();
          socket.emit('draw', { boardId, elements: json });
          window.dispatchEvent(new Event('local-draw'));
        };
        imgEl.src = thumbUrl;
      } else {
        // Generic URL — render as text card
        const card = new fabric.Textbox(`🔗 ${droppedText}`, {
          left: dropX,
          top: dropY,
          width: 280,
          fontSize: 14,
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          backgroundColor: '#eef2ff',
          fill: '#4338ca',
          padding: 12,
          textAlign: 'left',
          shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.08)',
            blur: 10,
            offsetX: 0,
            offsetY: 3,
          }),
        });
        canvas.add(card);
        canvas.renderAll();
        const json = canvas.toJSON();
        socket.emit('draw', { boardId, elements: json });
        window.dispatchEvent(new Event('local-draw'));
      }
    }
  }, [fabricCanvas, boardId, socket, isDrawingDisabled]);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[var(--background)] whiteboard-grid transition-colors duration-200 flex flex-col items-center justify-center"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-[100] bg-indigo-500/10 border-4 border-dashed border-indigo-500 rounded-xl pointer-events-none flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white/90 dark:bg-gray-900/90 px-8 py-5 rounded-2xl shadow-2xl text-center">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">Drop here</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Images, PDFs, or YouTube links</p>
          </div>
        </div>
      )}

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
      
      {!isDrawingDisabled && <Minimap fabricCanvas={fabricCanvas} />}
      
      <CursorLayer boardId={boardId} isOwner={isOwner} />
    </div>
  );
});

export default Whiteboard;
