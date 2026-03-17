import { Request, Response } from 'express';
import { Board } from '../models/Board.ts';
import { AuthRequest } from '../middleware/authMiddleware.ts';

export const createBoard = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const board = new Board({
      name: name || 'Untitled Board',
      owner: req.user._id,
      collaborators: [],
      elements: {},
      isLocked: false,
    });
    const createdBoard = await board.save();
    res.status(201).json(createdBoard);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getBoards = async (req: AuthRequest, res: Response) => {
  try {
    const boards = await Board.find({
      $or: [{ owner: req.user._id }, { collaborators: req.user._id }],
    }).sort({ updatedAt: -1 });
    res.json(boards);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getBoardById = async (req: Request, res: Response) => {
  try {
    const board = await Board.findById(req.params.id).populate('owner', 'name email');
    if (board) {
      res.json(board);
    } else {
      res.status(404).json({ message: 'Board not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteBoard = async (req: AuthRequest, res: Response) => {
  try {
    const board = await Board.findById(req.params.id);
    if (board) {
      if (board.owner.toString() !== req.user._id.toString()) {
        res.status(401).json({ message: 'Not authorized to delete this board' });
        return;
      }
      await board.deleteOne();
      res.json({ message: 'Board removed' });
    } else {
      res.status(404).json({ message: 'Board not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleLockBoard = async (req: AuthRequest, res: Response) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) {
      res.status(404).json({ message: 'Board not found' });
      return;
    }
    if (board.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Only the board owner can lock/unlock the board' });
      return;
    }
    board.isLocked = !board.isLocked;
    await board.save();
    res.json({ isLocked: board.isLocked });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const renameBoard = async (req: AuthRequest, res: Response) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) {
      res.status(404).json({ message: 'Board not found' });
      return;
    }
    if (board.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Only the board owner can rename the board' });
      return;
    }
    board.name = req.body.name || board.name;
    await board.save();
    res.json({ name: board.name });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
