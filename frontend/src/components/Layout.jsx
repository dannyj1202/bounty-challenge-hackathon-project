import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/home', label: 'Home' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/notes', label: 'Notes' },
  { to: '/community', label: 'Community' },
  { to: '/insights', label: 'Insights (Admin)' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Smart Study Copilot</h1>
        <nav className="app-nav">
          {nav.filter(({ to }) => to !== '/insights' || isAdmin).map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>
          ))}
          <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{user?.email}</span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>Logout</button>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
