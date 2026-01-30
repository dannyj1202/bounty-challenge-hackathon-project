/**
 * Azure AI Speech (Speech-to-Text) - REST integration.
 * TODO: Azure Speech SDK or REST batch transcription; real-time may require WebSocket.
 * Requires: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
 * See: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text
 */

export async function transcribe({ audioBase64, contentType = 'audio/wav' }) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('Azure Speech: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION required');
  }

  // TODO: Implement real Azure Speech-to-Text REST call.
  // Option 1: Use recognition endpoint with binary body (audio).
  // Option 2: Use batch transcription API for longer audio.
  const buffer = Buffer.from(audioBase64, 'base64');
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': contentType,
      'Accept': 'application/json',
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure Speech error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.DisplayText || data.RecognitionStatus === 'Success' ? (data.DisplayText || '') : '';
  return { text, confidence: 0.9 };
}
