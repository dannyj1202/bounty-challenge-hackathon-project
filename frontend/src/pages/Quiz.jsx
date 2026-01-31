import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { quiz as quizApi } from '../api/client';

// Use relative /api so Vite proxy works; set VITE_API_BASE only if backend is on another origin.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Quiz() {
  const { userId } = useAuth();

  // mode: "batch" (existing) or "adaptive"
  const [mode, setMode] = useState('batch');

  // Shared inputs
  const [topic, setTopic] = useState('Algebra');

  // Batch mode state
  const [difficulty, setDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(null);

  // Adaptive mode state
  const [sessionId, setSessionId] = useState('');
  const [aQuestion, setAQuestion] = useState('');
  const [aOptions, setAOptions] = useState([]);
  const [aSelected, setASelected] = useState(null);
  const [aDifficulty, setADifficulty] = useState(3);
  const [aSubtopic, setASubtopic] = useState('');
  const [aFeedback, setAFeedback] = useState('');
  const [weakTopics, setWeakTopics] = useState([]);

  // Common status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset UI when switching modes
  useEffect(() => {
    setError('');
    setLoading(false);

    // reset batch
    setQuiz(null);
    setAnswers([]);
    setSubmitted(null);

    // reset adaptive
    setSessionId('');
    setAQuestion('');
    setAOptions([]);
    setASelected(null);
    setADifficulty(3);
    setASubtopic('');
    setAFeedback('');
    setWeakTopics([]);
  }, [mode]);

  /* ===========================
     BATCH MODE (existing)
     =========================== */

  const generateQuiz = async () => {
    setLoading(true);
    setError('');
    setQuiz(null);
    setAnswers([]);
    setSubmitted(null);
    try {
      const res = await quizApi.generate({ userId, topic, difficulty, numQuestions });
      setQuiz(res);
      setAnswers(new Array((res.questions || []).length).fill(null));
    } catch (err) {
      setError(err.message || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz?.quizId || answers.some((a) => a === null)) return;
    setLoading(true);
    setError('');
    try {
      const res = await quizApi.submit({ userId, quizId: quiz.quizId, answers });
      setSubmitted(res);
    } catch (err) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (qIndex, optionIndex) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = optionIndex;
      return next;
    });
  };

  const acceptSuggestion = (s) => {
    window.alert(`Suggestion accepted: ${s.action}. (In a full app this would add to your tasks.)`);
  };

  /* ===========================
     ADAPTIVE MODE (new)
     =========================== */

  const startAdaptive = async () => {
    if (!topic) return;
    setLoading(true);
    setError('');
    setAFeedback('');
    setWeakTopics([]);
    setASelected(null);

    try {
      const res = await fetch(`${API_BASE}/api/quiz/adaptive/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'anonymous', topic })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to start adaptive quiz');

      setSessionId(data.sessionId);
      setADifficulty(data.difficulty || 3);
      setASubtopic(data.subtopic || topic);
      setAQuestion(data.question || '');
      setAOptions(data.options || []);
    } catch (err) {
      setError(err.message || 'Failed to start adaptive quiz');
    } finally {
      setLoading(false);
    }
  };

  const submitAdaptiveAnswer = async () => {
    if (!sessionId || aSelected === null) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/quiz/adaptive/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'anonymous',
          sessionId,
          selectedIndex: aSelected
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit answer');

      setAFeedback(
        data.correct
          ? `✅ Correct — next question will be harder (Difficulty ${data.newDifficulty}/5)`
          : `❌ Wrong — next question will be easier (Difficulty ${data.newDifficulty}/5)`
      );

      setADifficulty(data.newDifficulty || aDifficulty);
      setASubtopic(data.nextSubtopic || topic);
      setAQuestion(data.nextQuestion || '');
      setAOptions(data.nextOptions || []);
      setASelected(null);

      setWeakTopics(data.weakTopics || []);
    } catch (err) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setLoading(false);
    }
  };

  const questions = quiz?.questions || [];

  return (
    <div>
      <h2>Quiz</h2>

      {/* Mode toggle */}
      <div className="card">
        <h3>Mode</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${mode === 'batch' ? '' : 'btn-secondary'}`}
            onClick={() => setMode('batch')}
            disabled={loading}
          >
            Normal Quiz (5 questions)
          </button>
          <button
            type="button"
            className={`btn ${mode === 'adaptive' ? '' : 'btn-secondary'}`}
            onClick={() => setMode('adaptive')}
            disabled={loading}
          >
            Adaptive Quiz (harder/easier)
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 10 }}>
          Adaptive mode asks 1 question at a time. Correct → harder. Wrong → easier. Weak topics get prioritized.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Shared Topic input */}
      <div className="card">
        <h3>Topic</h3>
        <div className="form-group" style={{ marginBottom: 0, maxWidth: 360 }}>
          <label>Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Algebra"
          />
        </div>
      </div>

      {/* ===========================
          BATCH MODE UI
      =========================== */}
      {mode === 'batch' && (
        <>
          <div className="card">
            <h3>Generate quiz</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Questions</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                />
              </div>
              <button type="button" className="btn" onClick={generateQuiz} disabled={loading}>
                {loading ? 'Generating…' : 'Generate quiz'}
              </button>
            </div>
          </div>

          {questions.length > 0 && !submitted && (
            <div className="card">
              <h3>Questions</h3>
              {questions.map((q, i) => (
                <div key={q.id || i} style={{ marginBottom: 20 }}>
                  <p><strong>{i + 1}. {q.question}</strong></p>
                  <div>
                    {(q.options || []).map((opt, j) => (
                      <button
                        key={j}
                        type="button"
                        className={`quiz-option ${answers[i] === j ? 'selected' : ''}`}
                        onClick={() => setAnswer(i, j)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" className="btn" onClick={submitQuiz} disabled={loading || answers.some((a) => a === null)}>
                Submit
              </button>
            </div>
          )}

          {submitted && (
            <div className="card">
              <h3>Results</h3>
              <p><strong>Score: {submitted.score}%</strong></p>
              {submitted.explanation && <p>{submitted.explanation}</p>}
              {submitted.weakTopics?.length > 0 && (
                <p>Weak topics: {submitted.weakTopics.join(', ')}</p>
              )}
              {submitted.suggestions?.length > 0 && (
                <div>
                  <p><strong>Suggested priorities (accept / edit / ignore)</strong></p>
                  <ul className="widget-list">
                    {submitted.suggestions.map((s, i) => (
                      <li key={i}>
                        {s.priority}. {s.action}
                        <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => acceptSuggestion(s)}>
                          Accept
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===========================
          ADAPTIVE MODE UI
      =========================== */}
      {mode === 'adaptive' && (
        <>
          <div className="card">
            <h3>Adaptive session</h3>
            <button type="button" className="btn" onClick={startAdaptive} disabled={loading || !topic}>
              {loading ? 'Starting…' : 'Start Adaptive Quiz'}
            </button>

            {sessionId && (
              <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div><strong>Difficulty:</strong> {aDifficulty}/5</div>
                <div><strong>Focus:</strong> {aSubtopic}</div>
                <div><strong>Session:</strong> {sessionId}</div>
              </div>
            )}
          </div>

          {sessionId && (
            <div className="card">
              <h3>Question</h3>
              <p><strong>{aQuestion}</strong></p>

              <ul className="widget-list">
                {aOptions.map((opt, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="adaptiveOpt"
                      checked={aSelected === idx}
                      onChange={() => setASelected(idx)}
                    />
                    <span>{opt}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="btn"
                onClick={submitAdaptiveAnswer}
                disabled={loading || aSelected === null}
              >
                {loading ? 'Submitting…' : 'Submit Answer'}
              </button>

              {aFeedback && <p style={{ marginTop: 12 }}>{aFeedback}</p>}

              {weakTopics.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Weak Topics (most missed):</strong>
                  <ul>
                    {weakTopics.map((t, i) => (
                      <li key={i}>{t.topic} — weakCount {t.weakCount}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
