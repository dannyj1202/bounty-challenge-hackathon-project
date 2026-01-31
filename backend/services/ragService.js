/**
 * RAG service: query → embed → vector search → citations + context for GPT-4o.
 * 1) Optional: use provided document text as context (no search).
 * 2) Else: embed query, retrieve topK from Azure Search, return citations + context.
 * ESM only. Uses azureOpenAIClient + azureSearchClient.
 */

import { embedOne, isConfigured as openAiConfigured } from './azureOpenAIClient.js';
import * as search from './azureSearchClient.js';

const DEFAULT_TOP_K = 5;
const CONTEXT_CAP = 12000;

/**
 * Get RAG context for a query.
 * @param {object} opts - { query, documentText?, useRag?, topK?, userId? }
 * @returns {Promise<{ contextText: string, citations: Array<{ id, content, score }> }>}
 */
export async function getRagContext({ query, documentText, useRag = true, topK = DEFAULT_TOP_K, userId } = {}) {
  const citations = [];
  let contextText = '';

  if (documentText && String(documentText).trim().length > 0) {
    contextText = String(documentText).trim().slice(0, CONTEXT_CAP);
    citations.push({ id: 'provided', content: contextText.slice(0, 500), score: 1 });
  }

  if (useRag && openAiConfigured() && search.isConfigured() && query && String(query).trim()) {
    try {
      const queryVector = await embedOne(String(query).trim());
      if (!queryVector || !Array.isArray(queryVector)) return { contextText, citations };

      const { results } = await search.vectorSearch({
        queryVector,
        topK,
      });
      for (const r of results) {
        if (r.content) {
          contextText += (contextText ? '\n\n' : '') + r.content.slice(0, 2000);
          citations.push({ id: r.id, content: r.content.slice(0, 300), score: r.score });
        }
      }
      if (contextText.length > CONTEXT_CAP) contextText = contextText.slice(0, CONTEXT_CAP);
    } catch (e) {
      console.warn('[ragService] vector search failed:', e.message);
    }
  }

  return { contextText: contextText.trim(), citations };
}

/**
 * Build a system/user prompt snippet that includes RAG context and citation instructions.
 */
export function buildPromptWithRag({ contextText, citations, instruction }) {
  let out = instruction || 'Use the following context to answer.';
  if (contextText) {
    out += '\n\nContext:\n' + contextText;
  }
  if (citations && citations.length > 0) {
    out += '\n\nCite sources by id when relevant (e.g. [id: doc-1]).';
  }
  return out;
}
