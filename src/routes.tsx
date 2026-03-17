import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.tsx';
import Board from './pages/Board.tsx';
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import { useAuthStore } from './store/authStore.ts';

type Props = { children: React.ReactNode };

const PrivateRoute = ({ children }: Props) => {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/board/:id"
        element={<Board />}
      />
    </Routes>
  );
}
