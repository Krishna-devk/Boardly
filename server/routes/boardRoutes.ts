import express from 'express';
import { createBoard, getBoards, getBoardById, deleteBoard, toggleLockBoard, renameBoard } from '../controllers/boardController.ts';
import { protect } from '../middleware/authMiddleware.ts';

const router = express.Router();

router.route('/').post(protect, createBoard).get(protect, getBoards);
router.route('/:id').get(getBoardById).delete(protect, deleteBoard);
router.route('/:id/lock').put(protect, toggleLockBoard);
router.route('/:id/rename').put(protect, renameBoard);

export default router;
