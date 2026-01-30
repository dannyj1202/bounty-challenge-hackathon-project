import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { user as userApi } from '../api/client';

const WIDGET_OPTIONS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'tasks', label: 'Tasks / Assignments' },
  { id: 'copilot', label: 'Copilot chat' },
];

export default function Settings() {
  const { userId } = useAuth();
  const [widgets, setWidgets] = useState(WIDGET_OPTIONS.map((w) => w.id));
  const [notifications, setNotifications] = useState({ email: true, push: false });
  const [monetizationAck, setMonetizationAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const toggleWidget = (id) => {
    setWidgets((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
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

  return (
    <div>
      <h2>Settings</h2>
      <div className="card">
        <h3>Widget toggles</h3>
        <p>Choose which widgets appear on your Home dashboard.</p>
        <ul className="widget-list">
          {WIDGET_OPTIONS.map((w) => (
            <li key={w.id}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={widgets.includes(w.id)} onChange={() => toggleWidget(w.id)} />
                {w.label}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>Notification preferences</h3>
        <ul className="widget-list">
          <li>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!notifications.email} onChange={(e) => setNotifications((n) => ({ ...n, email: e.target.checked }))} />
              Email notifications
            </label>
          </li>
          <li>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!notifications.push} onChange={(e) => setNotifications((n) => ({ ...n, push: e.target.checked }))} />
              Push notifications
            </label>
          </li>
        </ul>
      </div>
      <div className="card">
        <h3>Monetization</h3>
        <p>Smart Study Copilot may offer optional premium features or institutional licensing. Your data is used only to improve the service and is never sold. University insights are aggregated and anonymized.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={monetizationAck} onChange={(e) => setMonetizationAck(e.target.checked)} />
          I have read the above
        </label>
      </div>
      <button type="button" className="btn" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save preferences'}</button>
      {saved && <p style={{ color: 'var(--success)' }}>Saved.</p>}
    </div>
  );
}
