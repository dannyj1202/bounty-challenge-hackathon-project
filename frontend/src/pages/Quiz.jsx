import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { quiz as quizApi } from '../api/client';

export default function Quiz() {
  const { userId } = useAuth();
  const [topic, setTopic] = useState('Algebra');
  const [difficulty, setDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError(err.message);
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
      setError(err.message);
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

  const questions = quiz?.questions || [];

  return (
    <div>
      <h2>Quiz</h2>
      <div className="card">
        <h3>Generate quiz</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Topic</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Algebra" />
          </div>
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
            <input type="number" min={1} max={20} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} />
          </div>
          <button type="button" className="btn" onClick={generateQuiz} disabled={loading}>{loading ? 'Generating…' : 'Generate quiz'}</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {questions.length > 0 && !submitted && (
        <div className="card">
          <h3>Questions</h3>
          {questions.map((q, i) => (
            <div key={q.id || i} style={{ marginBottom: 20 }}>
              <p><strong>{i + 1}. {q.question}</strong></p>
              <div>
                {(q.options || []).map((opt, j) => (
                  <button key={j} type="button" className={`quiz-option ${answers[i] === j ? 'selected' : ''}`} onClick={() => setAnswer(i, j)}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={submitQuiz} disabled={loading || answers.some((a) => a === null)}>Submit</button>
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
                    <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => acceptSuggestion(s)}>Accept</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
