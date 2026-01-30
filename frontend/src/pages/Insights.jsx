import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { insights as insightsApi } from '../api/client';

export default function Insights() {
  const { userId } = useAuth();
  const [student, setStudent] = useState(null);
  const [university, setUniversity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      insightsApi.student(userId).catch(() => null),
      insightsApi.university().catch(() => null),
    ]).then(([s, u]) => {
      setStudent(s);
      setUniversity(u);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="loading">Loading insights…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h2>University Mode analytics (Admin)</h2>
      <p style={{ color: 'var(--text-muted)' }}>Aggregated & anonymized — never individual raw student messages.</p>

      <div className="card">
        <h3>Your student insights</h3>
        {student && (
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
        )}
      </div>

      <div className="card">
        <h3>University-wide (aggregated)</h3>
        {university && (
          <div>
            <p><strong>Total engagement check-ins:</strong> {university.engagementCheckins ?? 0}</p>
            <p><strong>Unique users:</strong> {university.uniqueUsers ?? 0}</p>
            <p><strong>Feedback distribution (easy/medium/hard):</strong></p>
            <ul>
              {(university.feedbackDistribution || []).map((f, i) => (
                <li key={i}>{f.difficulty}: {f.c}</li>
              ))}
            </ul>
            <p><strong>Most common weak topics:</strong></p>
            <ul>
              {(university.mostCommonWeakTopics || []).map((t, i) => (
                <li key={i}>{t.topic} (total: {t.total})</li>
              ))}
            </ul>
            <p><strong>Workload pressure (by week):</strong></p>
            <ul>
              {(university.workloadPressureWeeks || []).map((w, i) => (
                <li key={i}>Week {w.week}: {w.dueCount} due</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
