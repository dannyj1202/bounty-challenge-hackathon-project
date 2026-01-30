/**
 * Translate service - provider switch: mock vs Azure Translator.
 */

const useAzure = process.env.USE_AZURE_TRANSLATOR === 'true' && process.env.AZURE_TRANSLATOR_KEY;

const mod = useAzure
  ? await import('./translate.azure.js')
  : await import('./translate.mock.js');

export const translate = mod.translate;
