import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { Check } from 'lucide-react';

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

  const cardBase = 'rounded-xl border bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm p-6 flex flex-col transition-all duration-200';
  const cardHighlight = 'border-violet-500/40 shadow-[0_0_32px_rgba(139,92,246,0.12)] hover:shadow-[0_0_40px_rgba(139,92,246,0.18)]';
  const cardDefault = 'border-gray-200 dark:border-violet-500/20 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const cardCurrent = 'border-emerald-500/30 bg-emerald-500/5';

  return (
    <div className="min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white max-w-5xl mx-auto px-6 py-8 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Plans & pricing</h2>
      <p className="text-gray-800 dark:text-gray-400 text-sm mb-6">
        Choose a plan that fits you. Demo mode: you can switch plans below; payment methods will be available soon.
      </p>
      {user && (
        <p className="text-gray-800 dark:text-gray-300 text-sm mb-6">
          Your current plan: <strong className="text-gray-900 dark:text-white">{plan === 'free' ? 'Free' : plan === 'elite' ? 'Elite' : 'Institution'}</strong>
          {!isAdmin && plan !== 'institution' && (
            <span className="text-gray-500 ml-2 text-xs">(Institution is for admins / school licenses)</span>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((p) => {
          const isCurrent = plan === p.id;
          const showSwitch = !isCurrent;

          return (
            <div
              key={p.id}
              className={`relative ${cardBase} ${p.highlight ? cardHighlight : cardDefault} ${isCurrent ? cardCurrent : ''}`}
            >
              {p.highlight && (
                <span className="absolute top-0 right-4 -translate-y-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-medium shadow-[0_0_16px_rgba(139,92,246,0.4)]">
                  Popular
                </span>
              )}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{p.name}</h3>
              <p className="text-gray-800 dark:text-gray-400 text-sm mb-4">{p.subtitle}</p>
              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{p.price}</span>
                {p.period && <span className="text-gray-800 dark:text-gray-400 text-sm">{p.period}</span>}
              </div>
              <ul className="space-y-2 mb-6 flex-1 list-none p-0 m-0">
                {p.features.map((f, i) => (
                  <li key={i} className="text-gray-800 dark:text-gray-300 text-sm flex items-start gap-2">
                    <Check className="w-4 h-4 shrink-0 text-violet-500 dark:text-violet-400 mt-0.5" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${
                  isCurrent
                    ? 'border border-violet-400/50 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 cursor-default'
                    : 'bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white hover:shadow-[0_0_24px_rgba(139,92,246,0.4)]'
                }`}
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
