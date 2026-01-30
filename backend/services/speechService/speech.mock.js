/**
 * Mock Speech service - returns canned transcript for demo without Azure Speech.
 */

export async function transcribe({ audioBase64, contentType = 'audio/wav' }) {
  return {
    text: '[Mock] This is a mock transcript. Configure Azure Speech (USE_AZURE_SPEECH=true, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION) for real speech-to-text.',
    confidence: 0.9,
  };
}
