/**
 * Azure AI Search: vector search + upsert documents.
 * Index "documents" with fields: id, content, embedding (Collection(Embedding)).
 * ESM only. Uses fetch.
 * Env: AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY, AZURE_SEARCH_INDEX.
 */

const DEFAULT_API_VERSION = '2023-11-01';
const VECTOR_FIELD = 'embedding';

function getConfig() {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const key = process.env.AZURE_SEARCH_KEY;
  const index = process.env.AZURE_SEARCH_INDEX || 'documents';
  if (!endpoint || !key) throw new Error('Azure Search: AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_KEY required');
  return { endpoint: endpoint.replace(/\/$/, ''), key, index };
}

/**
 * Vector search: queryVector is array of numbers; returns { results: [{ id, content, score }], totalCount }.
 */
export async function vectorSearch({ queryVector, topK = 5, filter }) {
  const { endpoint, key, index } = getConfig();
  const apiVersion = process.env.AZURE_SEARCH_API_VERSION || DEFAULT_API_VERSION;
  const url = `${endpoint}/indexes/${index}/docs/search?api-version=${apiVersion}`;
  const body = {
    vectorQueries: [
      { vector: queryVector, k: topK, fields: VECTOR_FIELD },
    ],
    select: 'id,content',
  };
  if (filter) body.filter = filter;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Azure Search: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const results = (data.value || []).map((d) => ({
    id: d.id,
    content: d.content || '',
    score: d['@search.score'] ?? 0,
  }));
  return { results, totalCount: data['@odata.count'] ?? results.length };
}

/**
 * Upsert documents. Each doc: { id, content, embedding }.
 */
export async function upsertDocuments(documents) {
  if (!documents || documents.length === 0) return { succeeded: 0, failed: 0 };
  const { endpoint, key, index } = getConfig();
  const apiVersion = process.env.AZURE_SEARCH_API_VERSION || DEFAULT_API_VERSION;
  const url = `${endpoint}/indexes/${index}/docs/index?api-version=${apiVersion}`;
  const value = documents.map((d) => ({
    '@search.action': 'upload',
    id: String(d.id),
    content: String(d.content ?? ''),
    [VECTOR_FIELD]: Array.isArray(d.embedding) ? d.embedding : [],
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`Azure Search upsert: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const succeeded = (data.value || []).filter((x) => x.status === 201 || x.status === 200).length;
  const failed = (data.value || []).filter((x) => x.status !== 201 && x.status !== 200).length;
  return { succeeded, failed, results: data.value };
}

/**
 * Simple keyword search (fallback when no vector). Uses search= query.
 */
export async function simpleSearch({ query, top = 5 }) {
  const { endpoint, key, index } = getConfig();
  const apiVersion = process.env.AZURE_SEARCH_API_VERSION || DEFAULT_API_VERSION;
  const url = `${endpoint}/indexes/${index}/docs/search?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ search: query || '*', top, select: 'id,content' }),
  });
  if (!res.ok) throw new Error(`Azure Search: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const results = (data.value || []).map((d) => ({
    id: d.id,
    content: d.content || '',
    score: d['@search.score'] ?? 0,
  }));
  return { results, totalCount: data['@odata.count'] ?? results.length };
}

export function isConfigured() {
  return !!(
    process.env.USE_AZURE_SEARCH === 'true' &&
    process.env.AZURE_SEARCH_ENDPOINT &&
    process.env.AZURE_SEARCH_KEY &&
    process.env.AZURE_SEARCH_INDEX
  );
}
