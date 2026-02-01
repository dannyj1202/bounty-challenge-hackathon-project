import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reviews as reviewsApi } from '../api/client';
import { HelpCircle, MessageSquare } from 'lucide-react';

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

  const cardBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const cardTitle = 'text-gray-900 dark:text-white font-semibold text-base';
  const cardMuted = 'text-gray-800 dark:text-gray-400 text-sm';

  return (
    <div className="min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white max-w-6xl mx-auto px-6 py-8 flex flex-wrap gap-8 items-start transition-colors duration-200">
      <div className="flex-1 min-w-0" style={{ minWidth: '320px' }}>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quiz</h2>

        <div className={`${cardBase} p-8 max-w-2xl`}>
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-violet-100 dark:bg-violet-500/20 border border-violet-300/50 dark:border-violet-500/40 flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-[0_0_32px_rgba(139,92,246,0.15)]"
              aria-hidden
            >
              <HelpCircle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Quiz mode — coming soon</h3>
            <p className={`${cardMuted} leading-relaxed mb-4`}>
              We’re still building Quiz mode. You’ll be able to take normal and adaptive quizzes by topic, get scores, and see weak areas—all aligned with your study goals.
            </p>
            <p className={`${cardMuted} leading-relaxed mb-4`}>
              We’ll use insights from your quiz performance to understand your weak areas. You’ll also be able to leave a short review of where you feel disturbed or slow. That feedback goes straight to your teacher or admin, who can see it neatly in the analytics dashboard to support you better.
            </p>
            <p className={`${cardMuted} text-sm`}>
              This feature will be deployed soon. In the meantime, use Home for Copilot, Calendar for study blocks, and Notes for summaries and flashcards.
            </p>
          </div>
        </div>
      </div>

      {/* Side: Review box — dark card, clear focus, elevated save */}
      <div className={`${cardBase} p-5 w-full sm:w-80 shrink-0`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-2`}>
          <MessageSquare className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Leave a review
        </h3>
        <p className={`${cardMuted} mb-4`}>
          Share where you feel stuck, slow, or disturbed. Your teacher can see this in the analytics dashboard.
        </p>
        <form onSubmit={submitReview}>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="e.g. I struggle with algebra under time pressure…"
            rows={3}
            className="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-y transition-all duration-200"
            maxLength={500}
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50"
              disabled={loading || !reviewText.trim()}
            >
              {loading ? 'Saving…' : 'Save review'}
            </button>
            {saved && <span className="text-sm text-emerald-400">Saved</span>}
          </div>
        </form>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <h4 className={`${cardTitle} mt-6 mb-2`}>Review box</h4>
        {reviewList.length === 0 ? (
          <p className={`${cardMuted} text-sm`}>No reviews yet. Your saved reviews will appear here.</p>
        ) : (
          <ul className="space-y-3 max-h-60 overflow-y-auto list-none p-0 m-0">
            {reviewList.map((r) => (
              <li key={r.id} className="py-2 border-b border-violet-500/10 last:border-0">
                <span className="text-gray-800 dark:text-gray-300 text-sm whitespace-pre-wrap break-words block">{r.text}</span>
                <span className={`${cardMuted} text-xs block mt-1`}>
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
