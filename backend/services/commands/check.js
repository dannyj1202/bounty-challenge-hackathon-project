/**
 * /check — feedback rubric, weakAreas[], suggestions[], NO rewriting full answers. citations[] optional.
 * Refuses "give me the answer" / do-my-work.
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
  const weakAreas = [];
  if (length < 30) weakAreas.push('Consider expanding: add supporting points or examples.');
  if (!/[.?!]$/.test(t)) weakAreas.push('Consider ending with a clear concluding sentence.');
  if (!t.match(/\b(because|therefore|so|thus|example)\b/i)) weakAreas.push('Using linking words can strengthen your argument.');
  weakAreas.push('Re-read the question and check that each part is addressed.');
  const suggestions = [
    'Restate the main question in your own words at the start.',
    'Give one concrete example from the material if applicable.',
    'Leave a line between paragraphs for readability.',
    'Proofread for clarity before submitting.',
  ];
  const rubric = {
    structure: hasStructure ? 'Good' : 'Needs improvement',
    length: length >= 20 ? 'Substantial' : 'Could expand',
    clarity: length >= 30 ? 'Adequate' : 'Consider adding detail',
  };
  return { rubric, weakAreas: weakAreas.slice(0, 4), suggestions: suggestions.slice(0, 4) };
}

export async function run({ userId, messages, context, args }) {
  if (!userId) return { reply: 'userId required', suggestions: [], citations: [] };

  const attempt = (args || '').trim();
  if (!attempt) {
    return {
      reply: 'Usage: /check <your attempt> — paste your draft or answer and I\'ll give feedback (structure, gaps, hints). I won\'t give the final answer.',
      suggestions: [],
      structured: null,
      citations: [],
    };
  }
  if (looksLikeAskingForAnswer(attempt)) {
    return {
      reply: "I can't generate solutions or full submissions. Try /tasks or /check.",
      suggestions: [],
      structured: null,
      citations: [],
    };
  }
  const fb = deterministicFeedback(attempt);
  if (!fb) {
    return { reply: 'Paste your attempt after /check so I can give feedback.', suggestions: [], structured: null, citations: [] };
  }
  const reply = [
    'Feedback on your attempt:',
    '',
    'Rubric:',
    `• Structure: ${fb.rubric.structure}`,
    `• Length: ${fb.rubric.length}`,
    `• Clarity: ${fb.rubric.clarity}`,
    '',
    'Areas to improve:',
    ...fb.weakAreas.map((s) => `• ${s}`),
    '',
    'Suggestions:',
    ...fb.suggestions.map((s) => `• ${s}`),
  ].join('\n');
  return {
    reply,
    suggestions: [],
    structured: { rubric: fb.rubric, weakAreas: fb.weakAreas, suggestions: fb.suggestions },
    citations: [],
  };
}
