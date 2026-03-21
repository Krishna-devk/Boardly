import React, { useState } from 'react';
import { useBoardStore } from '../../store/boardStore.ts';
import { useAuthStore } from '../../store/authStore.ts';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Plus, LayoutDashboard, Moon, Sun, Trash2, Edit2, Check, X } from 'lucide-react';
import api from '../../services/api.ts';
import { useDarkModeStore } from '../../store/darkModeStore.ts';

export function Sidebar() {
  const { boards, setBoards, addBoard, updateBoard, removeBoard } = useBoardStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { isDark, toggleDarkMode } = useDarkModeStore();

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateBoard = async () => {
    try {
      const res = await api.post('/boards', { name: 'Untitled Board' });
      addBoard(res.data);
      navigate(`/board/${res.data._id}`);
    } catch (error) {
      console.error('Error creating board', error);
    }
  };

  const handleDeleteBoard = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this board?')) return;
    try {
      await api.delete(`/boards/${id}`);
      removeBoard(id);
      navigate('/');
    } catch (error) {
      console.error('Error deleting board', error);
    }
  };

  const startEditing = (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    setEditingBoardId(id);
    setEditingName(name);
  };

  const saveRename = async (id: string) => {
    if (!editingName.trim()) {
      setEditingBoardId(null);
      return;
    }
    try {
      await api.put(`/boards/${id}/rename`, { name: editingName });
      updateBoard(id, editingName);
      setEditingBoardId(null);
    } catch (error) {
      console.error('Error renaming board', error);
      setEditingBoardId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-68 h-screen glass border-r border-[var(--border)] flex flex-col shadow-premium transition-all duration-300">
      <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            B
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Boardly</h1>
        </div>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="p-4">
        <button
          onClick={handleCreateBoard}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Board
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">
          Your Boards
        </div>
        <div className="space-y-1">
          {boards.map((board) => (
            <div key={board._id} className="relative group rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center">
              {editingBoardId === board._id ? (
                <div className="flex items-center w-full px-3 py-2 gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename(board._id);
                      if (e.key === 'Escape') setEditingBoardId(null);
                    }}
                    className="flex-1 bg-white dark:bg-gray-900 border border-indigo-500 rounded px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button onClick={() => saveRename(board._id)} className="text-green-600 hover:text-green-700 p-1">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditingBoardId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to={`/board/${board._id}`}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 text-gray-700 dark:text-gray-300 overflow-hidden"
                  >
                    <LayoutDashboard size={18} className="text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                    <span className="font-medium truncate">{board.name}</span>
                  </Link>
                  <div className="hidden group-hover:flex items-center gap-1 pr-2 absolute right-0 bg-gray-100 dark:bg-gray-800 py-2 pl-3 rounded-r-xl border-l border-transparent">
                    <button
                      onClick={(e) => startEditing(board._id, board.name, e)}
                      className="p-1 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                      title="Rename"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteBoard(board._id, e)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-32">{user?.email}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
