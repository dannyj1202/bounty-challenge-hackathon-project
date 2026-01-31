/**
 * Azure Document Intelligence: extract text from file buffer using prebuilt-read.
 * ESM only. Uses fetch (REST API). No SDK dependency.
 * Env: AZURE_DOCINTEL_ENDPOINT, AZURE_DOCINTEL_KEY, AZURE_DOCINTEL_MODEL (default prebuilt-read).
 */

const USE_DI = process.env.USE_AZURE_DOCUMENT_INTELLIGENCE === 'true';
const ENDPOINT = (process.env.AZURE_DOCINTEL_ENDPOINT || '').replace(/\/$/, '');
const KEY = process.env.AZURE_DOCINTEL_KEY || '';
const MODEL = process.env.AZURE_DOCINTEL_MODEL || 'prebuilt-read';
const API_VERSION = '2024-11-30';
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 120000;

function getConfig() {
  if (!USE_DI || !ENDPOINT || !KEY) throw new Error('Document Intelligence is disabled or missing AZURE_DOCINTEL_*');
  return { endpoint: ENDPOINT, key: KEY, model: MODEL };
}

/**
 * Analyze document (binary). Returns extracted text.
 * 1) POST analyze → 202 + Operation-Location
 * 2) Poll GET until status succeeded
 * 3) Extract content from result
 */
export async function extractTextFromBuffer(buffer, mimeType) {
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('extractTextFromBuffer requires a Buffer');
  const { endpoint, key, model } = getConfig();
  const analyzeUrl = `${endpoint}/documentintelligence/documentModels/${model}:analyze?api-version=${API_VERSION}`;

  const res = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': mimeType || 'application/octet-stream',
    },
    body: buffer,
  });
  if (res.status !== 202) {
    const text = await res.text();
    throw new Error(`Document Intelligence analyze: ${res.status} ${text}`);
  }
  const operationLocation = res.headers.get('Operation-Location');
  if (!operationLocation) throw new Error('Document Intelligence: no Operation-Location in response');

  const deadline = Date.now() + MAX_POLL_MS;
  let result;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollRes = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });
    if (!pollRes.ok) throw new Error(`Document Intelligence poll: ${pollRes.status} ${await pollRes.text()}`);
    result = await pollRes.json();
    const status = result.status?.toLowerCase();
    if (status === 'succeeded') break;
    if (status === 'failed') throw new Error(result.error?.message || 'Document Intelligence analysis failed');
  }
  if (!result || result.status?.toLowerCase() !== 'succeeded') throw new Error('Document Intelligence: timeout waiting for result');

  const analyzeResult = result.analyzeResult || result.result || {};
  if (analyzeResult.content && typeof analyzeResult.content === 'string') {
    return analyzeResult.content.trim();
  }
  const parts = [];
  const pages = analyzeResult.pages || [];
  for (const page of pages) {
    for (const line of page.lines || []) {
      if (line.content) parts.push(line.content);
    }
  }
  return parts.join('\n').trim() || '';
}

export function isAvailable() {
  return USE_DI && !!ENDPOINT && !!KEY;
}
