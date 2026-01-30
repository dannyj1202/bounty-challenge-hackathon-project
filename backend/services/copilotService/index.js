/**
 * Copilot service - provider switch: mock vs Azure OpenAI.
 * Default: mock.
 * Real Azure OpenAI only when USE_AZURE_OPENAI=true and required env vars exist.
 */

const hasAzureCreds =
  process.env.USE_AZURE_OPENAI === 'true' &&
  !!process.env.AZURE_OPENAI_ENDPOINT &&
  !!process.env.AZURE_OPENAI_API_KEY &&
  !!process.env.AZURE_OPENAI_DEPLOYMENT; // strongly recommended

let mod;
let provider = 'mock';

if (hasAzureCreds) {
  try {
    mod = await import('./copilot.azureOpenAI.js');
    provider = 'azure-openai';
  } catch (e) {
    console.warn('[copilot] Failed to load Azure OpenAI provider. Falling back to mock.', e.message);
    mod = await import('./copilot.mock.js');
    provider = 'mock';
  }
} else {
  mod = await import('./copilot.mock.js');
  provider = 'mock';
}

// Print once so the whole team knows what mode they’re in
console.log(`[copilot] provider=${provider}`);

export const chat = mod.chat;
export const generateStudyPlan = mod.generateStudyPlan;
export const generateQuiz = mod.generateQuiz;
export const getWeakTopicsAndSuggestions = mod.getWeakTopicsAndSuggestions;
