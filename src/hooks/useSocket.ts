import { useEffect } from 'react';
import { getSocket, disconnectSocket } from '../services/socket.ts';
import { useAuthStore } from '../store/authStore.ts';

export const useSocket = (boardId: string) => {
  const { user } = useAuthStore();
  const socket = getSocket();

  useEffect(() => {
    if (boardId) {
      const userId = user?._id || `anon-${Math.random().toString(36).substr(2, 9)}`;
      socket.emit('join-board', boardId, userId);
    }

    return () => {
      // Don't disconnect socket completely, just leave room if needed
      // but for simplicity we can just let it be or emit leave
    };
  }, [boardId, user, socket]);

  return socket;
};
