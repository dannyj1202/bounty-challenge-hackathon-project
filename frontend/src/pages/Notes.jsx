import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { notes as notesApi } from '../api/client';

const LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
];

export default function Notes() {
  const { userId } = useAuth();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('es');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [oneNoteTitle, setOneNoteTitle] = useState('');

  const run = async (fn, ...args) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fn(...args);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const summarize = () => run(notesApi.summarize, text);
  const translate = () => run(notesApi.translate, text, language);
  const flashcards = () => run(notesApi.flashcards, text);
  const practiceQs = () => run(notesApi.questions, text);

  const startRecording = () => {
    setRecording(true);
    setError('');
    setResult(null);
    // TODO: Use MediaRecorder, then base64 and call notesApi.transcribe
    setTimeout(() => {
      setRecording(false);
      setResult({ text: '[Mock] Voice recording: configure Azure Speech for real speech-to-text.' });
    }, 1500);
  };

  const saveToOneNote = async () => {
    const title = oneNoteTitle || 'Study note';
    setLoading(true);
    setError('');
    try {
      const res = await notesApi.saveOnenote(userId, title, text || result?.translatedText || result?.reply || '');
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Notes</h2>
      <div className="card">
        <h3>Paste text or upload (optional)</h3>
        <div className="form-group">
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your notes here…" style={{ width: '100%' }} />
        </div>
        <p>
          <button type="button" className="btn btn-secondary" onClick={startRecording} disabled={loading}>
            {recording ? 'Recording…' : 'Voice record (speech-to-text)'}
          </button>
        </p>
      </div>

      <div className="card">
        <h3>Actions</h3>
        <p style={{ marginBottom: 12 }}>AI suggests; you control (accept / edit / ignore).</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn" onClick={summarize} disabled={loading || !text.trim()}>Summarize</button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <select className="language-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={translate} disabled={loading || !text.trim()}>Translate</button>
          </div>
          <button type="button" className="btn" onClick={flashcards} disabled={loading || !text.trim()}>Generate flashcards</button>
          <button type="button" className="btn" onClick={practiceQs} disabled={loading || !text.trim()}>Generate practice Qs</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Loading…</p>}
      {result && !loading && (
        <div className="card">
          <h3>Result</h3>
          {result.translatedText != null && <p>{result.translatedText}</p>}
          {result.reply != null && <p>{result.reply}</p>}
          {result.text != null && !result.reply && !result.translatedText && <p>{result.text}</p>}
          {result.explanation && <p style={{ color: 'var(--text-muted)' }}>{result.explanation}</p>}
        </div>
      )}

      <div className="card">
        <h3>Export / Save to OneNote</h3>
        <p>OneNote-ready format; Save uses Graph when configured (mock otherwise).</p>
        <div className="form-group">
          <label>Title for OneNote page</label>
          <input type="text" value={oneNoteTitle} onChange={(e) => setOneNoteTitle(e.target.value)} placeholder="My study note" />
        </div>
        <button type="button" className="btn" onClick={saveToOneNote} disabled={loading}>Save to OneNote</button>
      </div>
    </div>
  );
}
