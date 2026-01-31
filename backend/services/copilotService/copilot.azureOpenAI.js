/**
 * Azure OpenAI Copilot service - real REST calls + streaming.
 * Requires: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION
 */

const DEFAULT_TIMEOUT_MS = 12000;

function getConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
  if (!endpoint || !key) throw new Error('Azure OpenAI: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY required');
  return { endpoint: endpoint.replace(/\/$/, ''), key, deployment, apiVersion };
}

/** Non-streaming completion with timeout. */
export async function generateChatCompletion({ system, messages, temperature = 0.7, maxTokens = 800 } = {}) {
  const { endpoint, key, deployment, apiVersion } = getConfig();
  // Temporary debug: confirm Azure OpenAI path is used (do not log secrets)
  console.log('[copilot] response via provider=azure-openai, deployment=' + deployment);
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const body = {
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    max_tokens: maxTokens,
    temperature,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Azure OpenAI: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    return { content };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/** Stream completion: async iterable of text deltas. Timeout applies to initial response. */
export async function* streamChatCompletion({ system, messages, temperature = 0.7, maxTokens = 800 } = {}) {
  const { endpoint, key, deployment, apiVersion } = getConfig();
  // Temporary debug: confirm Azure OpenAI path is used (do not log secrets)
  console.log('[copilot] response via provider=azure-openai, deployment=' + deployment);
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const body = {
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }

  if (!res.ok) throw new Error(`Azure OpenAI: ${res.status} ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function chat({ messages, context = {} }) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

  if (!endpoint || !key) {
    throw new Error('Azure OpenAI: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY required');
  }

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const body = {
    messages: [
      { role: 'system', content: 'You are a study assistant. Always respond with a JSON object: { "reply": "...", "explanation": "...", "confidence": 0.0-1.0 }.' },
      ...messages,
    ],
    max_tokens: 800,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure OpenAI error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { reply: content, explanation: '', confidence: 0.8 };
  }
  return {
    reply: parsed.reply ?? parsed.response ?? content,
    explanation: parsed.explanation ?? '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
  };
}

export async function generateStudyPlan({ assignments = [], events = [], userId }) {
  const result = await chat({
    messages: [
      {
        role: 'user',
        content: `Given assignments: ${JSON.stringify(assignments.map(a => ({ title: a.title, dueDate: a.dueDate })))} and events: ${JSON.stringify(events.map(e => ({ title: e.title, start: e.startAt, end: e.endAt })))}, suggest 3 study blocks as JSON: { "blocks": [ { "start": "HH:MM", "end": "HH:MM", "title": "...", "suggestedTopic": "..." } ], "explanation": "...", "confidence": 0.9 }`,
      },
    ],
  });
  try {
    const parsed = JSON.parse(result.reply);
    return { blocks: parsed.blocks || [], explanation: parsed.explanation || result.explanation, confidence: parsed.confidence ?? result.confidence };
  } catch {
    return { blocks: [], explanation: result.reply, confidence: result.confidence };
  }
}

export async function generateQuiz({ topic, difficulty, numQuestions = 5, userId }) {
  const result = await chat({
    messages: [
      {
        role: 'user',
        content: `Generate ${numQuestions} multiple-choice questions on topic "${topic}" (difficulty: ${difficulty}). Return JSON: { "questions": [ { "id": "q1", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0 } ] }`,
      },
    ],
  });
  try {
    const parsed = JSON.parse(result.reply);
    const questions = (parsed.questions || []).map((q, i) => ({ ...q, id: q.id || `q${i + 1}` }));
    return { questions, topic, difficulty };
  } catch {
    throw new Error('Azure OpenAI did not return valid quiz JSON');
  }
}

export async function getWeakTopicsAndSuggestions({ quizId, answers, userId }) {
  const result = await chat({
    messages: [
      {
        role: 'user',
        content: `Given quiz answers ${JSON.stringify(answers)}, return JSON: { "score": 0-100, "weakTopics": ["..."], "suggestions": [ { "priority": 1, "action": "...", "topic": "..." } ], "explanation": "...", "confidence": 0.9 }`,
      },
    ],
  });
  try {
    return JSON.parse(result.reply);
  } catch {
    return { score: 0, weakTopics: [], suggestions: [], explanation: result.reply, confidence: result.confidence };
  }
}
