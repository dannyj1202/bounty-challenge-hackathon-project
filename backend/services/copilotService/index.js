/**
 * Copilot service - provider switch: mock vs Azure OpenAI.
 * USE_AZURE_OPENAI=true + credentials => Azure OpenAI; otherwise mock.
 */

const useAzure = process.env.USE_AZURE_OPENAI === 'true' &&
  process.env.AZURE_OPENAI_ENDPOINT &&
  process.env.AZURE_OPENAI_API_KEY;

const mod = useAzure
  ? await import('./copilot.azureOpenAI.js')
  : await import('./copilot.mock.js');

export const chat = mod.chat;
export const generateStudyPlan = mod.generateStudyPlan;
export const generateQuiz = mod.generateQuiz;
export const getWeakTopicsAndSuggestions = mod.getWeakTopicsAndSuggestions;
