/**
 * Mock Copilot service - returns canned responses for demo without Azure OpenAI.
 */

export async function generateChatCompletion({ system, messages } = {}) {
  console.log('[copilot] response via provider=fallback (mock)');
  const last = messages?.filter((m) => m.role === 'user').pop();
  const content = last?.content ? String(last.content).slice(0, 200) : 'Hello';
  return { content: `[Mock] I understand: "${content}...". Set USE_AZURE_OPENAI=true for real AI.` };
}

export async function* streamChatCompletion({ system, messages } = {}) {
  console.log('[copilot] response via provider=fallback (mock)');
  const last = messages?.filter((m) => m.role === 'user').pop();
  const content = last?.content ? String(last.content).slice(0, 200) : 'Hello';
  const text = `[Mock] I understand: "${content}...". Set USE_AZURE_OPENAI=true for real AI.`;
  for (const chunk of text.split(/(?<= )/)) yield chunk;
}

export async function chat({ messages, context = {} }) {
  const lastUser = messages.filter(m => m.role === 'user').pop();
  const query = lastUser?.content || 'Hello';

  return {
    reply: `[Mock] I understand you're asking about: "${String(query).slice(0, 80)}...". In production, Azure OpenAI would generate a personalized study response here.`,
    explanation: 'This is a mock response. Set USE_AZURE_OPENAI=true and configure Azure OpenAI credentials for real AI responses.',
    confidence: 0.85,
  };
}

export async function generateStudyPlan({ assignments = [], events = [], userId }) {
  return {
    blocks: [
      { start: '08:00', end: '09:30', title: 'Study block 1', suggestedTopic: assignments[0]?.title || 'General review' },
      { start: '14:00', end: '15:30', title: 'Study block 2', suggestedTopic: assignments[1]?.title || 'Practice problems' },
      { start: '19:00', end: '20:00', title: 'Study block 3', suggestedTopic: 'Review notes' },
    ],
    explanation: 'Mock study plan based on your calendar. Accept to create events, or edit times.',
    confidence: 0.8,
  };
}

const MOCK_QUESTION_STEMS = [
  'What is a key concept or principle in this topic?',
  'Which of the following best describes an important aspect?',
  'What is the main benefit or purpose?',
  'Which statement is most accurate?',
  'What would be a correct application of this topic?',
];

export async function generateQuiz({ topic, difficulty, numQuestions = 5, userId }) {
  const t = String(topic || 'General study').trim();
  const questions = Array.from({ length: Math.min(numQuestions, 5) }, (_, i) => ({
    id: `q${i + 1}`,
    question: `${t}: ${MOCK_QUESTION_STEMS[i % MOCK_QUESTION_STEMS.length]}`,
    options: [
      `A key idea related to ${t.slice(0, 40)}${t.length > 40 ? '…' : ''}`,
      'A common misconception or partial truth',
      'Another relevant concept or application',
      'The most accurate or complete answer',
    ],
    correctIndex: i % 4,
  }));
  return { questions, topic: t, difficulty };
}

export async function getWeakTopicsAndSuggestions({ quizId, answers, userId }) {
  return {
    score: Math.floor(60 + Math.random() * 35),
    weakTopics: ['Topic A', 'Topic B'],
    suggestions: [
      { priority: 1, action: 'Review Topic A with practice problems', topic: 'Topic A' },
      { priority: 2, action: 'Watch summary video for Topic B', topic: 'Topic B' },
    ],
    explanation: 'Mock analysis. Focus on weak topics first.',
    confidence: 0.82,
  };
}
