import React from 'react';
import { useBoardStore } from '../../store/boardStore.ts';
import { useAuthStore } from '../../store/authStore.ts';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Plus, LayoutDashboard, Moon, Sun } from 'lucide-react';
import api from '../../services/api.ts';
import { useDarkModeStore } from '../../store/darkModeStore.ts';

export function Sidebar() {
  const { boards, setBoards, addBoard } = useBoardStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { isDark, toggleDarkMode } = useDarkModeStore();

  const handleCreateBoard = async () => {
    try {
      const res = await api.post('/boards', { name: 'Untitled Board' });
      addBoard(res.data);
      navigate(`/board/${res.data._id}`);
    } catch (error) {
      console.error('Error creating board', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-sm transition-colors duration-200">
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
            <Link
              key={board._id}
              to={`/board/${board._id}`}
              className="flex items-center gap-3 px-3 py-2.5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            >
              <LayoutDashboard size={18} className="text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
              <span className="font-medium truncate">{board.name}</span>
            </Link>
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
