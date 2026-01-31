import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const FREE_COPILOT_LIMIT = 10;
const PLAN_STORAGE_KEY = 'smart-study-plan';
const USAGE_STORAGE_KEY = 'smart-study-copilot-usage';
const BRANDING_STORAGE_KEY = 'smart-study-institution-branding';

function getStorageKey(userId, base) {
  return userId ? `${base}-${userId}` : base;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function loadUsage(userId) {
  try {
    const key = getStorageKey(userId, USAGE_STORAGE_KEY);
    const raw = localStorage.getItem(key);
    if (!raw) return { date: getToday(), count: 0 };
    const { date, count } = JSON.parse(raw);
    if (date !== getToday()) return { date: getToday(), count: 0 };
    return { date, count: typeof count === 'number' ? count : 0 };
  } catch {
    return { date: getToday(), count: 0 };
  }
}

function saveUsage(userId, date, count) {
  try {
    localStorage.setItem(getStorageKey(userId, USAGE_STORAGE_KEY), JSON.stringify({ date, count }));
  } catch {}
}

function loadPlan(userId, isAdmin) {
  try {
    const key = getStorageKey(userId, PLAN_STORAGE_KEY);
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (['free', 'elite', 'institution'].includes(p)) return p;
    }
    return isAdmin ? 'institution' : 'free';
  } catch {
    return isAdmin ? 'institution' : 'free';
  }
}

function loadBranding() {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    if (b && (b.name || b.logoUrl || b.primaryColor)) return b;
    return null;
  } catch {
    return null;
  }
}

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const { user, userId, isAdmin } = useAuth();
  const [plan, setPlanState] = useState('free');
  const [usage, setUsage] = useState({ date: getToday(), count: 0 });
  const [institutionBranding, setInstitutionBrandingState] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const p = loadPlan(userId, isAdmin);
    setPlanState(p);
    localStorage.setItem(getStorageKey(userId, PLAN_STORAGE_KEY), JSON.stringify(p));
    const u = loadUsage(userId);
    setUsage(u);
  }, [userId, isAdmin]);

  useEffect(() => {
    setInstitutionBrandingState(loadBranding());
  }, [userId]);

  const setPlan = useCallback((newPlan) => {
    if (!userId) return;
    setPlanState(newPlan);
    localStorage.setItem(getStorageKey(userId, PLAN_STORAGE_KEY), JSON.stringify(newPlan));
  }, [userId]);

  const setInstitutionBranding = useCallback((branding) => {
    const next = branding && (branding.name || branding.logoUrl || branding.primaryColor)
      ? { name: branding.name || '', logoUrl: branding.logoUrl || '', primaryColor: branding.primaryColor || '' }
      : null;
    setInstitutionBrandingState(next);
    if (next) localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(BRANDING_STORAGE_KEY);
  }, []);

  const incrementCopilotUsage = useCallback(() => {
    if (!userId) return;
    const today = getToday();
    const nextCount = (usage.date === today ? usage.count : 0) + 1;
    setUsage({ date: today, count: nextCount });
    saveUsage(userId, today, nextCount);
  }, [userId, usage.date, usage.count]);

  const canUseCopilot = plan === 'elite' || plan === 'institution' || (plan === 'free' && usage.count < FREE_COPILOT_LIMIT);
  const copilotRemaining = plan === 'free' ? Math.max(0, FREE_COPILOT_LIMIT - usage.count) : null;
  const isInstitutionAdmin = isAdmin && plan === 'institution';
  const canAccessInsights = isAdmin && plan === 'institution';

  const value = {
    plan,
    setPlan,
    canUseCopilot,
    copilotRemaining,
    copilotLimit: FREE_COPILOT_LIMIT,
    incrementCopilotUsage,
    isInstitutionAdmin,
    canAccessInsights,
    institutionBranding,
    setInstitutionBranding,
  };

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
