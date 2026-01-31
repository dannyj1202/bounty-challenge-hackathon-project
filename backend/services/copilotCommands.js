/**
 * Command router for /api/copilot/chat. Parses /command and dispatches.
 * Includes global "no cheating" guard: refuses clear do-my-work requests; allows study help.
 *
 * Quick curl examples:
 *
 * 1) Cheating request (refused):
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u","messages":[{"role":"user","content":"/solve write my essay for me"}]}'
 *
 * 2) Legitimate request (allowed, e.g. /help):
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u","messages":[{"role":"user","content":"/help"}]}'
 *
 * 3) Unknown command, not cheating (returns /help guidance):
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u","messages":[{"role":"user","content":"/foo"}]}'
 *
 * 4) /plan returns suggestions (2–5 create_calendar_block suggestions):
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/plan"}]}'
 *
 * 5) Accept one suggestion (creates event via existing accept endpoint):
 *    curl -s -X POST http://localhost:3001/api/copilot/suggestions/<suggestion-id>/accept \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e"}'
 *
 * 6) /tasks (no args) → task suggestions from upcoming assignments:
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/tasks"}]}'
 *
 * 7) /deadline (no args) → milestone tasks from nearest assignment dueDate:
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/deadline"}]}'
 *
 * 8) /reschedule (no args) → alternative calendar blocks for next "Study:" event:
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/reschedule"}]}'
 *
 * Phase 3 (read-only, no suggestions):
 *
 * 9) /notes — list last 5 notes; /notes show 1 — show first; /notes search <keyword>:
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/notes"}]}'
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/notes search mitosis"}]}'
 *
 * 10) /summarize <text> or /summarize (last 1–3 notes):
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/summarize Photosynthesis uses light and water."}]}'
 *
 * 11) /flashcards <text> or /flashcards (last note); max 6 cards:
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/flashcards The mitochondria is the powerhouse of the cell."}]}'
 *
 * 12) /quiz <text> or /quiz (last note); 5 questions + answer key:
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/quiz Chapter 3 covers demand and supply."}]}'
 *
 * 13) /check <your attempt> — feedback only; refuses "give me the answer":
 *    curl -s -X POST http://localhost:3001/api/copilot/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"userId":"u-e2e","messages":[{"role":"user","content":"/check Here is my attempt: Demand increases when price falls."}]}'
 */

import { run as runHelp } from './commands/help.js';
import { run as runPlan } from './commands/plan.js';
import { run as runTasks } from './commands/tasks.js';
import { run as runDeadline } from './commands/deadline.js';
import { run as runReschedule } from './commands/reschedule.js';
import { run as runNotes } from './commands/notes.js';
import { run as runSummarize } from './commands/summarize.js';
import { run as runFlashcards } from './commands/flashcards.js';
import { run as runQuiz } from './commands/quiz.js';
import { run as runCheck } from './commands/check.js';

const ALLOWED = new Set([
  'help',
  'plan',
  'reschedule',
  'summarize',
  'flashcards',
  'quiz',
  'check',
  'tasks',
  'deadline',
  'notes',
]);

// Unsupported commands that imply "do it for me" when user tries to use them
const CHEATING_COMMANDS = new Set(['solve', 'write', 'answer', 'submit', 'complete']);

const CHEATING_PHRASES = [
  'write my assignment',
  'write my essay',
  'do my homework',
  'solve it for me',
  'solve my assignment',
  'solve my homework',
  'give me the exact answer',
  'complete the assignment for me',
  'do my assignment',
  'write this for me',
  'answer it for me',
  'submit it for me',
  'complete it for me',
  'write my paper',
  'do my essay',
];

const REFUSAL_REPLY = [
  "I can't do the assignment for you. I'm here to support your learning, not to do the work for you.",
  '',
  'Try instead:',
  '- /check — get feedback on your attempt',
  '- /plan — study plan suggestions',
  '- /tasks — task breakdown',
].join('\n');

function looksLikeCheatingIntent(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();
  return CHEATING_PHRASES.some((phrase) => lower.includes(phrase));
}

export async function execute({ userId, messages, context } = {}) {
  const latestUser = [...(messages || [])].reverse().find((m) => m && m.role === 'user');
  const raw = latestUser && latestUser.content ? String(latestUser.content).trim() : '';

  // Safe fallback (route already gates)
  if (!raw.startsWith('/')) {
    return { reply: 'Use a command like /help', suggestions: [] };
  }

  // Global no-cheating guard: refuse clear "do my work" intent before any dispatch
  if (looksLikeCheatingIntent(raw)) {
    return { reply: REFUSAL_REPLY, suggestions: [] };
  }

  const afterSlash = raw.slice(1).trim();
  const [cmdRaw, ...rest] = afterSlash.split(/\s+/);
  const cmd = (cmdRaw || '').toLowerCase();
  const args = rest.join(' ').trim();

  if (!cmd) return { reply: 'Type a command after "/". Try /help', suggestions: [] };

  if (CHEATING_COMMANDS.has(cmd)) return { reply: REFUSAL_REPLY, suggestions: [] };

  // Unknown command: if message looks like cheating intent, refuse; else help
  if (!ALLOWED.has(cmd)) {
    if (looksLikeCheatingIntent(raw)) return { reply: REFUSAL_REPLY, suggestions: [] };
    return { reply: 'Unknown command. Try /help', suggestions: [] };
  }

  if (cmd === 'help') return runHelp({ userId, messages, context, args });
  if (cmd === 'plan') return runPlan({ userId, messages, context, args });
  if (cmd === 'tasks') return runTasks({ userId, messages, context, args });
  if (cmd === 'deadline') return runDeadline({ userId, messages, context, args });
  if (cmd === 'reschedule') return runReschedule({ userId, messages, context, args });
  if (cmd === 'notes') return runNotes({ userId, messages, context, args });
  if (cmd === 'summarize') return runSummarize({ userId, messages, context, args });
  if (cmd === 'flashcards') return runFlashcards({ userId, messages, context, args });
  if (cmd === 'quiz') return runQuiz({ userId, messages, context, args });
  if (cmd === 'check') return runCheck({ userId, messages, context, args });

  return {
    reply: `/${cmd} is recognized but not implemented yet. Try /help.`,
    suggestions: [],
  };
}
