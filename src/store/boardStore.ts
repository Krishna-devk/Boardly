import { create } from 'zustand';

interface BoardState {
  boards: any[];
  currentBoard: any | null;
  setBoards: (boards: any[]) => void;
  setCurrentBoard: (board: any) => void;
  addBoard: (board: any) => void;
  removeBoard: (id: string) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  currentBoard: null,
  setBoards: (boards) => set({ boards }),
  setCurrentBoard: (board) => set({ currentBoard: board }),
  addBoard: (board) => set((state) => ({ boards: [board, ...state.boards] })),
  removeBoard: (id) =>
    set((state) => ({ boards: state.boards.filter((b) => b._id !== id) })),
}));
