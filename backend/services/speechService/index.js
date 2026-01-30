/**
 * Speech service - provider switch: mock vs Azure Speech.
 */

const useAzure = process.env.USE_AZURE_SPEECH === 'true' &&
  process.env.AZURE_SPEECH_KEY &&
  process.env.AZURE_SPEECH_REGION;

const mod = useAzure
  ? await import('./speech.azure.js')
  : await import('./speech.mock.js');

export const transcribe = mod.transcribe;
