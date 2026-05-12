// IA Mapper — Whisper Transcription Worker (offscreen document)
// Runs Transformers.js Whisper model for local speech-to-text.
// Communicates with background via a dedicated port (not runtime.sendMessage).
//
// Key design: connect the port FIRST, then lazily load the heavy Transformers.js
// library only when transcription is actually requested. This avoids the 830KB
// module parse blocking the port connection.

console.log('[whisper] Offscreen document starting...');

// ---------------------------------------------------------------------------
// Port connection — must happen immediately, before any heavy imports
// ---------------------------------------------------------------------------

let port;
try {
  port = chrome.runtime.connect({ name: 'whisper' });
  console.log('[whisper] Port connected to background');
} catch (err) {
  console.error('[whisper] Failed to connect port:', err);
}

// ---------------------------------------------------------------------------
// Lazy Transformers.js loading
// ---------------------------------------------------------------------------

let pipelineFn = null;
let envObj = null;
let transformersLoaded = false;
let transformersLoading = false;
let transformersError = null;

async function loadTransformers() {
  if (transformersLoaded) return;
  if (transformersLoading) {
    // Wait for in-flight load
    while (transformersLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (transformersError) throw transformersError;
    return;
  }

  transformersLoading = true;
  console.log('[whisper] Loading Transformers.js library...');

  try {
    const mod = await import('./lib/transformers.min.js');
    pipelineFn = mod.pipeline;
    envObj = mod.env;

    if (!pipelineFn) {
      throw new Error('Transformers.js loaded but pipeline function not found in exports');
    }

    // Configure: don't look for local model files, fetch from HuggingFace
    envObj.allowLocalModels = false;

    transformersLoaded = true;
    console.log('[whisper] Transformers.js loaded successfully');
  } catch (err) {
    transformersError = err;
    console.error('[whisper] Failed to load Transformers.js:', err);
    throw err;
  } finally {
    transformersLoading = false;
  }
}

// ---------------------------------------------------------------------------
// Whisper pipeline management
// ---------------------------------------------------------------------------

let transcriber = null;
let modelLoading = false;
let currentModel = null;

/**
 * Load or return the cached transcription pipeline.
 */
async function getTranscriber(modelId, onProgress) {
  // Ensure Transformers.js is loaded first
  await loadTransformers();

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

    transcriber = await pipelineFn(
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

// ---------------------------------------------------------------------------
// Port message handler
// ---------------------------------------------------------------------------

if (port) {
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
        console.error('[whisper] Transcription error:', err);
        port.postMessage({
          type: 'WHISPER_RESULT',
          ok: false,
          error: err.message || 'Transcription failed',
        });
      }
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('[whisper] Port disconnected from background');
  });
}

console.log('[whisper] Offscreen document ready, port connected');
