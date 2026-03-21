import React, { useEffect } from 'react';
import { Sidebar } from '../components/ui/Sidebar.tsx';
import { useBoardStore } from '../store/boardStore.ts';
import api from '../services/api.ts';
import { LayoutDashboard } from 'lucide-react';

export default function Home() {
  const { setBoards } = useBoardStore();

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const res = await api.get('/boards');
        setBoards(res.data);
      } catch (error) {
        console.error('Failed to fetch boards', error);
      }
    };
    fetchBoards();
  }, [setBoards]);

  return (
    <div className="flex h-screen bg-[var(--background)] transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 shadow-sm">
          <LayoutDashboard size={48} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Welcome to Boardly</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md text-lg">
          Select a board from the sidebar or create a new one to start collaborating in real-time.
        </p>
      </div>
    </div>
  );
}
