import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Whiteboard, { WhiteboardRef } from '../components/canvas/Whiteboard.tsx';
import { Toolbar } from '../components/ui/Toolbar.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { Button } from '../components/ui/Button.tsx';
import api from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';
import { getSocket } from '../services/socket.ts';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

export default function Board() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [boardName, setBoardName] = useState('Loading...');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const whiteboardRef = useRef<WhiteboardRef>(null);

  useEffect(() => {
    if (id) {
      api.get(`/boards/${id}`).then((res) => {
        setBoardName(res.data.name);
        setIsLocked(res.data.isLocked || false);
        // Check if current user is the owner
        const ownerId = typeof res.data.owner === 'object' ? res.data.owner._id : res.data.owner;
        setIsOwner(ownerId === user?._id);
      }).catch((err) => {
        console.error('Error loading board', err);
        navigate('/');
      });
    }
  }, [id, navigate, user]);

  // Listen for real-time lock/unlock and rename via socket
  useEffect(() => {
    const socket = getSocket();
    const handleLock = (data: { isLocked: boolean }) => {
      setIsLocked(data.isLocked);
    };
    const handleRename = (data: { name: string }) => {
      setBoardName(data.name);
    };
    socket.on('lock-board', handleLock);
    socket.on('board-renamed', handleRename);
    return () => {
      socket.off('lock-board', handleLock);
      socket.off('board-renamed', handleRename);
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleLock = async () => {
    if (!id) return;
    try {
      const res = await api.put(`/boards/${id}/lock`);
      const newLockState = res.data.isLocked;
      setIsLocked(newLockState);
      // Broadcast lock state via socket
      const socket = getSocket();
      socket.emit('lock-board', { boardId: id, isLocked: newLockState });
    } catch (err) {
      console.error('Error toggling lock', err);
    }
  };

  const handleRename = async (newName: string) => {
    if (!id || !isOwner) return;
    try {
      const res = await api.put(`/boards/${id}/rename`, { name: newName });
      setBoardName(res.data.name);
      const socket = getSocket();
      socket.emit('board-renamed', { boardId: id, name: res.data.name });
    } catch (err) {
      console.error('Error renaming board', err);
    }
  };

  if (!id) return null;

  // Determine if drawing is disabled: board is locked AND the user is NOT the owner
  const isDrawingDisabled = isLocked && !isOwner;

  return (
    <div className="w-full h-screen relative bg-gray-50 dark:bg-gray-950 overflow-hidden transition-colors duration-200">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/')}
        className="absolute top-5 sm:top-6 left-5 sm:left-6 z-50 flex items-center gap-2.5 px-3 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 dark:border-gray-700/50 rounded-[28px] text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group ring-1 ring-black/5 dark:ring-white/10"
      >
        <ArrowLeft size={16} className="transform transition-transform group-hover:-translate-x-0.5" />

      </motion.button>

      <Toolbar
        boardName={boardName}
        boardId={id}
        onShare={() => setIsShareModalOpen(true)} 
        onDownload={() => whiteboardRef.current?.downloadImage()}
        isOwner={isOwner}
        isLocked={isLocked}
        onToggleLock={handleToggleLock}
        onRename={handleRename}
      />

      {isDrawingDisabled && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-6 py-3 rounded-2xl shadow-lg backdrop-blur-md border border-amber-200 dark:border-amber-700 font-medium text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Board is locked by the owner — view only
        </div>
      )}

      <Whiteboard ref={whiteboardRef} boardId={id} isDrawingDisabled={isDrawingDisabled} />

      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share Board">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Anyone with this link can join and collaborate on this board in real-time.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={window.location.href}
              className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button onClick={handleCopyLink} className="h-12 px-6">
              {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
