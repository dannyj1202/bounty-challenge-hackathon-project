/**
 * Mock Azure AI Search (RAG) - returns empty/canned results for demo.
 */

export async function search({ query, top = 5, filters = {} }) {
  return {
    results: [
      { id: 'mock1', title: 'Mock result 1', content: '[Mock] Configure Azure AI Search for RAG over your notes.', score: 0.9 },
      { id: 'mock2', title: 'Mock result 2', content: '[Mock] Set USE_AZURE_SEARCH=true and index your study materials.', score: 0.8 },
    ],
    totalCount: 2,
  };
}
