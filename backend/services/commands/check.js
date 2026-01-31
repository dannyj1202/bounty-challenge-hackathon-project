/**
 * /check — feedback on user's attempt (structure, hints). No full answers. Read-only.
 * Requires: /check <my attempt text>. Refuses "give me the answer" / do-my-work.
 */

const CHEATING_PHRASES = [
  'give me the answer',
  'give me the solution',
  'what is the answer',
  'just tell me the answer',
  'do it for me',
  'write it for me',
  'solve it for me',
];

function looksLikeAskingForAnswer(text) {
  const lower = String(text || '').toLowerCase().trim();
  return CHEATING_PHRASES.some((p) => lower.includes(p));
}

function deterministicFeedback(attempt) {
  const t = String(attempt || '').trim();
  if (!t) return null;
  const words = t.split(/\s+/).filter(Boolean);
  const hasStructure = /^\s*(\d+[.)]\s|[-*]\s)/m.test(t) || t.split('\n').filter((l) => l.trim()).length >= 2;
  const length = words.length;
  const strengths = [];
  if (length >= 20) strengths.push('You provided substantial content — good start.');
  else strengths.push('You started putting ideas down — keep going.');
  if (hasStructure) strengths.push('Your answer has some structure (lists or paragraphs).');
  else strengths.push('Adding bullet points or short paragraphs can clarify your reasoning.');
  const issues = [];
  if (length < 30) issues.push('Consider expanding: add one or two more supporting points or examples.');
  if (!/[.?!]$/.test(t)) issues.push('Consider ending with a clear concluding sentence.');
  if (!t.match(/\b(because|therefore|so|thus|example)\b/i)) issues.push('Using linking words (because, for example, therefore) can strengthen your argument.');
  issues.push('Re-read the question and check that each part is addressed.');
  const suggestions = [
    'Restate the main question in your own words at the start.',
    'Give one concrete example from the material if applicable.',
    'Leave a line between paragraphs for readability.',
    'Proofread for clarity before submitting.',
  ];
  const hint = 'Hint: Focus on what the question is asking (definition? comparison? steps?). Make sure each part of the question gets at least one sentence.';
  return {
    strengths: strengths.slice(0, 2),
    issues: issues.slice(0, 4),
    suggestions: suggestions.slice(0, 4),
    hint,
  };
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [] };

  const attempt = (args || '').trim();
  if (!attempt) {
    return {
      reply: 'Usage: /check <your attempt> — paste your draft or answer and I\'ll give feedback (structure, gaps, hints). I won\'t give the final answer; I\'ll help you improve yours.',
      suggestions: [],
    };
  }
  if (looksLikeAskingForAnswer(attempt)) {
    return {
      reply: "I don't give final answers. Paste your own attempt (your draft or solution) and I'll give feedback: strengths, issues, and suggestions to improve. Use /check <your attempt>.",
      suggestions: [],
    };
  }
  const fb = deterministicFeedback(attempt);
  if (!fb) {
    return { reply: 'Paste your attempt after /check so I can give feedback.', suggestions: [] };
  }
  const reply = [
    'Feedback on your attempt:',
    '',
    'Strengths:',
    ...fb.strengths.map((s) => `• ${s}`),
    '',
    'Issues / gaps:',
    ...fb.issues.map((s) => `• ${s}`),
    '',
    'Suggestions to improve:',
    ...fb.suggestions.map((s) => `• ${s}`),
    '',
    'Hint:',
    fb.hint,
  ].join('\n');
  return { reply, suggestions: [] };
}
