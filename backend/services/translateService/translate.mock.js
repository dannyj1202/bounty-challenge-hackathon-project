/**
 * Mock Translator service - returns canned translation for demo.
 */

export async function translate({ text, toLanguage = 'es' }) {
  const langNames = { es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese' };
  const name = langNames[toLanguage] || toLanguage;
  return {
    translatedText: `[Mock] Translation to ${name}: "${String(text).slice(0, 50)}..." — Configure Azure Translator for real translation.`,
    fromLanguage: 'en',
    toLanguage,
  };
}
