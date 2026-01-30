/**
 * Azure AI Search - query integration for RAG.
 * TODO: Index study notes/content; then query here.
 * Requires: AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY, AZURE_SEARCH_INDEX
 */

export async function search({ query, top = 5, filters = {} }) {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const key = process.env.AZURE_SEARCH_KEY;
  const index = process.env.AZURE_SEARCH_INDEX;
  if (!endpoint || !key || !index) {
    throw new Error('Azure AI Search: AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY, AZURE_SEARCH_INDEX required');
  }

  const url = `${endpoint.replace(/\/$/, '')}/indexes/${index}/docs/search?api-version=2023-11-01`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': key,
    },
    body: JSON.stringify({ search: query, top, queryType: 'simple' }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure Search error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const results = (data.value || []).map((d) => ({
    id: d.id,
    title: d.title || d.id,
    content: d.content || d.text || '',
    score: d['@search.score'] || 0,
  }));
  return { results, totalCount: data['@odata.count'] ?? results.length };
}
