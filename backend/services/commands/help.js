const ALLOWED_COMMANDS = [
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
];

export function run() {
  const list = ALLOWED_COMMANDS.map((c) => `- /${c}`).join('\n');

  const reply = [
    'Supported commands (messages must start with /):',
    '',
    list,
    '',
    'Examples:',
    '- /help',
    '- /plan math exam Friday',
    '- /tasks add "Read chapter 3" due tomorrow',
    '- /check Here\'s my attempt: ...',
  ].join('\n');

  return { reply, suggestions: [] };
}
