import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { user as userApi } from '../api/client';

const WIDGET_OPTIONS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'tasks', label: 'Tasks / Assignments' },
  { id: 'copilot', label: 'Copilot chat' },
];

export default function Settings() {
  const { userId } = useAuth();
  const { plan, isInstitutionAdmin, institutionBranding, setInstitutionBranding } = usePlan();
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

  const saveBranding = () => {
    setInstitutionBranding({
      name: brandingName.trim(),
      logoUrl: brandingLogoUrl.trim(),
      primaryColor: brandingColor.trim() || '#0078d4',
    });
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2000);
  };

  return (
    <div>
      <h2>Settings</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Current plan: <strong>{plan === 'free' ? 'Free' : plan === 'elite' ? 'Elite' : 'Institution'}</strong>
        {' — '}
        <Link to="/pricing">View plans & switch</Link>
      </p>
      {isInstitutionAdmin && (
        <div className="card">
          <h3>White-label branding (Institution)</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            Customize the app name, logo, and primary theme color for all users under your institution.
          </p>
          <div className="form-group">
            <label>Institution name</label>
            <input type="text" value={brandingName} onChange={(e) => setBrandingName(e.target.value)} placeholder="e.g. My University" />
          </div>
          <div className="form-group">
            <label>Logo URL</label>
            <input type="url" value={brandingLogoUrl} onChange={(e) => setBrandingLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Primary theme color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={brandingColor} onChange={(e) => setBrandingColor(e.target.value)} style={{ width: 48, height: 36, padding: 2, cursor: 'pointer' }} />
              <input type="text" value={brandingColor} onChange={(e) => setBrandingColor(e.target.value)} placeholder="#0078d4" style={{ width: 120 }} />
            </div>
          </div>
          <button type="button" className="btn" onClick={saveBranding}>Apply branding</button>
          {brandingSaved && <span style={{ marginLeft: 12, color: 'var(--success)' }}>Saved. Refresh the header to see changes.</span>}
        </div>
      )}
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
