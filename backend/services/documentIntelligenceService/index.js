/**
 * Azure AI Document Intelligence (Form Recognizer) — text extraction from PDF/images.
 * Uses prebuilt-read by default. Graceful fallback when disabled or on error.
 * Do not log or expose secrets.
 */

const USE_DI = process.env.USE_AZURE_DOCUMENT_INTELLIGENCE === 'true';
const ENDPOINT = process.env.AZURE_DOCINTEL_ENDPOINT || '';
const KEY = process.env.AZURE_DOCINTEL_KEY || '';
const MODEL = process.env.AZURE_DOCINTEL_MODEL || 'prebuilt-read';
const EXTRACT_TIMEOUT_MS = 60_000;

let _client = null;

function getClient() {
  if (!USE_DI || !ENDPOINT || !KEY) return null;
  if (_client) return _client;
  try {
    const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
    _client = new DocumentAnalysisClient(ENDPOINT.trim(), new AzureKeyCredential(KEY));
    return _client;
  } catch (e) {
    console.warn('[documentIntelligence] SDK not available:', e.message);
    return null;
  }
}

/**
 * Extract plain text from document buffer using Azure Document Intelligence.
 * @param {Buffer} buffer - Raw file bytes
 * @param {string} [mimeType] - e.g. application/pdf, image/png, image/jpeg (optional; SDK infers from content)
 * @returns {Promise<string>} Extracted text, or throws with clear message if DI disabled/error
 */
export async function extractTextFromBuffer(buffer, mimeType) {
  if (!USE_DI || !ENDPOINT || !KEY) {
    throw new Error('Document Intelligence is disabled. Set USE_AZURE_DOCUMENT_INTELLIGENCE=true and configure AZURE_DOCINTEL_* in .env.');
  }
  const client = getClient();
  if (!client) {
    throw new Error('Document Intelligence client could not be created. Check AZURE_DOCINTEL_* configuration.');
  }
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('extractTextFromBuffer requires a Buffer.');
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Document Intelligence request timed out.')), EXTRACT_TIMEOUT_MS);
  });

  const analyzePromise = (async () => {
    const poller = await client.beginAnalyzeDocument(MODEL, buffer);
    const result = await poller.pollUntilDone();
    if (result?.content && typeof result.content === 'string') {
      return result.content.trim();
    }
    const parts = [];
    if (result?.pages) {
      for (const page of result.pages) {
        if (page.lines && Array.isArray(page.lines)) {
          for (const line of page.lines) {
            if (line.content) parts.push(line.content);
          }
        }
      }
    }
    return parts.join('\n').trim() || '';
  })();

  try {
    return await Promise.race([analyzePromise, timeoutPromise]);
  } catch (e) {
    const msg = e.message || 'Document Intelligence failed.';
    console.warn('[documentIntelligence]', msg);
    throw new Error(msg);
  }
}

export const isAvailable = () => USE_DI && !!ENDPOINT && !!KEY;
