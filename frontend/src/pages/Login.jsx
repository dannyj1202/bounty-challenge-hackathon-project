import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, dev } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('student@university.edu');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Microsoft sign-in callback (no-userId first-time sign-in)
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
      const res = await auth.mockLogin(email, role);
      login(res.user, res.token);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await dev.seed();
      login(res.user, res.token);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Seed failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main" style={{ maxWidth: 400, margin: '40px auto' }}>
      <div className="card">
        <h2>Sign in</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Mock university login (Entra ID OAuth ready)</p>
        <form onSubmit={handleMockLogin}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@university.edu" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in (mock)'}</button>
        </form>
        <p style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={handleSeedDemo} disabled={loading}>Quick demo (seed data)</button>
        </p>
        <p style={{ marginTop: 16 }}>
          <a href={auth.getMicrosoftLoginUrl('')} className="btn btn-secondary">
            Sign in with Microsoft
          </a>
        </p>
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-muted)' }}>
          First-time users: click above. Already have an account? Use mock sign-in, then connect Microsoft in Settings.
        </p>
      </div>
    </div>
  );
}
