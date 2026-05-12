// IA Mapper — Whisper Transcription Worker (offscreen document)
// Runs Transformers.js Whisper model for local speech-to-text.
// Communicates with background via a dedicated port (not runtime.sendMessage).

import { pipeline, env } from './lib/transformers.min.js';

env.allowLocalModels = false;

let transcriber = null;
let modelLoading = false;
let currentModel = null;

// Connect to background via port
const port = chrome.runtime.connect({ name: 'whisper' });

/**
 * Load or return the cached transcription pipeline.
 */
async function getTranscriber(modelId, onProgress) {
  if (transcriber && currentModel === modelId) return transcriber;

  if (modelLoading) {
    while (modelLoading) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (transcriber && currentModel === modelId) return transcriber;
  }

  modelLoading = true;
  currentModel = modelId;

  try {
    console.log('[whisper] Loading model:', modelId);

    transcriber = await pipeline(
      'automatic-speech-recognition',
      modelId,
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (progress) => {
          if (onProgress && progress.status === 'progress') {
            onProgress({
              file: progress.file,
              loaded: progress.loaded,
              total: progress.total,
              progress: progress.progress,
            });
          }
          if (progress.status === 'done') {
            console.log('[whisper] Model file loaded:', progress.file);
          }
        },
      }
    );

    console.log('[whisper] Model ready:', modelId);
  } catch (err) {
    console.error('[whisper] Model load failed:', err);
    transcriber = null;
    throw err;
  } finally {
    modelLoading = false;
  }

  return transcriber;
}

/**
 * Transcribe audio data.
 */
async function transcribe(audioData, modelId) {
  const pipe = await getTranscriber(modelId, (progress) => {
    port.postMessage({
      type: 'WHISPER_PROGRESS',
      ...progress,
    });
  });

  console.log('[whisper] Transcribing', audioData.length, 'samples...');

  const result = await pipe(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    language: 'en',
  });

  console.log('[whisper] Result:', result);
  return result;
}

// Listen for messages from background via port
port.onMessage.addListener(async (message) => {
  if (message.type === 'WHISPER_TRANSCRIBE') {
    try {
      const audioData = new Float32Array(message.audioData);
      const modelId = message.modelId || 'onnx-community/whisper-base';
      const result = await transcribe(audioData, modelId);

      port.postMessage({
        type: 'WHISPER_RESULT',
        ok: true,
        text: result.text,
        chunks: result.chunks || [],
      });
    } catch (err) {
      port.postMessage({
        type: 'WHISPER_RESULT',
        ok: false,
        error: err.message || 'Transcription failed',
      });
    }
  }
});

console.log('[whisper] Offscreen document ready, port connected');
