import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as fabric from 'fabric';
import { useSocket } from './useSocket.ts';
import api from '../services/api.ts';
import throttle from 'lodash/throttle';
import { useDarkModeStore } from '../store/darkModeStore.ts';

// SVG cursors
const pencilCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'></path></svg>") 0 24, crosshair`;
const eraserCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'></path><path d='M22 21H7'></path><path d='m5 11 9 9'></path></svg>") 0 24, crosshair`;

// ────────── Smart Shape Recognition helpers ──────────
function recognizePath(path: fabric.Path): { type: 'circle' | 'rect' | 'line' | 'triangle' | null; confidence: number } {
  const pts = (path as any).path as any[];
  if (!pts || pts.length < 3) return { type: null, confidence: 0 };

  // Flatten curve commands into a list of {x,y}
  const points: { x: number; y: number }[] = [];
  for (const cmd of pts) {
    if (cmd[0] === 'M' || cmd[0] === 'L') {
      points.push({ x: cmd[1], y: cmd[2] });
    } else if (cmd[0] === 'Q') {
      points.push({ x: cmd[3], y: cmd[4] });
    } else if (cmd[0] === 'C') {
      points.push({ x: cmd[5], y: cmd[6] });
    }
  }
  if (points.length < 4) return { type: null, confidence: 0 };

  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = Math.hypot(last.x - first.x, last.y - first.y) < 40;

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const diagLen = Math.hypot(w, h);
  if (diagLen < 20) return { type: null, confidence: 0 };

  if (isClosed) {
    // ── 1. Rectangle test (Prioritize) ──
    let edgeCount = 0;
    const edgeThr = Math.max(w, h) * 0.12;
    for (const p of points) {
      if (Math.abs(p.x - minX) < edgeThr || Math.abs(p.x - maxX) < edgeThr ||
          Math.abs(p.y - minY) < edgeThr || Math.abs(p.y - maxY) < edgeThr) {
        edgeCount++;
      }
    }
    const rectScore = edgeCount / points.length;
    if (rectScore > 0.8) {
      return { type: 'rect', confidence: rectScore };
    }

    // ── 2. Circle test (Stricter) ──
    const avgR = points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / points.length;
    const variance = points.reduce((s, p) => s + Math.abs(Math.hypot(p.x - cx, p.y - cy) - avgR), 0) / points.length;
    const circleScore = 1 - (variance / (avgR + 0.1));
    const aspect = Math.min(w, h) / Math.max(w, h);
    if (circleScore > 0.88 && aspect > 0.8) {
      return { type: 'circle', confidence: circleScore };
    }

    // ── 3. Triangle test (3 Corner heuristic) ──
    // Check points' distance from centroid. A triangle has 3 peaks.
    const dists = points.map(p => Math.hypot(p.x - cx, p.y - cy));
    let peaks = 0;
    for (let i = 1; i < dists.length - 1; i++) {
        if (dists[i] > dists[i-1] * 1.01 && dists[i] > dists[i+1] * 1.01 && dists[i] > avgR * 1.1) {
            peaks++;
            i += 10; // skip small noise
        }
    }
    if (peaks === 3) {
        return { type: 'triangle', confidence: 0.8 };
    }
  }

  // ── 4. Line test ──
  if (!isClosed && points.length >= 2) {
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy);
    if (len > 30) {
      let totalDev = 0;
      for (const p of points) {
        const crossLen = Math.abs(dx * (first.y - p.y) - dy * (first.x - p.x)) / len;
        totalDev += crossLen;
      }
      const avgDev = totalDev / points.length;
      const lineScore = 1 - avgDev / (len * 0.15 + 10);
      if (lineScore > 0.75) {
        return { type: 'line', confidence: lineScore };
      }
    }
  }

  return { type: null, confidence: 0 };
}

// ────────── Connector helpers ──────────
function getClosestEdgePoint(obj: fabric.Object, targetX: number, targetY: number) {
  const bound = obj.getBoundingRect();
  const cx = bound.left + bound.width / 2;
  const cy = bound.top + bound.height / 2;
  
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const scaleX = (dx > 0 ? (bound.left + bound.width - cx) : (bound.left - cx)) / dx;
  const scaleY = (dy > 0 ? (bound.top + bound.height - cy) : (bound.top - cy)) / dy;
  const t = Math.min(Math.abs(scaleX), Math.abs(scaleY));

  return {
    x: cx + dx * t,
    y: cy + dy * t
  };
}

function findTargetAt(canvas: fabric.Canvas, x: number, y: number, exclude?: fabric.Object[]): fabric.Object | null {
  const objects = canvas.getObjects();
  const threshold = 40;
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (exclude && exclude.includes(obj)) continue;
    if ((obj as any).__isConnector) continue;
    const b = obj.getBoundingRect();
    if (x >= b.left - threshold && x <= b.left + b.width + threshold &&
        y >= b.top - threshold && y <= b.top + b.height + threshold) {
      return obj;
    }
  }
  return null;
}

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
  const { isDark } = useDarkModeStore();

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
      if (!fabricCanvas.current) return;

      const canvas = fabricCanvas.current;

      const prevWidth = canvas.getWidth();
      const prevHeight = canvas.getHeight();

      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      // Calculate scale ratios
      const scaleX = newWidth / prevWidth;
      const scaleY = newHeight / prevHeight;

      // Resize canvas
      canvas.setDimensions({
        width: newWidth,
        height: newHeight,
      });

      // 🔥 Reset viewport transform (VERY IMPORTANT)
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

      // Optional: scale objects to fit new size
      canvas.getObjects().forEach((obj) => {
        obj.scaleX = (obj.scaleX || 1) * scaleX;
        obj.scaleY = (obj.scaleY || 1) * scaleY;
        obj.left = (obj.left || 0) * scaleX;
        obj.top = (obj.top || 0) * scaleY;
        obj.setCoords();
      });

      canvas.renderAll(); // 🚨 THIS LINE IS MANDATORY
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

    // Spotlight (Follow Me) listener — sync incoming viewport from presenter
    const handleSpotlight = (data: { vpt: number[]; zoom: number }) => {
      if (!fabricCanvas.current) return;
      fabricCanvas.current.setViewportTransform(data.vpt as [number,number,number,number,number,number]);
      fabricCanvas.current.setZoom(data.zoom);
      fabricCanvas.current.requestRenderAll();
    };
    socket.on('spotlight', handleSpotlight);

    canvas.on('object:added', () => !isRemoteUpdate.current && emitDraw(true));
    canvas.on('object:modified', () => !isRemoteUpdate.current && emitDraw(true));
    canvas.on('object:removed', () => !isRemoteUpdate.current && emitDraw(true));

    // Automatic shape recognition disabled as per user request to use only manual AI refinement.
    // canvas.on('path:created', (e: any) => { ... });

    // ── Connector: keep arrows attached to shapes when dragged ──
    canvas.on('object:moving', (e: any) => {
      if (isRemoteUpdate.current) return;
      const movedObj = e.target;
      if (!movedObj) return;

      canvas.getObjects().forEach((obj: any) => {
        if (!obj.__isConnector) return;
        if (obj.__connectorFrom === movedObj || obj.__connectorTo === movedObj) {
          const fromObj = obj.__connectorFrom;
          const toObj = obj.__connectorTo;
          if (!fromObj || !toObj) return;
          
          const fromEdge = getClosestEdgePoint(fromObj, toObj.getCenterPoint().x, toObj.getCenterPoint().y);
          const toEdge = getClosestEdgePoint(toObj, fromObj.getCenterPoint().x, fromObj.getCenterPoint().y);

          const dx = toEdge.x - fromEdge.x;
          const dy = toEdge.y - fromEdge.y;
          const angle = Math.atan2(dy, dx);
          const headlen = 15;
          const pathData = `M ${fromEdge.x} ${fromEdge.y} L ${toEdge.x} ${toEdge.y} M ${toEdge.x - headlen * Math.cos(angle - Math.PI / 6)} ${toEdge.y - headlen * Math.sin(angle - Math.PI / 6)} L ${toEdge.x} ${toEdge.y} L ${toEdge.x - headlen * Math.cos(angle + Math.PI / 6)} ${toEdge.y - headlen * Math.sin(angle + Math.PI / 6)}`;

          // Update existing path array instead of remove/add
          obj.set({ path: fabric.util.parsePath(pathData) });
          obj.setCoords();
        }
      });
      canvas.requestRenderAll();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('draw', handleRemoteUpdate);
      socket.off('undo', handleRemoteUpdate);
      socket.off('redo', handleRemoteUpdate);
      socket.off('spotlight', handleSpotlight);
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

  // Dark mode: swap pure black ↔ white on all canvas objects + active color
  useEffect(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    let changed = false;

    canvas.getObjects().forEach((obj: any) => {
      // Swap stroke
      if (isDark && (obj.stroke === '#000000' || obj.stroke === 'black')) { obj.set('stroke', '#e4e4e7'); changed = true; }
      else if (!isDark && (obj.stroke === '#e4e4e7' || obj.stroke === '#ffffff' || obj.stroke === 'white')) { obj.set('stroke', '#000000'); changed = true; }

      // Swap fill (text, shapes)
      if (isDark && (obj.fill === '#000000' || obj.fill === 'black')) { obj.set('fill', '#e4e4e7'); changed = true; }
      else if (!isDark && (obj.fill === '#e4e4e7' || obj.fill === '#ffffff' || obj.fill === 'white')) { obj.set('fill', '#000000'); changed = true; }

      // Swap backgroundColor (sticky notes with black/white background)
      if (isDark && (obj.backgroundColor === '#000000' || obj.backgroundColor === 'black')) { obj.set('backgroundColor', '#e4e4e7'); obj.set('fill', '#18181b'); changed = true; }
      else if (!isDark && (obj.backgroundColor === '#e4e4e7' || obj.backgroundColor === '#ffffff' || obj.backgroundColor === 'white')) { obj.set('backgroundColor', '#000000'); obj.set('fill', '#e4e4e7'); changed = true; }
    });

    if (changed) {
      canvas.renderAll();
      const json = canvas.toJSON();
      socket.emit('draw', { boardId, elements: json });
    }

    // Also swap the active stroke color if it is pure black or white
    setColor((prev) => {
      if (isDark && (prev === '#000000' || prev === 'black')) return '#e4e4e7';
      if (!isDark && (prev === '#e4e4e7' || prev === '#ffffff' || prev === 'white')) return '#000000';
      return prev;
    });
  }, [isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = React.useCallback(() => {
    if (disabledRef.current) return;
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
  }, [boardId, socket]);

  const redo = React.useCallback(() => {
    if (disabledRef.current) return;
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
  }, [boardId, socket]);

  // Keyboard Shortcuts implementation
  const prevToolRef = useRef<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      
      // Prevent triggering shortcuts when typing in inputs/textareas or active editable text on canvas
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        (e.target instanceof HTMLElement && e.target.isContentEditable) ||
        (fabricCanvas.current && fabricCanvas.current.getActiveObject()?.isEditing)
      ) {
        return;
      }

      // Spacebar for temporary panning
      if (e.code === 'Space' && !e.repeat) {
        if (toolRef.current !== 'pan') {
          prevToolRef.current = toolRef.current;
          setTool('pan');
        }
        e.preventDefault();
      }

      // Undo / Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'y') {
          redo();
          e.preventDefault();
        }
        return;
      }

      // Quick Tool Selection
      const key = e.key.toLowerCase();
      const toolMap: Record<string, string> = {
        'v': 'select',
        'p': 'draw',
        'r': 'rect',
        'c': 'circle',
        'a': 'arrow',
        'l': 'line',
        't': 'text',
        's': 'sticky',
        'n': 'connector',
        'i': 'image',
        'e': 'eraser',
        'h': 'pan'
      };

      if (toolMap[key]) {
        setTool(toolMap[key]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (prevToolRef.current) {
          setTool(prevToolRef.current);
          prevToolRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setTool, undo, redo, fabricCanvas]);

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
      } else if (tool === 'sticky') {
        // Sticky Notes with distinct colours
        const stickyColors: Record<string, { bg: string; text: string }> = {
          '#000000': { bg: '#fef08a', text: '#422006' },
          '#ef4444': { bg: '#fca5a5', text: '#7f1d1d' },
          '#f97316': { bg: '#fed7aa', text: '#7c2d12' },
          '#eab308': { bg: '#fef08a', text: '#422006' },
          '#22c55e': { bg: '#bbf7d0', text: '#14532d' },
          '#06b6d4': { bg: '#a5f3fc', text: '#164e63' },
          '#3b82f6': { bg: '#bfdbfe', text: '#1e3a5f' },
          '#a855f7': { bg: '#e9d5ff', text: '#3b0764' },
          '#ec4899': { bg: '#fbcfe8', text: '#831843' },
          '#ffffff': { bg: '#ffffff', text: '#111827' },
        };
        const palette = stickyColors[color] || { bg: color, text: '#111827' };
        const sticky = new fabric.Textbox('Type here...', {
          left: pointer.x,
          top: pointer.y,
          width: 200,
          fontSize: 18,
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          backgroundColor: palette.bg,
          fill: palette.text,
          padding: 18,
          splitByGrapheme: true,
          textAlign: 'left',
          borderColor: '#4f46e5',
          cornerColor: '#ffffff',
          cornerStrokeColor: '#4f46e5',
          cornerSize: 10,
          transparentCorners: false,
          shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.12)',
            blur: 20,
            offsetX: 2,
            offsetY: 6
          })
        });
        canvas.add(sticky);
        canvas.setActiveObject(sticky);
        sticky.enterEditing();
        sticky.selectAll();
        isDrawing.current = false;
        emitDraw(true);
        setTool('select');
      } else if (tool === 'connector') {
        // Find a shape to start from
        const target = findTargetAt(canvas, pointer.x, pointer.y);
        if (target) {
          const edge = getClosestEdgePoint(target, pointer.x, pointer.y);
          const line = new fabric.Line([edge.x, edge.y, pointer.x, pointer.y], {
            stroke: color || '#6366f1',
            strokeWidth: 2,
            strokeDashArray: [6, 3],
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          drawingObject.current = { type: 'connector', line, fromObj: target, startX: edge.x, startY: edge.y };
        } else {
          // No target: just draw a plain arrow
          const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: color || '#6366f1',
            strokeWidth: 2,
            strokeDashArray: [6, 3],
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          drawingObject.current = { type: 'connector', line, fromObj: null, startX: pointer.x, startY: pointer.y };
        }
      } else if (tool === 'image') {
        // Open file picker for images
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            const imgUrl = re.target?.result as string;
            const imgEl = new Image();
            imgEl.onload = () => {
              const fImg = new fabric.FabricImage(imgEl, {
                left: pointer.x,
                top: pointer.y,
                scaleX: Math.min(400 / imgEl.width, 1),
                scaleY: Math.min(400 / imgEl.width, 1),
              });
              canvas.add(fImg);
              canvas.setActiveObject(fImg);
              emitDraw(true);
            };
            imgEl.src = imgUrl;
          };
          reader.readAsDataURL(file);
        };
        input.click();
        isDrawing.current = false;
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
      } else if (tool === 'connector') {
        const { line, fromObj } = activeObj;
        if (fromObj) {
          const fromPt = getClosestEdgePoint(fromObj, pointer.x, pointer.y);
          line.set({ x1: fromPt.x, y1: fromPt.y });
        }
        line.set({ x2: pointer.x, y2: pointer.y });
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

        if (tool === 'text' || tool === 'sticky') {
          setTool('select');
        }

        if (drawingObject.current) {
          isRemoteUpdate.current = true;
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
          } else if (drawingObject.current.type === 'connector') {
            const { line, fromObj, startX, startY } = drawingObject.current;
            const endX = line.x2!;
            const endY = line.y2!;
            canvas.remove(line);

            // Find target shape at endpoint
            const toObj = findTargetAt(canvas, endX, endY, fromObj ? [fromObj] : []);

            // Compute final edge points with center-to-center logic
            let fromPt = { x: startX, y: startY };
            let toPt   = { x: endX, y: endY };
            if (fromObj) {
              const target = toObj ? toObj.getCenterPoint() : { x: endX, y: endY };
              fromPt = getClosestEdgePoint(fromObj, target.x, target.y);
            }
            if (toObj) {
              const origin = fromObj ? fromObj.getCenterPoint() : { x: startX, y: startY };
              toPt = getClosestEdgePoint(toObj, origin.x, origin.y);
            }

            const dx = toPt.x - fromPt.x;
            const dy = toPt.y - fromPt.y;
            const angle = Math.atan2(dy, dx);
            const headlen = 14;
            const pathData = `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y} M ${toPt.x - headlen * Math.cos(angle - Math.PI / 6)} ${toPt.y - headlen * Math.sin(angle - Math.PI / 6)} L ${toPt.x} ${toPt.y} L ${toPt.x - headlen * Math.cos(angle + Math.PI / 6)} ${toPt.y - headlen * Math.sin(angle + Math.PI / 6)}`;

            const connectorPath = new fabric.Path(pathData, {
              stroke: line.stroke || '#6366f1',
              strokeWidth: 2,
              fill: 'transparent',
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              selectable: false,
              evented: false,
            });
            (connectorPath as any).__isConnector = true;
            (connectorPath as any).__connectorFrom = fromObj;
            (connectorPath as any).__connectorTo = toObj;
            canvas.add(connectorPath);
          } else {
            drawingObject.current.set({
              selectable: tool === 'select',
              evented: tool === 'select',
            });
          }
          isRemoteUpdate.current = false;

          drawingObject.current = null;
          emitDraw(true);
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

  return { fabricCanvas, socket, tool, setTool, color, setColor, brushSize, setBrushSize, undo, redo, isRemoteUpdate, emitDraw };
};
