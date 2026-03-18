import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as fabric from 'fabric';
import { useSocket } from './useSocket.ts';
import api from '../services/api.ts';
import throttle from 'lodash/throttle';

// SVG cursors
const pencilCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'></path></svg>") 0 24, crosshair`;
const eraserCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'></path><path d='M22 21H7'></path><path d='m5 11 9 9'></path></svg>") 0 24, crosshair`;

export const useWhiteboard = (boardId: string, canvasRef: React.RefObject<HTMLCanvasElement | null>, isDrawingDisabled: boolean = false) => {
  const socket = useSocket(boardId);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const isDrawing = useRef(false);
  const isRemoteUpdate = useRef(false);
  const drawingObject = useRef<any>(null);
  const disabledRef = useRef(isDrawingDisabled);
  const toolRef = useRef(tool);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  
  useEffect(() => {
    disabledRef.current = isDrawingDisabled;
  }, [isDrawingDisabled]);
  
  // History for undo/redo
  const history = useRef<any[]>([]);
  const redoStack = useRef<any[]>([]);

  // Throttled draw emission to avoid overwhelming the socket
  const throttledEmitDraw = useMemo(
    () => throttle((json: any) => {
      socket.emit('draw', { boardId, elements: json });
      window.dispatchEvent(new Event('local-draw'));
    }, 100),
    [boardId, socket]
  );

  // Global emit handler accessible to all internal logic
  const emitDraw = React.useCallback((immediate = true) => {
    if (!fabricCanvas.current || isRemoteUpdate.current || disabledRef.current) return;
    const json = fabricCanvas.current.toJSON();
    
    if (immediate) {
      history.current.push(json);
      if (history.current.length > 50) history.current.shift();
      redoStack.current = [];
    }
    
    if (immediate) {
      socket.emit('draw', { boardId, elements: json });
      window.dispatchEvent(new Event('local-draw'));
    } else {
      throttledEmitDraw(json);
    }
  }, [boardId, socket, throttledEmitDraw]);

  // Initialize canvas and socket listeners
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      width: window.innerWidth,
      height: window.innerHeight,
      selection: !disabledRef.current,
    });
    fabricCanvas.current = canvas;

    // Load initial board data
    api.get(`/boards/${boardId}`).then(async (res) => {
      if (res.data.elements && Object.keys(res.data.elements).length > 0) {
        isRemoteUpdate.current = true;
        try {
          await canvas.loadFromJSON(res.data.elements);
          canvas.renderAll();
        } catch (e) {
          console.error("Failed to parse historical board data:", e);
        }
        history.current = [canvas.toJSON()];
        isRemoteUpdate.current = false;
      } else {
        history.current = [canvas.toJSON()];
      }
    });

    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);

    // Socket listeners
    const handleRemoteUpdate = async (elements: any) => {
      if (fabricCanvas.current) {
        isRemoteUpdate.current = true;
        try {
          await fabricCanvas.current.loadFromJSON(elements);
          
          fabricCanvas.current.forEachObject((obj) => {
            const isActiveToolSelect = toolRef.current === 'select';
            obj.selectable = !disabledRef.current && isActiveToolSelect;
            obj.evented = !disabledRef.current && isActiveToolSelect;
          });
          if (disabledRef.current || toolRef.current !== 'select') {
            fabricCanvas.current.discardActiveObject();
          }

          fabricCanvas.current.renderAll();
          history.current.push(elements);
          if (history.current.length > 50) history.current.shift();
        } catch (e) {
          console.error("Received malformed canvas update from socket:", e);
        }
        isRemoteUpdate.current = false;
      }
    };

    socket.on('draw', handleRemoteUpdate);
    socket.on('undo', handleRemoteUpdate);
    socket.on('redo', handleRemoteUpdate);

    canvas.on('object:added', () => !isRemoteUpdate.current && emitDraw(true));
    canvas.on('object:modified', () => !isRemoteUpdate.current && emitDraw(false));
    canvas.on('object:removed', () => !isRemoteUpdate.current && emitDraw(true));
    canvas.on('path:created', () => !isRemoteUpdate.current && emitDraw(true));

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('draw', handleRemoteUpdate);
      socket.off('undo', handleRemoteUpdate);
      socket.off('redo', handleRemoteUpdate);
      throttledEmitDraw.cancel();
      canvas.dispose();
    };
  }, [boardId, socket, throttledEmitDraw]);

  // When isDrawingDisabled changes, update existing canvas
  useEffect(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    
    if (isDrawingDisabled) {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'default';
      // Make all objects non-interactive
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      canvas.discardActiveObject();
      canvas.renderAll();
    } else {
      // Selection re-enabling falls through to the tool-switching effect
      // to guarantee objects don't become selectable if a drawing tool is active.
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }, [isDrawingDisabled]);

  const undo = () => {
    if (isDrawingDisabled) return;
    if (history.current.length <= 1 || !fabricCanvas.current) return;
    
    const current = history.current.pop();
    redoStack.current.push(current);
    
    const prevState = history.current[history.current.length - 1];
    isRemoteUpdate.current = true;
    fabricCanvas.current.loadFromJSON(prevState).then(() => {
      fabricCanvas.current?.renderAll();
      socket.emit('undo', { boardId, elements: prevState });
      window.dispatchEvent(new Event('local-draw'));
      isRemoteUpdate.current = false;
    });
  };

  const redo = () => {
    if (isDrawingDisabled) return;
    if (redoStack.current.length === 0 || !fabricCanvas.current) return;
    
    const nextState = redoStack.current.pop();
    history.current.push(nextState);
    
    isRemoteUpdate.current = true;
    fabricCanvas.current.loadFromJSON(nextState).then(() => {
      fabricCanvas.current?.renderAll();
      socket.emit('redo', { boardId, elements: nextState });
      window.dispatchEvent(new Event('local-draw'));
      isRemoteUpdate.current = false;
    });
  };

  // Tool switching effect
  useEffect(() => {
    if (!fabricCanvas.current || isDrawingDisabled) return;
    const canvas = fabricCanvas.current;

    canvas.isDrawingMode = tool === 'draw';
    canvas.selection = tool === 'select';
    
    canvas.forEachObject((obj) => {
      obj.selectable = tool === 'select';
      obj.evented = tool === 'select';
    });
    if (tool !== 'select') {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();
    
    if (tool === 'draw') {
      // Fabric.js v7 does NOT auto-create freeDrawingBrush — we must do it explicitly
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingCursor = pencilCursor;
      canvas.defaultCursor = pencilCursor;
      canvas.hoverCursor = pencilCursor;
    } else if (tool === 'eraser') {
      canvas.defaultCursor = eraserCursor;
      canvas.hoverCursor = eraserCursor;
    } else if (tool === 'select') {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    } else if (tool === 'pan') {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
    } else {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    }

    // Also update brush properties when color/size change while in draw mode
    if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushSize;
    }

    let shapeStartX = 0;
    let shapeStartY = 0;
    
    // Panning state
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;

    const eraseObject = (e: any) => {
      const pointer = canvas.getScenePoint(e);
      const objects = canvas.getObjects();
      const threshold = Math.max(10, brushSize * 2); 
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (!obj) continue;
        
        if (typeof obj.containsPoint === 'function' && obj.containsPoint(pointer)) {
          canvas.remove(obj);
          break;
        }
        
        const bound = obj.getBoundingRect();
        if (
          bound &&
          pointer.x >= bound.left - threshold &&
          pointer.x <= bound.left + bound.width + threshold &&
          pointer.y >= bound.top - threshold &&
          pointer.y <= bound.top + bound.height + threshold
        ) {
          canvas.remove(obj);
          break;
        }
      }
    };

    const handleMouseDown = (o: any) => {
      // Handle panning
      if (tool === 'pan' || (o.e && o.e.altKey)) {
        isDragging = true;
        canvas.selection = false;
        lastPosX = o.e.clientX;
        lastPosY = o.e.clientY;
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        return;
      }

      if (tool === 'select' || tool === 'draw') return;
      
      isDrawing.current = true;

      if (tool === 'eraser') {
        eraseObject(o.e);
        return;
      }
      
      const pointer = canvas.getScenePoint(o.e);
      shapeStartX = pointer.x;
      shapeStartY = pointer.y;

      isRemoteUpdate.current = true; // Prevent automatic emit on object:added during creation

      if (tool === 'rect') {
        const rect = new fabric.Rect({
          left: shapeStartX,
          top: shapeStartY,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: color,
          strokeWidth: brushSize,
          selectable: false,
          evented: false,
        });
        canvas.add(rect);
        drawingObject.current = rect;
      } else if (tool === 'circle') {
        const circle = new fabric.Circle({
          left: shapeStartX,
          top: shapeStartY,
          radius: 0,
          fill: 'transparent',
          stroke: color,
          strokeWidth: brushSize,
          selectable: false,
          evented: false,
        });
        canvas.add(circle);
        drawingObject.current = circle;
      } else if (tool === 'line') {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: color,
          strokeWidth: brushSize,
          selectable: false,
          evented: false,
        });
        canvas.add(line);
        drawingObject.current = line;
      } else if (tool === 'arrow') {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: color,
          strokeWidth: brushSize,
          selectable: false,
          evented: false,
        });
        const head = new fabric.Triangle({
          width: Math.max(15, brushSize * 3),
          height: Math.max(15, brushSize * 3),
          fill: color,
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          angle: 90
        });
        canvas.add(line, head);
        drawingObject.current = { type: 'arrow', line, head, startX: pointer.x, startY: pointer.y };
      } else if (tool === 'text') {
        const text = new fabric.IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fill: color,
          fontSize: Math.max(20, brushSize * 5),
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        isDrawing.current = false;
        emitDraw(true);
        setTool('select');
      }
      isRemoteUpdate.current = false;
    };

    const handleMouseMove = (o: any) => {
      // Handle panning
      if (isDragging) {
        const e = o.e;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += e.clientX - lastPosX;
          vpt[5] += e.clientY - lastPosY;
          canvas.requestRenderAll();
        }
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        return;
      }

      // Force render frame for native Fabric brush tools to prevent invisible path lagging
      if (tool === 'draw') {
        canvas.requestRenderAll();
        return;
      }
      if (tool === 'eraser') {
        eraseObject(o.e);
        canvas.requestRenderAll();
        return;
      }

      if (!isDrawing.current) return;
      
      const pointer = canvas.getScenePoint(o.e);
      const activeObj = drawingObject.current;
      if (!activeObj) return;

      if (tool === 'rect') {
        activeObj.set({
          left: Math.min(shapeStartX, pointer.x),
          top: Math.min(shapeStartY, pointer.y),
          width: Math.abs(pointer.x - shapeStartX),
          height: Math.abs(pointer.y - shapeStartY),
        });
        canvas.requestRenderAll();
      } else if (tool === 'circle') {
        const radius = Math.max(Math.abs(pointer.x - shapeStartX), Math.abs(pointer.y - shapeStartY)) / 2;
        activeObj.set({
          left: shapeStartX > pointer.x ? shapeStartX - radius * 2 : shapeStartX,
          top: shapeStartY > pointer.y ? shapeStartY - radius * 2 : shapeStartY,
          radius: radius,
        });
        canvas.requestRenderAll();
      } else if (tool === 'line') {
        activeObj.set({
          x2: pointer.x,
          y2: pointer.y,
        });
        canvas.requestRenderAll();
      } else if (tool === 'arrow') {
        const { line, head, startX, startY } = activeObj;
        line.set({ x2: pointer.x, y2: pointer.y });
        
        const angle = Math.atan2(pointer.y - startY, pointer.x - startX) * (180 / Math.PI);
        head.set({ left: pointer.x, top: pointer.y, angle: angle + 90 });
        canvas.requestRenderAll();
      }
      
      // Disabled live shape streaming while dragging to prevent upper-canvas toJSON freezing
      // emitDraw(false);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        canvas.defaultCursor = tool === 'pan' ? 'grab' : 'default';
        canvas.hoverCursor = tool === 'pan' ? 'grab' : 'default';
        canvas.selection = tool === 'select';
        return;
      }

      if (isDrawing.current) {
        isDrawing.current = false;
        
        if (drawingObject.current) {
          isRemoteUpdate.current = true; // Silence canvas events
          if (drawingObject.current.type === 'arrow') {
             const { line, head, startX, startY } = drawingObject.current;
             const x2 = line.x2;
             const y2 = line.y2;
             const bSize = line.strokeWidth;
             const cColor = line.stroke;
             const dy = y2 - startY;
             const dx = x2 - startX;
             const angle = Math.atan2(dy, dx);
             const headlen = Math.max(15, bSize * 3);
             
             // Build flawless path geometry to completely avoid JSON nested group parsing crashes
             const pathData = `M ${startX} ${startY} L ${x2} ${y2} M ${x2 - headlen * Math.cos(angle - Math.PI / 6)} ${y2 - headlen * Math.sin(angle - Math.PI / 6)} L ${x2} ${y2} L ${x2 - headlen * Math.cos(angle + Math.PI / 6)} ${y2 - headlen * Math.sin(angle + Math.PI / 6)}`;
             
             const arrowPath = new fabric.Path(pathData, {
               stroke: cColor,
               strokeWidth: bSize,
               fill: 'transparent',
               strokeLineCap: 'round',
               strokeLineJoin: 'round',
               selectable: tool === 'select',
               evented: tool === 'select'
             });
             
             canvas.remove(line, head);
             canvas.add(arrowPath);
          } else {
             drawingObject.current.set({
               selectable: tool === 'select',
               evented: tool === 'select',
             });
          }
          isRemoteUpdate.current = false;
          
          drawingObject.current = null;
          emitDraw(true); // Persist final shape state to history and globally
        }

        if (tool === 'text') {
          setTool('select');
        }
      }
    };

    const handleMouseWheel = (opt: any) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 10) zoom = 10;
      if (zoom < 0.1) zoom = 0.1;
      
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:wheel', handleMouseWheel);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:wheel', handleMouseWheel);
    };
  }, [tool, color, brushSize, setTool, isDrawingDisabled]);

  return { fabricCanvas, tool, setTool, color, setColor, brushSize, setBrushSize, undo, redo };
};
