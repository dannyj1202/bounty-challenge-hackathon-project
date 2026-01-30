import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('smart-study-auth');
      if (raw) {
        const { user: u, token: t } = JSON.parse(raw);
        if (u && t) {
          setUser(u);
          setToken(t);
        }
      }
    } catch {}
  }, []);

  const login = (userData, tokenValue) => {
    setUser(userData);
    setToken(tokenValue);
    localStorage.setItem('smart-study-auth', JSON.stringify({ user: userData, token: tokenValue }));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smart-study-auth');
  };

  const userId = user?.id ?? null;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, userId, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
