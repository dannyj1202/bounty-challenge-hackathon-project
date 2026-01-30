import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { teams } from '../api/client';

const API_BASE = 'http://localhost:3001';

// Small component to reply to a specific question
function ReplyBox({ postId, onReplied }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return;

    setSending(true);
    try {
      await fetch(`${API_BASE}/api/community/${postId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: reply })
      });

      setReply('');
      onReplied(); // refresh list
    } catch (e) {
      // keep silent for MVP, or add UI later
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
      <input
        type="text"
        placeholder="Write an answer…"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        style={{ flex: 1 }}
      />
      <button type="button" className="btn" onClick={sendReply} disabled={sending}>
        {sending ? 'Replying…' : 'Reply'}
      </button>
    </div>
  );
}

export default function Community() {
  const { userId } = useAuth();

  const [deepLink, setDeepLink] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(false);
  const [posts, setPosts] = useState([]);

  // Load Teams deep link (mock / Graph-ready)
  useEffect(() => {
    teams
      .deepLink(userId)
      .then((r) => setDeepLink(r.deepLink || ''))
      .catch(() => setDeepLink(''));
  }, [userId]);

  const loadPosts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/community`, {
        credentials: 'include'
      });
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    }
  };

  // Load community posts on page load
  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postQuestion = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setError('');
    setPosted(false);

    try {
      await fetch(`${API_BASE}/api/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message })
      });

      setPosted(true);
      setMessage('');
      await loadPosts();
    } catch (err) {
      setError('Failed to post question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Microsoft Teams Integration</h2>

      <div className="card">
        <h3>Open in Teams</h3>
        <p>
          Academic discussion channel connected to Microsoft Teams
          (Graph API ready).
        </p>

        {deepLink ? (
          <a href={deepLink} target="_blank" rel="noreferrer" className="btn">
            Open Teams
          </a>
        ) : (
          <p className="loading">Loading Teams link…</p>
        )}
      </div>

      <div className="card">
        <h3>Ask a Question</h3>

        <div className="form-group">
          <label>Message</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your question…"
          />
        </div>

        <button
          type="button"
          className="btn"
          onClick={postQuestion}
          disabled={loading}
        >
          {loading ? 'Posting…' : 'Post Question'}
        </button>

        {posted && (
          <p style={{ color: 'var(--success)' }}>
            Posted successfully.
          </p>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h3>Community Questions</h3>

        {posts.length === 0 && <p>No questions yet.</p>}

        {posts.map((p) => (
          <div
            key={p.id ?? `${p.time}-${p.message}`}
            style={{ marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #222' }}
          >
            <p><strong>Q:</strong> {p.message}</p>
            <small>{p.time}</small>

            <div style={{ marginTop: '10px', marginLeft: '12px' }}>
              <p style={{ marginBottom: '6px' }}><strong>Answers</strong></p>

              {(p.replies && p.replies.length > 0) ? (
                p.replies.map((r, idx) => (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    <p style={{ margin: 0 }}><strong>A:</strong> {r.message}</p>
                    <small>{r.time}</small>
                  </div>
                ))
              ) : (
                <p style={{ opacity: 0.7 }}>No answers yet. Be the first to reply.</p>
              )}

              <ReplyBox postId={p.id} onReplied={loadPosts} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}