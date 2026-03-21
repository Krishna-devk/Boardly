import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from './events.ts';
import { updateBoardElements } from '../services/boardService.ts';
import { logger } from '../utils/logger.ts';

export const setupSocket = (io: Server) => {
  io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
    logger.info(`User connected: ${socket.id}`);

    socket.on(SOCKET_EVENTS.JOIN_BOARD, (boardId: string, userId: string) => {
      socket.join(boardId);
      logger.info(`User ${userId} joined board ${boardId}`);
      socket.to(boardId).emit('user-joined', { userId, socketId: socket.id });
    });

    socket.on(SOCKET_EVENTS.DRAW, (data: { boardId: string; elements: any }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.DRAW, data.elements);
      updateBoardElements(data.boardId, data.elements);
    });

    socket.on(SOCKET_EVENTS.CURSOR_MOVE, (data: { boardId: string; cursor: any; userId: string; userName?: string }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.CURSOR_MOVE, {
        userId: data.userId,
        cursor: data.cursor,
        userName: data.userName,
      });
    });

    socket.on(SOCKET_EVENTS.UNDO, (data: { boardId: string; elements: any }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.UNDO, data.elements);
      updateBoardElements(data.boardId, data.elements);
    });

    socket.on(SOCKET_EVENTS.REDO, (data: { boardId: string; elements: any }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.REDO, data.elements);
      updateBoardElements(data.boardId, data.elements);
    });

    socket.on(SOCKET_EVENTS.LOCK_BOARD, (data: { boardId: string; isLocked: boolean }) => {
      // Broadcast lock state to everyone in the room (including sender for confirmation)
      io.in(data.boardId).emit(SOCKET_EVENTS.LOCK_BOARD, { isLocked: data.isLocked });
      logger.info(`Board ${data.boardId} ${data.isLocked ? 'locked' : 'unlocked'}`);
    });

    socket.on(SOCKET_EVENTS.BOARD_RENAMED, (data: { boardId: string; name: string }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.BOARD_RENAMED, { name: data.name });
      logger.info(`Board ${data.boardId} renamed to ${data.name}`);
    });
    
    socket.on(SOCKET_EVENTS.REACTION, (data: { boardId: string; userId: string; emoji: string; x: number; y: number }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.REACTION, { userId: data.userId, emoji: data.emoji, x: data.x, y: data.y });
    });
    
    socket.on(SOCKET_EVENTS.LASER_DRAG, (data: { boardId: string; userId: string; x: number; y: number }) => {
      socket.to(data.boardId).emit(SOCKET_EVENTS.LASER_DRAG, { userId: data.userId, x: data.x, y: data.y });
    });

    socket.on(SOCKET_EVENTS.SPOTLIGHT, (data: { boardId: string; vpt: number[]; zoom: number }) => {
      // Broadcast presenter's viewport transform to all other users
      socket.to(data.boardId).emit(SOCKET_EVENTS.SPOTLIGHT, { vpt: data.vpt, zoom: data.zoom });
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      logger.info(`User disconnected: ${socket.id}`);
    });
  });
};
