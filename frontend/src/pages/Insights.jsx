import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { insights as insightsApi } from '../api/client';

export default function Insights() {
  const { userId } = useAuth();
  const [student, setStudent] = useState(null);
  const [university, setUniversity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dashboardRef = useRef(null);

  useEffect(() => {
    Promise.all([
      insightsApi.student(userId).catch(() => null),
      insightsApi.university().catch(() => null),
    ])
      .then(([s, u]) => {
        setStudent(s);
        setUniversity(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const downloadCSV = () => {
    if (!university) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total engagement check-ins', String(university.engagementCheckins ?? 0)],
      ['Unique users', String(university.uniqueUsers ?? 0)],
      [],
      ['Difficulty', 'Count'],
      ...(university.feedbackDistribution || []).map((f) => [f.difficulty || f.value, String(f.c)]),
      [],
      ['Week', 'Due count', 'Completed', 'Easy', 'Medium', 'Hard', 'Pressure score'],
      ...(university.workloadHeatmap || []).map((w) => [
        w.weekLabel || w.week,
        String(w.dueCount ?? 0),
        String(w.completedCount ?? 0),
        String(w.easy ?? 0),
        String(w.medium ?? 0),
        String(w.hard ?? 0),
        String(w.pressureScore ?? 0),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printDashboard = () => {
    window.print();
  };

  if (loading) return <p className="loading">Loading analytics…</p>;
  if (error) return <p className="error">{error}</p>;

  const heatmap = university?.workloadHeatmap || [];
  const maxPressure = Math.max(1, ...heatmap.map((w) => w.pressureScore || 0));
  const feedbackDist = university?.feedbackDistribution || [];
  const totalFeedback = feedbackDist.reduce((s, f) => s + (f.c || 0), 0);

  return (
    <div ref={dashboardRef}>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Analytics dashboard (Admin / Teacher)</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Aggregated & anonymized — workload patterns, engagement trends, and academic pressure points. No individual student data.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={downloadCSV}>
            Download CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={printDashboard}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-muted)' }}>Engagement check-ins</h4>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{university?.engagementCheckins ?? 0}</p>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-muted)' }}>Unique users</h4>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{university?.uniqueUsers ?? 0}</p>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-muted)' }}>Difficulty feedback (total)</h4>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{totalFeedback}</p>
        </div>
      </div>

      {/* Workload heatmap */}
      <div className="card">
        <h3>Workload pressure by week (heatmap)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
          Darker = higher pressure (assignments due + completed + difficulty feedback). Use this to spot high-pressure weeks.
        </p>
        <div className="analytics-heatmap">
          {heatmap.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No weekly data yet. Data appears as students complete assignments and give feedback.</p>
          ) : (
            <div className="analytics-heatmap-grid">
              {heatmap.map((w) => {
                const p = (w.pressureScore || 0) / maxPressure;
                const intensity = Math.min(1, p * 1.2);
                const r = Math.round(255 - intensity * 120);
                const g = Math.round(255 - intensity * 180);
                const b = Math.round(255 - intensity * 80);
                const bg = `rgb(${r},${g},${b})`;
                return (
                  <div
                    key={w.week}
                    className="analytics-heatmap-cell"
                    style={{ background: bg }}
                    title={`${w.weekLabel}: ${w.pressureScore} pressure (${w.dueCount} due, ${w.completedCount} completed)`}
                  >
                    <span className="analytics-heatmap-label">{w.weekLabel}</span>
                    <span className="analytics-heatmap-value">{w.pressureScore}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bar: Difficulty distribution */}
      <div className="card">
        <h3>Difficulty feedback distribution</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
          How students rated assignment difficulty (easy / medium / hard) when completing assignments.
        </p>
        {feedbackDist.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No difficulty feedback yet.</p>
        ) : (
          <div className="analytics-bars">
            {feedbackDist.map((f) => {
              const label = f.difficulty || f.value || '—';
              const count = f.c || 0;
              const pct = totalFeedback ? (100 * count) / totalFeedback : 0;
              return (
                <div key={label} className="analytics-bar-row">
                  <span className="analytics-bar-label">{label}</span>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="analytics-bar-value">{count} ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bar: Workload pressure weeks (due count) */}
      <div className="card">
        <h3>Assignments due by week</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
          Number of assignments due per week (across all students). Peaks suggest high-pressure periods.
        </p>
        {(university?.workloadPressureWeeks || []).length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No due-date data yet.</p>
        ) : (
          <div className="analytics-bars">
            {(university.workloadPressureWeeks || []).slice(-16).map((w) => {
              const maxDue = Math.max(1, ...(university.workloadPressureWeeks || []).map((x) => x.dueCount || 0));
              const pct = (100 * (w.dueCount || 0)) / maxDue;
              const weekLabel = w.week ? (() => {
                const [y, wk] = String(w.week).split('-');
                const d = new Date(Number(y), 0, 1 + (Number(wk) || 0) * 7);
                return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              })() : w.week;
              return (
                <div key={w.week} className="analytics-bar-row">
                  <span className="analytics-bar-label">{weekLabel}</span>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill analytics-bar-fill-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="analytics-bar-value">{w.dueCount}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weak topics */}
      <div className="card">
        <h3>Most common weak topics</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
          Topics where students need more support (from quiz/check-ins). Useful for curriculum focus.
        </p>
        {(university?.mostCommonWeakTopics || []).length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No topic data yet.</p>
        ) : (
          <ul className="widget-list">
            {(university.mostCommonWeakTopics || []).map((t, i) => (
              <li key={i}>
                <strong>{t.topic}</strong> — total weak count: {t.total}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Your student insights (collapsed by default for admin view) */}
      <div className="card">
        <h3>Your student insights</h3>
        {student ? (
          <div>
            <p><strong>Engagement check-ins:</strong> {student.checkins ?? 0}</p>
            <p><strong>Feedback distribution:</strong> {student.feedbackDistribution?.length ? JSON.stringify(student.feedbackDistribution) : 'None'}</p>
            <p><strong>Weak topics:</strong></p>
            <ul>
              {(student.weakTopics || []).map((t, i) => (
                <li key={i}>{t.topic} (count: {t.weakCount})</li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No personal student data loaded.</p>
        )}
      </div>
    </div>
  );
}
