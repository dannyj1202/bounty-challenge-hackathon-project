/**
 * /help — list commands + examples. No model call. Returns structured JSON for frontend.
 */

const COMMANDS = [
  { cmd: '/help', description: 'List commands and examples' },
  { cmd: '/plan', description: 'Propose study blocks from assignments and calendar' },
  { cmd: '/reschedule', description: 'Suggest alternative study block times' },
  { cmd: '/summarize', description: 'Summary, key points, definitions, next steps' },
  { cmd: '/flashcards', description: 'Generate flashcards from content' },
  { cmd: '/quiz', description: 'Generate quiz questions from content' },
  { cmd: '/check', description: 'Get feedback on your attempt (no full answers)' },
  { cmd: '/tasks', description: 'Task breakdown and suggestions' },
  { cmd: '/deadline', description: 'Milestones and reminders for a due date' },
  { cmd: '/notes', description: 'List, show, or search notes; or organize content' },
];

const EXAMPLES = [
  '/help',
  '/plan',
  '/tasks add "Read chapter 3" due 2026-02-15',
  '/summarize <text or use uploaded doc>',
  '/flashcards <text or use note>',
  '/quiz <topic or use doc>',
  '/check Here is my attempt: ...',
  '/notes',
  '/notes search mitosis',
  '/deadline 2026-02-15',
];

export function run() {
  const list = COMMANDS.map((c) => `- ${c.cmd}: ${c.description}`).join('\n');
  const examples = EXAMPLES.map((e) => `- ${e}`).join('\n');
  const reply = [
    'Supported commands (messages must start with /):',
    '',
    list,
    '',
    'Examples:',
    examples,
  ].join('\n');

  return {
    reply,
    suggestions: [],
    structured: { commands: COMMANDS, examples: EXAMPLES },
    citations: [],
  };
}
