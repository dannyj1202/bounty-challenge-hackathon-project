import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api/client';

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

  /** Dev only: sign in with mock backend, then store user + token. */
  const loginWithMock = async (email, role = 'student') => {
    const res = await authApi.mockLogin(email, role);
    login(res.user, res.token);
    return res;
  };

  const userId = user?.id ?? null;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, userId, isAdmin, login, logout, loginWithMock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
