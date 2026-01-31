/**
 * Azure OpenAI: chat completions + embeddings.
 * ESM only. Uses fetch.
 * Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION,
 *      AZURE_OPENAI_EMBEDDING_DEPLOYMENT (optional; default text-embedding-ada-002).
 */

const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_EMBEDDING_DEPLOYMENT = 'text-embedding-ada-002';

function getChatConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
  if (!endpoint || !key) throw new Error('Azure OpenAI: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY required');
  return { endpoint: endpoint.replace(/\/$/, ''), key, deployment, apiVersion };
}

function getEmbeddingConfig() {
  const { endpoint, key, apiVersion } = getChatConfig();
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || DEFAULT_EMBEDDING_DEPLOYMENT;
  return { endpoint, key, deployment, apiVersion };
}

/** Chat completion (non-streaming). */
export async function chatCompletion({ system, messages, temperature = 0.7, maxTokens = 800, responseFormat } = {}) {
  const { endpoint, key, deployment, apiVersion } = getChatConfig();
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const body = {
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (responseFormat) body.response_format = responseFormat;

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
    const text = await res.text();
    if (!res.ok) {
      let msg = `Azure OpenAI: ${res.status} ${text}`;
      try {
        const errBody = JSON.parse(text);
        if (errBody?.error?.code === 'DeploymentNotFound') {
          msg = `Azure OpenAI deployment not found. Set AZURE_OPENAI_DEPLOYMENT to the exact deployment name from Azure OpenAI Studio (Deployments tab). Current value: "${deployment}". Raw: ${text}`;
        }
      } catch {}
      throw new Error(msg);
    }
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content ?? '';
    return { content };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/** Chat completion streaming: async iterable of text deltas. */
export async function* chatCompletionStream({ system, messages, temperature = 0.7, maxTokens = 800 } = {}) {
  const { endpoint, key, deployment, apiVersion } = getChatConfig();
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
  if (!res.ok) {
    const errText = await res.text();
    let msg = `Azure OpenAI: ${res.status} ${errText}`;
    try {
      const errBody = JSON.parse(errText);
      if (errBody?.error?.code === 'DeploymentNotFound') {
        msg = `Azure OpenAI deployment not found. Set AZURE_OPENAI_DEPLOYMENT to the exact deployment name from Azure OpenAI Studio (Deployments tab). Current value: "${deployment}".`;
      }
    } catch {}
    throw new Error(msg);
  }

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

/** Embeddings: single text or array of texts. Returns array of embedding arrays. */
export async function embed(textOrTexts) {
  const { endpoint, key, deployment, apiVersion } = getEmbeddingConfig();
  const url = `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
  const input = Array.isArray(textOrTexts) ? textOrTexts : [textOrTexts];
  if (input.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({ input }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text();
      let msg = `Azure OpenAI embeddings: ${res.status} ${errText}`;
      try {
        const errBody = JSON.parse(errText);
        if (errBody?.error?.code === 'DeploymentNotFound') {
          msg = `Azure OpenAI embedding deployment not found. Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT to the exact deployment name from Azure OpenAI Studio (Deployments tab). Current value: "${deployment}".`;
        }
      } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    const out = (data.data || []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((d) => d.embedding);
    return out;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/** Single text → single embedding vector. */
export async function embedOne(text) {
  const arr = await embed(text);
  return arr[0] || null;
}

export function isConfigured() {
  return !!(
    process.env.USE_AZURE_OPENAI === 'true' &&
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

export function isEmbeddingConfigured() {
  return isConfigured() && (process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || true);
}
