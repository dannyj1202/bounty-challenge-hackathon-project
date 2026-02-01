import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reviews as reviewsApi } from '../api/client';

export default function Quiz() {
  const { userId } = useAuth();
  const [reviewText, setReviewText] = useState('');
  const [reviewList, setReviewList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadReviews = () => {
    if (!userId) return;
    reviewsApi.list(userId).then(setReviewList).catch(() => setReviewList([]));
  };

  useEffect(loadReviews, [userId]);

  const submitReview = async (e) => {
    e.preventDefault();
    const text = reviewText.trim();
    if (!text || !userId) return;
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await reviewsApi.create(userId, text);
      setReviewText('');
      setSaved(true);
      loadReviews();
    } catch (err) {
      setError(err.message || 'Could not save review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Main content */}
      <div style={{ flex: '1 1 400px', minWidth: 0 }}>
        <h2>Quiz</h2>

        <div className="card" style={{ maxWidth: 560, marginTop: 24 }}>
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: '0 auto 20px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '2px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
              aria-hidden
            >
              📝
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: 1.25 + 'rem' }}>Quiz mode — coming soon</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              We’re still building Quiz mode. You’ll be able to take normal and adaptive quizzes by topic, get scores, and see weak areas—all aligned with your study goals.
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
              We’ll use insights from your quiz performance to understand your weak areas. You’ll also be able to leave a short review of where you feel disturbed or slow. That feedback goes straight to your teacher or admin, who can see it neatly in the analytics dashboard to support you better.
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: 16, fontSize: 14 }}>
              This feature will be deployed soon. In the meantime, use Home for Copilot, Calendar for study blocks, and Notes for summaries and flashcards.
            </p>
          </div>
        </div>
      </div>

      {/* Side: Review box */}
      <div className="card" style={{ width: 320, flexShrink: 0 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Leave a review</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
          Share where you feel stuck, slow, or disturbed. Your teacher can see this in the analytics dashboard.
        </p>
        <form onSubmit={submitReview}>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="e.g. I struggle with algebra under time pressure…"
            rows={3}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', resize: 'vertical', font: 'inherit' }}
            maxLength={500}
          />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="submit" className="btn" disabled={loading || !reviewText.trim()}>
              {loading ? 'Saving…' : 'Save review'}
            </button>
            {saved && <span style={{ fontSize: 13, color: 'var(--success)' }}>Saved</span>}
          </div>
        </form>
        {error && <p className="error" style={{ marginTop: 8, fontSize: 13 }}>{error}</p>}

        <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, color: 'var(--text-muted)' }}>Review box</h4>
        {reviewList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No reviews yet. Your saved reviews will appear here.</p>
        ) : (
          <ul className="widget-list" style={{ maxHeight: 240, overflowY: 'auto' }}>
            {reviewList.map((r) => (
              <li key={r.id} style={{ fontSize: 13, padding: '8px 0' }}>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.text}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
