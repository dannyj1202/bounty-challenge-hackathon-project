import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ExternalLink, MessageCircle, HelpCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';
const TEAMS_URL = 'https://teams.microsoft.com';

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
      onReplied();
    } catch (e) {
      // keep silent for MVP
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 flex gap-2">
      <input
        type="text"
        placeholder="Write an answer…"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
      />
      <button
        type="button"
        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_16px_rgba(139,92,246,0.4)] disabled:opacity-50"
        onClick={sendReply}
        disabled={sending}
      >
        {sending ? 'Replying…' : 'Reply'}
      </button>
    </div>
  );
}

export default function Community() {
  const { userId } = useAuth();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(false);
  const [posts, setPosts] = useState([]);

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

  useEffect(() => {
    loadPosts();
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

  const cardBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const cardTitle = 'text-gray-900 dark:text-white font-semibold text-base';
  const cardMuted = 'text-gray-800 dark:text-gray-400 text-sm';

  return (
    <div className="min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white max-w-4xl mx-auto px-6 py-8 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Microsoft Teams Integration</h2>

      {/* Open in Teams — link to MS Teams (no loading) */}
      <div className={`${cardBase} p-5 mb-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <img
            src="/teams-logo.png"
            alt=""
            className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl object-contain bg-white dark:bg-white/5 ring-1 ring-gray-200 dark:ring-violet-500/20"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className={`${cardTitle} flex items-center gap-2 mb-2 border-b border-gray-200 dark:border-violet-500/20 pb-3`}>
              <ExternalLink className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
              Open in Teams
            </h3>
            <p className={`${cardMuted} mb-4`}>
              Join your class and community on Microsoft Teams. Open Teams with your Microsoft account.
            </p>
            <a
              href={TEAMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            >
              Open Microsoft Teams
            </a>
          </div>
        </div>
      </div>

      {/* Ask a Question — chat-style input, purple send */}
      <div className={`${cardBase} p-5 mb-6`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-violet-500/20 pb-3`}>
          <MessageCircle className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Ask a Question
        </h3>

        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-gray-300 text-sm font-medium mb-1">Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your question…"
              className="w-full py-2.5 px-4 rounded-xl bg-black/30 border border-violet-500/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
            />
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50"
            onClick={postQuestion}
            disabled={loading}
          >
            {loading ? 'Posting…' : 'Post Question'}
          </button>
        </div>

        {posted && <p className="text-emerald-400 text-sm mt-3">Posted successfully.</p>}
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {/* Community Questions — card-based list, empty state */}
      <div className={`${cardBase} p-5`}>
        <h3 className={`${cardTitle} flex items-center gap-2 mb-4 border-b border-violet-500/20 pb-3`}>
          <HelpCircle className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
          Community Questions
        </h3>

        {posts.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-300/50 dark:border-violet-500/30 flex items-center justify-center text-violet-500 dark:text-violet-400" aria-hidden>
              <HelpCircle className="w-8 h-8" />
            </div>
            <p className="text-gray-400 text-sm">No questions yet. Be the first to ask.</p>
          </div>
        )}

        {posts.length > 0 && (
          <ul className="space-y-4 list-none p-0 m-0">
            {posts.map((p) => (
              <li
                key={p.id ?? `${p.time}-${p.message}`}
                className="p-4 rounded-xl bg-black/20 border border-violet-500/10 transition-all duration-200 hover:border-violet-500/30"
              >
                <p className="text-gray-900 dark:text-white font-medium mb-1"><strong>Q:</strong> {p.message}</p>
                <span className={`${cardMuted} text-xs`}>{p.time}</span>

                <div className="mt-4 pl-4 border-l-2 border-violet-500/20">
                  <p className="text-gray-300 text-sm font-medium mb-2">Answers</p>

                  {(p.replies && p.replies.length > 0) ? (
                    p.replies.map((r, idx) => (
                      <div key={idx} className="mb-3 text-sm">
                        <p className="text-gray-700 dark:text-gray-200"><strong>A:</strong> {r.message}</p>
                        <span className={`${cardMuted} text-xs`}>{r.time}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm mb-3">No answers yet. Be the first to reply.</p>
                  )}

                  <ReplyBox postId={p.id} onReplied={loadPosts} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
