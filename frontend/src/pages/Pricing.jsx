import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Student demo',
    price: '$0',
    period: 'forever',
    features: [
      'Core study management (assignments, calendar, notes)',
      '10 copilot prompts per day',
      'Quiz & flashcards',
      'Community access',
    ],
    cta: 'Current plan',
    highlight: false,
  },
  {
    id: 'elite',
    name: 'Elite',
    subtitle: 'AI-enhanced',
    price: '$25',
    period: '/month',
    features: [
      'Everything in Free',
      'Unlimited copilot prompts',
      'AI-powered study planning',
      'Priority support',
    ],
    cta: 'Upgrade to Elite',
    highlight: true,
  },
  {
    id: 'institution',
    name: 'Institution',
    subtitle: 'School license',
    price: 'Flexible',
    period: '',
    features: [
      'Per-student subscription or institution-wide annual license',
      'Admin dashboard & analytics',
      'White-label branding (name, logo, theme)',
      'Bulk access for your school',
    ],
    cta: 'Contact for Institution',
    highlight: false,
  },
];

export default function Pricing() {
  const { user, isAdmin } = useAuth();
  const { plan, setPlan } = usePlan();
  const [paymentModal, setPaymentModal] = useState(null);
  const [switchingTo, setSwitchingTo] = useState(null);

  const handleSwitch = (targetPlan) => {
    if (targetPlan === plan) return;
    setSwitchingTo(targetPlan);
    setPaymentModal(true);
  };

  const confirmDemoSwitch = () => {
    if (switchingTo) {
      setPlan(switchingTo);
      setSwitchingTo(null);
    }
    setPaymentModal(false);
  };

  return (
    <div className="pricing-page">
      <h2>Plans & pricing</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Choose a plan that fits you. Demo mode: you can switch plans below; payment methods will be available soon.
      </p>
      {user && (
        <p style={{ marginBottom: 24, fontWeight: 500 }}>
          Your current plan: <strong>{plan === 'free' ? 'Free' : plan === 'elite' ? 'Elite' : 'Institution'}</strong>
          {!isAdmin && plan !== 'institution' && (
            <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--text-muted)' }}>
              (Institution is for admins / school licenses)
            </span>
          )}
        </p>
      )}

      <div className="pricing-grid">
        {PLANS.map((p) => {
          const isCurrent = plan === p.id;
          const showSwitch = !isCurrent;

          return (
            <div
              key={p.id}
              className={`pricing-card ${p.highlight ? 'pricing-card-highlight' : ''} ${isCurrent ? 'pricing-card-current' : ''}`}
            >
              {p.highlight && <span className="pricing-badge">Popular</span>}
              <h3>{p.name}</h3>
              <p className="pricing-subtitle">{p.subtitle}</p>
              <div className="pricing-price">
                <span className="pricing-amount">{p.price}</span>
                {p.period && <span className="pricing-period">{p.period}</span>}
              </div>
              <ul className="pricing-features">
                {p.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button
                type="button"
                className={`btn ${isCurrent ? 'btn-secondary' : ''}`}
                disabled={isCurrent}
                onClick={() => showSwitch && handleSwitch(p.id)}
              >
                {isCurrent ? 'Current plan' : p.cta}
              </button>
            </div>
          );
        })}
      </div>

      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Payment</h3>
            <p>Payment method will be available soon. In demo mode you can switch your plan now without payment.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={confirmDemoSwitch}>
                Switch to {switchingTo === 'free' ? 'Free' : switchingTo === 'elite' ? 'Elite' : 'Institution'} (demo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
