import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import ThemeToggle from './ThemeToggle';
import { LayoutDashboard, Calendar, HelpCircle, FileText, Users, BarChart3, Tag, Settings } from 'lucide-react';

const nav = [
  { to: '/home', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', Icon: Calendar },
  { to: '/quiz', label: 'Quiz', Icon: HelpCircle },
  { to: '/notes', label: 'Notes', Icon: FileText },
  { to: '/community', label: 'Community', Icon: Users },
  { to: '/insights', label: 'Insights (Admin)', Icon: BarChart3 },
  { to: '/pricing', label: 'Pricing', Icon: Tag },
  { to: '/settings', label: 'Settings', Icon: Settings },
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
  const filteredNav = nav.filter(({ to }) => to !== '/insights' || showInsights);
  const appName = institutionBranding?.name?.trim() || 'ECStudy';

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white flex transition-colors duration-200">
      {/* Left sidebar - fixed */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-gray-200 dark:border-violet-900/30 bg-gray-50 dark:bg-[#0d0d12] transition-colors duration-200">
        <div className="p-5 border-b border-gray-200 dark:border-violet-900/20">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/ecstudy-logo.png" alt="" className="w-9 h-9 shrink-0 rounded-lg object-contain" aria-hidden />
            <span className="font-semibold text-gray-900 dark:text-white tracking-tight truncate">{appName}</span>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {filteredNav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 border-l-2 border-l-violet-500 dark:border-l-violet-400 -ml-px pl-3 shadow-[0_0_20px_rgba(139,92,246,0.12)]'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400/80" aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-violet-900/20 space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/microsoft-logo.png"
              alt=""
              className="w-6 h-6 shrink-0 rounded-lg object-contain bg-white dark:bg-white/5 ring-1 ring-gray-200 dark:ring-violet-500/20"
              aria-hidden
            />
            <p className="text-xs text-gray-800 dark:text-gray-500 truncate min-w-0" title={user?.email}>{user?.email}</p>
          </div>
          <span className="inline-block text-xs px-2 py-1 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-200">
            {plan === 'free' ? 'Free' : plan === 'elite' ? 'Elite' : 'Institution'}
          </span>
          <div className="flex items-center gap-2 mt-2">
            <ThemeToggle />
            <span className="text-xs text-gray-600 dark:text-gray-500">Theme</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto bg-white dark:bg-[#0a0a0f] transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}
