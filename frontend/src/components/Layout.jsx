import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';

function darkenHex(hex, percent = 12) {
  if (!hex || typeof hex !== 'string') return undefined;
  const c = hex.replace(/^#/, '');
  if (c.length !== 6) return undefined;
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - (255 * percent) / 100);
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - (255 * percent) / 100);
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - (255 * percent) / 100);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

const nav = [
  { to: '/home', label: 'Home' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/notes', label: 'Notes' },
  { to: '/community', label: 'Community' },
  { to: '/insights', label: 'Insights (Admin)' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const { canAccessInsights, institutionBranding, plan } = usePlan();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showInsights = isAdmin || canAccessInsights;
  const brandingStyle = institutionBranding?.primaryColor
    ? { '--primary': institutionBranding.primaryColor, '--primary-hover': darkenHex(institutionBranding.primaryColor) || institutionBranding.primaryColor }
    : undefined;

  const appName = institutionBranding?.name?.trim() || 'Smart Study Copilot';

  return (
    <div className="app" style={brandingStyle}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {institutionBranding?.logoUrl && (
            <img src={institutionBranding.logoUrl} alt="" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          )}
          <h1>{appName}</h1>
        </div>
        <nav className="app-nav">
          {nav.filter(({ to }) => to !== '/insights' || showInsights).map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>
          ))}
          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 14 }}>{user?.email}</span>
          <span className="plan-badge" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--border)', color: 'var(--text-muted)' }}>
            {plan === 'free' ? 'Free' : plan === 'elite' ? 'Elite' : 'Institution'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>Logout</button>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
