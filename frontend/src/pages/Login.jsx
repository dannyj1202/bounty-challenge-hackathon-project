import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('student@university.edu');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithMock } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Microsoft callback (first-time sign-in: backend redirects to /login?ms=callback&token=...&userId=...)
  useEffect(() => {
    const ms = searchParams.get('ms');
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    const emailFromMs = searchParams.get('email');
    const roleFromMs = searchParams.get('role') || 'student';
    if (ms === 'callback' && token && userId) {
      login(
        { id: userId, email: emailFromMs || '', role: roleFromMs },
        token
      );
      setSearchParams({});
      navigate('/home', { replace: true });
      return;
    }
    if (ms === 'error') {
      setError(searchParams.get('reason') === 'no_email' ? 'Microsoft account has no email.' : 'Microsoft sign-in failed.');
      setSearchParams({});
    }
  }, [searchParams, login, navigate, setSearchParams]);

  const handleMockLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithMock(email, role);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <h2>Sign in</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          Use your Microsoft account to sign in, or use mock login for development.
        </p>

        <a href={auth.getMicrosoftLoginUrlFirstTime()} className="btn btn-primary btn-block">
          Continue with Microsoft
        </a>

        <div className="login-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleMockLogin} className="login-form">
          <div className="form-group">
            <label>Email (dev)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              required
            />
          </div>
          <div className="form-group">
            <label>Role (dev)</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-secondary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in with mock (dev)'}
          </button>
        </form>
      </div>
    </div>
  );
}
