import { Board } from '../models/Board.ts';

export const updateBoardElements = async (boardId: string, elements: any) => {
  try {
    await Board.findByIdAndUpdate(boardId, { elements });
  } catch (error) {
    console.error('Error updating board elements:', error);
  }
};
