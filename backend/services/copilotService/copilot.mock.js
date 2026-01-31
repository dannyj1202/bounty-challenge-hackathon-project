/**
 * Mock Copilot service - returns canned responses for demo without Azure OpenAI.
 */

export async function generateChatCompletion({ system, messages } = {}) {
  const last = messages?.filter((m) => m.role === 'user').pop();
  const content = last?.content ? String(last.content).slice(0, 200) : 'Hello';
  return { content: `[Mock] I understand: "${content}...". Set USE_AZURE_OPENAI=true for real AI.` };
}

export async function* streamChatCompletion({ system, messages } = {}) {
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

export async function generateQuiz({ topic, difficulty, numQuestions = 5, userId }) {
  const questions = Array.from({ length: numQuestions }, (_, i) => ({
    id: `q${i + 1}`,
    question: `[Mock] ${topic} - Question ${i + 1}: What is the best approach?`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: i % 4,
  }));
  return { questions, topic, difficulty };
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
