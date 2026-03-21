import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Map } from 'lucide-react';

interface MinimapProps {
  fabricCanvas: React.RefObject<fabric.Canvas | null>;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 130;

export default function Minimap({ fabricCanvas }: MinimapProps) {
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!thumbnailCanvasRef.current) {
      thumbnailCanvasRef.current = document.createElement('canvas');
      thumbnailCanvasRef.current.width = MINIMAP_WIDTH;
      thumbnailCanvasRef.current.height = MINIMAP_HEIGHT;
    }

    const updateThumbnail = () => {
      const canvas = fabricCanvas.current;
      const thumbCtx = thumbnailCanvasRef.current?.getContext('2d');
      if (!canvas || !thumbCtx) return;

      const canvasW = canvas.getWidth();
      const canvasH = canvas.getHeight();
      const scaleX = MINIMAP_WIDTH / canvasW;
      const scaleY = MINIMAP_HEIGHT / canvasH;

      // Match background to board state
      thumbCtx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
      thumbCtx.fillStyle = document.documentElement.classList.contains('dark') ? '#0b0f1a' : '#ffffff';
      thumbCtx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

      // Draw all objects manually for high performance & accuracy
      const objects = canvas.getObjects();
      thumbCtx.save();
      thumbCtx.scale(scaleX, scaleY);
      
      objects.forEach((obj) => {
        if (!obj.visible || obj.opacity === 0) return;
        
        thumbCtx.save();
        // Apply the Fabric object's transform logic
        // In modern Fabric, transform() handles position, scaling, and rotation.
        (obj as any).transform(thumbCtx);
        (obj as any).drawObject(thumbCtx);
        thumbCtx.restore();
      });
      thumbCtx.restore();
    };

    // Update thumbnail whenever changes happen
    const handleLocalDraw = () => updateThumbnail();
    window.addEventListener('local-draw', handleLocalDraw);

    // Initialization polling
    const checkCanvas = () => {
      const canvas = fabricCanvas.current;
      if (canvas && !canvas.hasListeners('object:added')) {
        canvas.on('object:added', updateThumbnail);
        canvas.on('object:modified', updateThumbnail);
        canvas.on('object:removed', updateThumbnail);
        updateThumbnail();
      }
    };
    const pollId = setInterval(checkCanvas, 1000);

    const drawViewport = () => {
      const canvas = fabricCanvas.current;
      const miniCtx = minimapRef.current?.getContext('2d');
      if (!canvas || !miniCtx || !minimapRef.current || !thumbnailCanvasRef.current) return;

      const canvasW = canvas.getWidth();
      const canvasH = canvas.getHeight();
      
      // Draw static thumbnail
      miniCtx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
      miniCtx.drawImage(thumbnailCanvasRef.current, 0, 0);

      // Draw blue viewport rectangle
      const vpt = canvas.viewportTransform;
      if (vpt) {
        const scaleX = MINIMAP_WIDTH / canvasW;
        const scaleY = MINIMAP_HEIGHT / canvasH;
        const zoom = canvas.getZoom();
        const vpW = canvasW / zoom;
        const vpH = canvasH / zoom;
        const vpX = -vpt[4] / zoom;
        const vpY = -vpt[5] / zoom;

        miniCtx.strokeStyle = '#6366f1';
        miniCtx.lineWidth = 2;
        miniCtx.setLineDash([]);
        miniCtx.strokeRect(
          vpX * scaleX,
          vpY * scaleY,
          vpW * scaleX,
          vpH * scaleY
        );
        
        // Fill semi-transparent outside viewport
        miniCtx.fillStyle = 'rgba(99, 102, 241, 0.05)';
        miniCtx.fillRect(vpX * scaleX, vpY * scaleY, vpW * scaleX, vpH * scaleY);
      }

      rafRef.current = requestAnimationFrame(drawViewport);
    };

    rafRef.current = requestAnimationFrame(drawViewport);

    return () => {
      window.removeEventListener('local-draw', handleLocalDraw);
      clearInterval(pollId);
      const canvas = fabricCanvas.current;
      if (canvas) {
        canvas.off('object:added', updateThumbnail);
        canvas.off('object:modified', updateThumbnail);
        canvas.off('object:removed', updateThumbnail);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fabricCanvas]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = fabricCanvas.current;
    if (!canvas || !minimapRef.current) return;

    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvasW = canvas.getWidth();
    const scaleX = MINIMAP_WIDTH / canvasW;
    const scaleY = MINIMAP_HEIGHT / canvas.getHeight();

    const worldX = clickX / scaleX;
    const worldY = clickY / scaleY;

    const zoom = canvas.getZoom();
    canvas.setViewportTransform([
      zoom, 0, 0, zoom,
      -worldX * zoom + canvasW / 2,
      -worldY * zoom + canvas.getHeight() / 2,
    ]);
    canvas.requestRenderAll();
  };

  return (
    <div className="absolute bottom-24 right-4 sm:right-6 z-20 flex flex-col items-end gap-1">
      <button
        onClick={() => setIsVisible((v) => !v)}
        title={isVisible ? 'Hide Minimap' : 'Show Minimap'}
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-lg border border-white/60 dark:border-gray-700/50 rounded-full p-2 text-gray-400 hover:text-indigo-600 transition-colors"
      >
        <Map size={16} />
      </button>

      {isVisible && (
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-3xl shadow-2xl border border-white/60 dark:border-gray-700/50 rounded-2xl overflow-hidden ring-1 ring-black/5">
          <div className="px-2.5 pt-2 pb-1 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 ">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Live View</span>
            </div>
          </div>
          <canvas
            ref={minimapRef}
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            onClick={handleMinimapClick}
            className="block cursor-crosshair"
          />
        </div>
      )}
    </div>
  );
}
