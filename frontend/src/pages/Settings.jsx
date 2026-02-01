import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { user as userApi, auth as authApi } from '../api/client';
import { UserCircle, LayoutDashboard, Bell, DollarSign, Palette } from 'lucide-react';

const WIDGET_OPTIONS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'tasks', label: 'Tasks / Assignments' },
  { id: 'copilot', label: 'Copilot chat' },
];

export default function Settings() {
  const { userId, user, login } = useAuth();
  const { plan, isInstitutionAdmin, institutionBranding, setInstitutionBranding } = usePlan();
  const [searchParams, setSearchParams] = useSearchParams();
  const [msStatus, setMsStatus] = useState({ connected: false, username: null, expiresAt: null });
  const [widgets, setWidgets] = useState(WIDGET_OPTIONS.map((w) => w.id));
  const [notifications, setNotifications] = useState({ email: true, push: false });
  const [monetizationAck, setMonetizationAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [brandingName, setBrandingName] = useState(institutionBranding?.name || '');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState(institutionBranding?.logoUrl || '');
  const [brandingColor, setBrandingColor] = useState(institutionBranding?.primaryColor || '#0078d4');
  const [brandingSaved, setBrandingSaved] = useState(false);

  useEffect(() => {
    const ms = searchParams.get('ms');
    const callbackUserId = searchParams.get('userId');
    const callbackToken = searchParams.get('token');
    const callbackEmail = searchParams.get('email');
    const callbackRole = searchParams.get('role') || 'student';
    if (ms === 'connected') {
      if (callbackUserId && callbackToken) {
        login(
          { id: callbackUserId, email: callbackEmail || '', role: callbackRole },
          callbackToken
        );
      }
      setSearchParams({});
    }
  }, [searchParams, login, setSearchParams]);

  useEffect(() => {
    if (!userId) return;
    authApi.getMicrosoftStatus(userId).then(setMsStatus).catch(() => setMsStatus({ connected: false, username: null, expiresAt: null }));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    userApi.getPreferences(userId).then((p) => {
      try {
        const w = JSON.parse(p.widgets || '[]');
        if (Array.isArray(w)) setWidgets(w);
      } catch {}
      try {
        const n = typeof p.notifications === 'string' ? JSON.parse(p.notifications || '{}') : p.notifications || {};
        setNotifications(n);
      } catch {}
      setMonetizationAck(!!p.monetizationAck);
    }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    setBrandingName(institutionBranding?.name || '');
    setBrandingLogoUrl(institutionBranding?.logoUrl || '');
    setBrandingColor(institutionBranding?.primaryColor || '#0078d4');
  }, [institutionBranding]);

  const toggleWidget = (id) => {
    const next = widgets.includes(id) ? widgets.filter((w) => w !== id) : [...widgets, id];
    setWidgets(next);
    if (userId) {
      userApi.putPreferences({ userId, widgets: next, notifications, monetizationAck }).catch(() => {});
    }
  };

  const save = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await userApi.putPreferences({ userId, widgets, notifications, monetizationAck });
      setSaved(true);
    } finally {
      setLoading(false);
    }
  };

  const saveBranding = () => {
    setInstitutionBranding({
      name: brandingName.trim(),
      logoUrl: brandingLogoUrl.trim(),
      primaryColor: brandingColor.trim() || '#0078d4',
    });
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2000);
  };

  const cardBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const cardTitle = 'text-gray-900 dark:text-white font-semibold text-base';
  const cardMuted = 'text-gray-800 dark:text-gray-400 text-sm';

  return (
    <div className="min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white max-w-3xl mx-auto px-6 py-8 transition-colors duration-200">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Manage your account, preferences, and notifications.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="shrink-0 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] disabled:opacity-50"
            onClick={save}
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Save preferences'}
          </button>
          {saved && <span className="text-emerald-400 text-sm whitespace-nowrap">Saved.</span>}
        </div>
      </div>

      {/* Microsoft account */}
      <div className={`${cardBase} p-6 mb-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <img
            src="/microsoft-logo.png"
            alt=""
            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl object-contain bg-white dark:bg-white/5 ring-1 ring-gray-200 dark:ring-violet-500/20"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className={`${cardTitle} flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-200 dark:border-violet-500/20`}>
              <div className="p-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                <UserCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden />
              </div>
              Microsoft account
            </h3>
            {msStatus.connected ? (
              <p className="text-gray-800 dark:text-gray-300 text-sm">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Microsoft connected</span>
                {msStatus.username && <span className="ml-2">— {msStatus.username}</span>}
                {msStatus.expiresAt && (
                  <span className="block text-gray-700 dark:text-gray-500 text-xs mt-2">
                    Token expires: {new Date(msStatus.expiresAt).toLocaleString()}
                  </span>
                )}
              </p>
            ) : userId ? (
              <p className="text-gray-800 dark:text-gray-300 text-sm mb-3">
                <span className="text-gray-700 dark:text-gray-500">Not connected</span>
              </p>
            ) : (
              <p className="text-gray-800 dark:text-gray-500 text-sm mb-3">Sign in to link your Microsoft account.</p>
            )}
            {userId && !msStatus.connected && (
              <a
                href={authApi.getMicrosoftLoginUrl(userId)}
                className="inline-flex px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
              >
                Connect Microsoft
              </a>
            )}
          </div>
        </div>
      </div>

      <p className={`${cardMuted} mb-6`}>
        Current plan: <strong className="text-gray-900 dark:text-white">{plan === 'free' ? 'Free' : plan === 'elite' ? 'Elite' : 'Institution'}</strong>
        {' — '}
        <Link to="/pricing" className="text-violet-700 dark:text-violet-300 hover:text-violet-800 dark:hover:text-violet-200 font-medium transition-colors">View plans & switch</Link>
      </p>

      {isInstitutionAdmin && (
        <div className={`${cardBase} p-6 mb-6`}>
          <h3 className={`${cardTitle} flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-200 dark:border-violet-500/20`}>
            <div className="p-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
              <Palette className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden />
            </div>
            White-label branding (Institution)
          </h3>
          <p className={`${cardMuted} mb-4`}>
            Customize the app name, logo, and primary theme color for all users under your institution.
          </p>
          <div className="form-group mb-4">
            <label className="block text-gray-800 dark:text-gray-300 text-sm font-medium mb-1">Institution name</label>
            <input type="text" value={brandingName} onChange={(e) => setBrandingName(e.target.value)} placeholder="e.g. My University" className="w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200" />
          </div>
          <div className="form-group mb-4">
            <label className="block text-gray-800 dark:text-gray-300 text-sm font-medium mb-1">Logo URL</label>
            <input type="url" value={brandingLogoUrl} onChange={(e) => setBrandingLogoUrl(e.target.value)} placeholder="https://..." className="w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200" />
          </div>
          <div className="form-group mb-4">
            <label className="block text-gray-800 dark:text-gray-300 text-sm font-medium mb-1">Primary theme color</label>
            <div className="flex gap-3 items-center">
              <input type="color" value={brandingColor} onChange={(e) => setBrandingColor(e.target.value)} className="w-12 h-10 rounded-lg border border-violet-500/30 cursor-pointer bg-black/30" />
              <input type="text" value={brandingColor} onChange={(e) => setBrandingColor(e.target.value)} placeholder="#0078d4" className="w-28 py-2 px-3 rounded-xl bg-black/30 border border-violet-500/30 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm" />
            </div>
          </div>
          <button type="button" className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]" onClick={saveBranding}>
            Apply branding
          </button>
          {brandingSaved && <span className="ml-3 text-emerald-400 text-sm">Saved.</span>}
        </div>
      )}

      {/* Widget toggles */}
      <div className={`${cardBase} p-6 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2.5 mb-2 pb-3 border-b border-gray-200 dark:border-violet-500/20`}>
          <div className="p-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <LayoutDashboard className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          Widget toggles
        </h3>
        <p className={`${cardMuted} mb-4`}>Choose which widgets appear on your Home dashboard.</p>
        <ul className="space-y-3 list-none p-0 m-0">
          {WIDGET_OPTIONS.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-100/80 dark:hover:bg-violet-500/5 transition-colors">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={widgets.includes(w.id)}
                  onChange={() => toggleWidget(w.id)}
                  className="w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-500 bg-transparent text-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#16161d] accent-violet-500"
                />
                <span className="text-gray-800 dark:text-gray-300 text-sm font-medium">{w.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Notification preferences */}
      <div className={`${cardBase} p-6 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2.5 mb-2 pb-3 border-b border-gray-200 dark:border-violet-500/20`}>
          <div className="p-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <Bell className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          Notification preferences
        </h3>
        <ul className="space-y-0 list-none p-0 m-0">
          <li className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-100/80 dark:hover:bg-violet-500/5 transition-colors">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input type="checkbox" checked={!!notifications.email} onChange={(e) => setNotifications((n) => ({ ...n, email: e.target.checked }))} className="w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-500 bg-transparent text-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 accent-violet-500" />
              <span className="text-gray-800 dark:text-gray-300 text-sm">Email notifications</span>
            </label>
          </li>
          <li className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-100/80 dark:hover:bg-violet-500/5 transition-colors">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input type="checkbox" checked={!!notifications.push} onChange={(e) => setNotifications((n) => ({ ...n, push: e.target.checked }))} className="w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-500 bg-transparent text-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 accent-violet-500" />
              <span className="text-gray-800 dark:text-gray-300 text-sm">Push notifications</span>
            </label>
          </li>
        </ul>
      </div>

      {/* Monetization */}
      <div className={`${cardBase} p-6 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2.5 mb-2 pb-3 border-b border-gray-200 dark:border-violet-500/20`}>
          <div className="p-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <DollarSign className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          Monetization
        </h3>
        <p className={`${cardMuted} text-sm mb-4 leading-relaxed`}>
          Smart Study Copilot may offer optional premium features or institutional licensing. Your data is used only to improve the service and is never sold. University insights are aggregated and anonymized.
        </p>
        <label className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg hover:bg-gray-100/80 dark:hover:bg-violet-500/5 transition-colors">
          <input type="checkbox" checked={monetizationAck} onChange={(e) => setMonetizationAck(e.target.checked)} className="w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-500 bg-transparent text-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 accent-violet-500" />
          <span className="text-gray-800 dark:text-gray-300 text-sm">I have read the above</span>
        </label>
      </div>

    </div>
  );
}
