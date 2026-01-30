import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { teams } from '../api/client';

export default function Community() {
  const { userId } = useAuth();
  const [deepLink, setDeepLink] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    teams.deepLink(userId).then((r) => setDeepLink(r.deepLink || '')).catch(() => setDeepLink(''));
  }, [userId]);

  const postQuestion = async () => {
    setLoading(true);
    setError('');
    setPosted(false);
    try {
      await teams.post(userId, message || 'Question from Smart Study Copilot');
      setPosted(true);
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Microsoft Teams integration</h2>
      <div className="card">
        <h3>Open in Teams</h3>
        <p>Deep link to your default team/channel (mock or real Graph when configured).</p>
        {deepLink ? (
          <a href={deepLink} target="_blank" rel="noreferrer" className="btn">Open Teams</a>
        ) : (
          <p className="loading">Loading link…</p>
        )}
      </div>
      <div className="card">
        <h3>Post question</h3>
        <p>Post to Teams (Graph stub when configured; mock otherwise).</p>
        <div className="form-group">
          <label>Message</label>
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your question…" />
        </div>
        <button type="button" className="btn" onClick={postQuestion} disabled={loading}>{loading ? 'Posting…' : 'Post question'}</button>
        {posted && <p style={{ color: 'var(--success)' }}>Posted (mock).</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
