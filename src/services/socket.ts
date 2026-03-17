import { io, Socket } from 'socket.io-client';
import { useSocketStore } from '../store/socketStore.ts';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(window.location.origin);
    
    // Connect to Zustand store
    useSocketStore.getState().setSocket(socket);
    
    socket.on('connect', () => {
      useSocketStore.getState().setConnected(true);
    });
    
    socket.on('disconnect', () => {
      useSocketStore.getState().setConnected(false);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    useSocketStore.getState().setSocket(null);
    useSocketStore.getState().setConnected(false);
  }
};
