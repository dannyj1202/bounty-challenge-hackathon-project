/**
 * Search service - provider switch: mock vs Azure AI Search.
 */

const useAzure = process.env.USE_AZURE_SEARCH === 'true' &&
  process.env.AZURE_SEARCH_ENDPOINT &&
  process.env.AZURE_SEARCH_KEY &&
  process.env.AZURE_SEARCH_INDEX;

const mod = useAzure
  ? await import('./search.azureSearch.js')
  : await import('./search.mock.js');

export const search = mod.search;
