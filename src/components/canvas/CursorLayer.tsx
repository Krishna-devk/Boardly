import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket.ts';
import throttle from 'lodash/throttle';
import { useAuthStore } from '../../store/authStore.ts';

interface CursorLayerProps {
  boardId: string;
  isOwner: boolean;
}

interface LaserPoint {
  x: number;
  y: number;
  timestamp: number;
}

export default function CursorLayer({ boardId, isOwner }: CursorLayerProps) {
  const socket = useSocket(boardId);
  const { user } = useAuthStore();
  const [cursors, setCursors] = useState<{ [key: string]: { x: number; y: number; userName?: string } }>({});
  const [laserTrails, setLaserTrails] = useState<{ [key: string]: LaserPoint[] }>({});
  const [isLaserActive, setIsLaserActive] = useState(false);
  const lastEmitPos = useRef({ x: 0, y: 0 });

  const throttledEmitCursor = useMemo(
    () => throttle((cursor: { x: number; y: number }, type: 'move' | 'laser' = 'move') => {
      const name = isOwner ? user?.name : undefined;
      if (type === 'move') {
        socket.emit('cursor-move', { boardId, cursor, userId: socket.id, userName: name });
      } else {
        socket.emit('laser-drag', { boardId, userId: socket.id, x: cursor.x, y: cursor.y });
      }
    }, 40),
    [boardId, socket, isOwner, user?.name]
  );

  useEffect(() => {
    socket.on('cursor-move', (data: { userId: string; cursor: { x: number; y: number }; userName?: string }) => {
      if (data.userId === socket.id) return;
      setCursors((prev) => ({
        ...prev,
        [data.userId]: { ...data.cursor, userName: data.userName },
      }));
    });

    socket.on('laser-drag', (data: { userId: string; x: number; y: number }) => {
      if (data.userId === socket.id) return;
      setLaserTrails((prev) => {
        const trail = prev[data.userId] || [];
        const newTrail = [...trail, { x: data.x, y: data.y, timestamp: Date.now() }];
        return { ...prev, [data.userId]: newTrail.slice(-20) };
      });
    });

    const handleMouseMove = (e: MouseEvent) => {
      const pos = { x: e.clientX, y: e.clientY };
      lastEmitPos.current = pos;

      if (isLaserActive) {
        throttledEmitCursor(pos, 'laser');
        setLaserTrails((prev) => {
          const trail = prev[socket.id] || [];
          return { ...prev, [socket.id]: [...trail, { ...pos, timestamp: Date.now() }].slice(-20) };
        });
      } else {
        throttledEmitCursor(pos, 'move');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) return;

      // Hold L for laser pointer
      if (e.key.toLowerCase() === 'l' && !e.repeat) {
        setIsLaserActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l') {
        setIsLaserActive(false);
      }
    };

    const handleDocClick = (e: MouseEvent) => {};

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleDocClick);

    return () => {
      socket.off('cursor-move');
      socket.off('laser-drag');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleDocClick);
      throttledEmitCursor.cancel();
    };
  }, [socket, boardId, throttledEmitCursor, isLaserActive]);

  // Cleanup old laser trails
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setLaserTrails((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((userId) => {
          const filtered = (next[userId] as LaserPoint[]).filter((p) => now - p.timestamp < 800);
          if (filtered.length !== next[userId].length) { next[userId] = filtered; changed = true; }
          if (filtered.length === 0) { delete next[userId]; changed = true; }
        });
        return changed ? next : prev;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {/* Laser Trails */}
      <svg className="absolute inset-0 w-full h-full">
        {Object.entries(laserTrails).map(([userId, trail]) => {
          const typedTrail = trail as LaserPoint[];
          if (typedTrail.length < 2) return null;
          const points = typedTrail.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <g key={`laser-${userId}`}>
              {/* Glow layer */}
              <polyline
                points={points}
                fill="none"
                stroke={userId === socket.id ? '#f87171' : '#818cf8'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.3, filter: 'blur(6px)' }}
              />
              {/* Core line */}
              <polyline
                points={points}
                fill="none"
                stroke={userId === socket.id ? '#ef4444' : '#6366f1'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.85 }}
              />
            </g>
          );
        })}
      </svg>

      {/* Cursors */}
      {Object.entries(cursors).map(([userId, pos]: [string, any]) => (
        <div
          key={userId}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75 ease-linear"
          style={{ left: pos.x, top: pos.y }}
        >
          {/* Custom cursor dot */}
          <div className="w-3.5 h-3.5 bg-indigo-500 rounded-full shadow-[0_0_0_3px_rgba(99,102,241,0.25)] ring-2 ring-white" />
          <span className="absolute left-5 top-0 text-xs font-semibold text-white bg-indigo-500 px-2 py-0.5 rounded-full whitespace-nowrap shadow-md -translate-y-1/2">
            {pos.userName ? pos.userName : `Guest ${userId.substring(0, 4)}`}
          </span>
        </div>
      ))}

      {/* Laser hint — subtle fixed at bottom */}

      {/* Laser hint — subtle */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400/50 dark:text-gray-600/50 whitespace-nowrap">
        Hold <span className="font-mono">L</span> for laser pointer
      </div>
    </div>
  );
}
