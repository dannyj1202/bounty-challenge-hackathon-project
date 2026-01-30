import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Quiz from './pages/Quiz';
import Notes from './pages/Notes';
import Community from './pages/Community';
import Insights from './pages/Insights';
import Settings from './pages/Settings';


function PrivateRoute({ children, adminOnly }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/home" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
      <Route path="/calendar" element={<PrivateRoute><Layout><Calendar /></Layout></PrivateRoute>} />
      <Route path="/quiz" element={<PrivateRoute><Layout><Quiz /></Layout></PrivateRoute>} />
      <Route path="/notes" element={<PrivateRoute><Layout><Notes /></Layout></PrivateRoute>} />
      <Route path="/community" element={<PrivateRoute><Layout><Community /></Layout></PrivateRoute>} />
      <Route path="/insights" element={<PrivateRoute adminOnly><Layout><Insights /></Layout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
    </Routes>
  );
}