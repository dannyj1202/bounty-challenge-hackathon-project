import React, { useState } from 'react';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Interactive quiz card for Copilot quiz mode.
 * Shows question, multiple choice options, and "Reveal Answer" with correct/incorrect styling.
 * No backend validation; local state only.
 */
export default function QuizCard({ question, options = [], correctIndex = 0, explanation = '', onBack }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const normalizedOptions = options.length >= 4
    ? options.slice(0, 4)
    : [...options, ...Array.from({ length: 4 - options.length }, (_, i) => ({ letter: LETTERS[options.length + i], text: `Option ${LETTERS[options.length + i]}` }))];
  const correctLetter = LETTERS[correctIndex] ?? LETTERS[0];

  const getOptionStyle = (index) => {
    if (!revealed) {
      return selectedIndex === index
        ? 'border-violet-500 bg-violet-500/20 dark:bg-violet-500/25 text-violet-800 dark:text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
        : 'border-gray-200 dark:border-violet-500/20 text-gray-700 dark:text-gray-200 hover:border-violet-400/50 dark:hover:border-violet-500/40 hover:bg-violet-500/10 dark:hover:bg-violet-500/10';
    }
    const isCorrect = index === correctIndex;
    const isSelectedWrong = selectedIndex === index && index !== correctIndex;
    if (isCorrect) return 'border-emerald-500/60 dark:border-emerald-400/50 bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-100';
    if (isSelectedWrong) return 'border-red-400/40 dark:border-red-500/30 bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-300 opacity-80';
    return 'border-gray-200 dark:border-violet-500/10 text-gray-500 dark:text-gray-400 opacity-75';
  };

  return (
    <div className="rounded-xl border border-violet-500/25 dark:border-violet-500/30 bg-gray-50/80 dark:bg-[#16161d] p-5 shadow-[0_0_24px_rgba(139,92,246,0.08)] transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 leading-snug">
        {question}
      </h3>
      <div className="space-y-2.5">
        {normalizedOptions.map((opt, index) => (
          <button
            key={index}
            type="button"
            disabled={revealed}
            onClick={() => !revealed && setSelectedIndex(index)}
            className={`w-full text-left py-3 px-4 rounded-xl border transition-all duration-200 font-medium ${getOptionStyle(index)}`}
          >
            <span className="font-semibold mr-2">{LETTERS[index]}.</span>
            {typeof opt === 'object' && opt !== null ? (opt.text ?? opt.label ?? '') : String(opt)}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium text-sm transition-all duration-200 hover:shadow-[0_0_16px_rgba(139,92,246,0.35)]"
          >
            Reveal Answer
          </button>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">
              Correct answer: {correctLetter}
            </p>
            {explanation && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {explanation}
              </p>
            )}
          </div>
        )}
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full py-2.5 rounded-xl border border-gray-300 dark:border-violet-500/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-violet-500/10 text-sm font-medium transition-all duration-200"
        >
          Back to chat
        </button>
      )}
    </div>
  );
}
