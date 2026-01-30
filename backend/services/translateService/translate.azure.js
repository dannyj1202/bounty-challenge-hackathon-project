/**
 * Azure AI Translator - REST integration.
 * Requires: AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION or AZURE_TRANSLATOR_ENDPOINT
 */

export async function translate({ text, toLanguage = 'es' }) {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || `https://api.cognitive.microsofttranslator.com`;
  if (!key) throw new Error('Azure Translator: AZURE_TRANSLATOR_KEY required');

  const url = `${endpoint.replace(/\/$/, '')}/translate?api-version=3.0&to=${toLanguage}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ text }]),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure Translator error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const translatedText = data[0]?.translations?.[0]?.text || text;
  const fromLanguage = data[0]?.detectedLanguage?.language || 'en';
  return { translatedText, fromLanguage, toLanguage };
}
