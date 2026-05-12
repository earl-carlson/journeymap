// IA Mapper — Background Service Worker
// Tracks navigation across *.docker.com, builds the session graph.
// Infers URL-path hierarchy alongside raw navigation edges.

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let session = null;       // Active session object or null
let currentNodeId = null; // URL-hash of the node the user is currently on
let previousNodeId = null; // URL-hash of the node the user just left

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the URL belongs to *.docker.com
 */
function isDockerUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'docker.com' || hostname.endsWith('.docker.com');
  } catch {
    return false;
  }
}

/**
 * Deterministic hash of a URL (stripped of fragment).
 * Uses a simple djb2-style hash → hex string.
 * Stable across sessions so the same URL always produces the same key.
 */
function urlHash(url) {
  const u = new URL(url);
  u.hash = '';
  let normalized = u.toString().replace(/\/+$/, '');

  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Canonical URL string (no fragment, no trailing slash).
 */
function canonicalUrl(url) {
  const u = new URL(url);
  u.hash = '';
  return u.toString().replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// URL hierarchy inference
// ---------------------------------------------------------------------------

/**
 * Given a URL, return the inferred parent URL by removing the last path
 * segment. Returns null if we're already at the domain root.
 *
 * Examples:
 *   https://docs.docker.com/ai/sandboxes/security/isolation
 *     → https://docs.docker.com/ai/sandboxes/security
 *
 *   https://docs.docker.com/ai/sandboxes
 *     → https://docs.docker.com/ai
 *
 *   https://docs.docker.com/ai
 *     → https://docs.docker.com          (domain root)
 *
 *   https://docs.docker.com
 *     → null                              (already at root)
 */
function inferParentUrl(url) {
  const u = new URL(url);
  // Strip trailing slashes, split into segments
  const path = u.pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    // Already at domain root
    return null;
  }

  // Remove last segment
  segments.pop();
  u.pathname = '/' + segments.join('/');
  u.hash = '';
  u.search = '';
  return u.toString().replace(/\/+$/, '') || u.origin;
}

/**
 * Derive a human-readable title from a URL path segment.
 *   "security" → "Security"
 *   "get-started" → "Get Started"
 *   "ai" → "AI"
 */
function titleFromSegment(segment) {
  // Common acronyms
  const acronyms = new Set(['ai', 'api', 'cli', 'sdk', 'faq', 'mcp', 'ci', 'cd', 'ui', 'ux', 'sso', 'rbac']);
  if (acronyms.has(segment.toLowerCase())) {
    return segment.toUpperCase();
  }
  return segment
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Derive a stub title for a URL we haven't visited.
 *   https://docs.docker.com/ai/sandboxes → "Sandboxes (docs.docker.com)"
 *   https://docs.docker.com → "docs.docker.com"
 */
function stubTitleFromUrl(url) {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return u.hostname;
  }

  const lastSegment = segments[segments.length - 1];
  return titleFromSegment(lastSegment) + ' (' + u.hostname + ')';
}

/**
 * Get or create a node for a URL. If the node doesn't exist, create it as
 * a stub (inferred from URL, not yet visited).
 * Returns the node ID (url-hash).
 */
function ensureNode(url, title, isStub = false) {
  const canonical = canonicalUrl(url);
  const id = urlHash(canonical);

  if (!session.nodes[id]) {
    session.nodes[id] = {
      url: canonical,
      title: title || stubTitleFromUrl(canonical),
      screenshot: null,
      notes: [],
      flags: [],
      stub: isStub,
      inferredParent: null
    };
  }

  return id;
}

/**
 * Build the full ancestor chain for a URL. Creates stub nodes for any
 * intermediate paths not yet visited. Adds `child-of` edges connecting
 * each node to its parent.
 *
 * Stops at the domain root (e.g. https://docs.docker.com).
 */
function ensureAncestorChain(url) {
  let current = canonicalUrl(url);
  let currentId = urlHash(current);

  while (true) {
    const parentUrl = inferParentUrl(current);
    if (!parentUrl) break;

    const parentId = ensureNode(parentUrl, null, true);

    // Set inferredParent on the child
    if (session.nodes[currentId]) {
      session.nodes[currentId].inferredParent = parentId;
    }

    // Add child-of edge (parent → child direction for tree rendering)
    addEdge(parentId, currentId, 'child-of');

    // If the parent already has its own ancestor chain built, stop
    if (session.nodes[parentId] && session.nodes[parentId].inferredParent !== null) {
      break;
    }

    current = parentUrl;
    currentId = parentId;
  }
}

/**
 * Detect the relationship between two URLs:
 *   - 'same-domain-sibling': same parent path (e.g. /security/isolation → /security/defaults)
 *   - 'same-domain-parent-child': one is a direct parent of the other
 *   - 'same-domain-other': same domain but different branches
 *   - 'cross-domain': different subdomains (e.g. www → docs)
 */
function classifyNavigation(fromUrl, toUrl) {
  const from = new URL(fromUrl);
  const to = new URL(toUrl);

  if (from.hostname !== to.hostname) {
    return 'cross-domain';
  }

  const fromPath = from.pathname.replace(/\/+$/, '');
  const toPath = to.pathname.replace(/\/+$/, '');
  const fromSegments = fromPath.split('/').filter(Boolean);
  const toSegments = toPath.split('/').filter(Boolean);

  // Check if one is a direct parent of the other
  const fromBase = '/' + fromSegments.join('/');
  const toBase = '/' + toSegments.join('/');

  if (toBase.startsWith(fromBase + '/') && toSegments.length === fromSegments.length + 1) {
    return 'same-domain-parent-child';
  }
  if (fromBase.startsWith(toBase + '/') && fromSegments.length === toSegments.length + 1) {
    return 'same-domain-parent-child';
  }

  // Check if they share the same parent path
  const fromParent = fromSegments.slice(0, -1).join('/');
  const toParent = toSegments.slice(0, -1).join('/');

  if (fromParent === toParent && fromSegments.length === toSegments.length) {
    return 'same-domain-sibling';
  }

  return 'same-domain-other';
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

function startSession(contributor) {
  const now = new Date();
  session = {
    meta: {
      contributor: contributor || 'anonymous',
      date: now.toISOString().slice(0, 10),
      mode: 'map'
    },
    nodes: {},
    edges: [],
    workflows: []
  };
  currentNodeId = null;
  previousNodeId = null;
  persistSession();
  updateBadge();
}

function stopSession() {
  const data = session;
  session = null;
  currentNodeId = null;
  previousNodeId = null;
  chrome.storage.local.remove('ia_session');
  updateBadge();
  return data;
}

function persistSession() {
  if (session) {
    chrome.storage.local.set({ ia_session: JSON.stringify(session) });
  }
}

async function restoreSession() {
  const result = await chrome.storage.local.get('ia_session');
  if (result.ia_session) {
    try {
      session = JSON.parse(result.ia_session);
      const nodeIds = Object.keys(session.nodes);
      if (nodeIds.length > 0) {
        currentNodeId = nodeIds[nodeIds.length - 1];
      }
      updateBadge();
    } catch {
      session = null;
    }
  }
}

function updateBadge() {
  if (session) {
    const count = Object.keys(session.nodes).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/**
 * Process a navigation event.
 * 1. Create/update the node
 * 2. Record the raw navigate edge from previous node
 * 3. Build the ancestor chain (stub nodes + child-of edges)
 */
function recordNavigation(url, title, tabId) {
  if (!session) return;
  if (!isDockerUrl(url)) return;

  const canonical = canonicalUrl(url);
  const id = ensureNode(canonical, title, false);

  // If this node was previously a stub, promote it
  if (session.nodes[id].stub) {
    session.nodes[id].stub = false;
  }

  // Update title if we got a real one (better than stub-generated)
  if (title && title !== canonical) {
    session.nodes[id].title = title;
  }

  // Record raw navigation edge
  if (currentNodeId && currentNodeId !== id) {
    const fromNode = session.nodes[currentNodeId];
    const navType = classifyNavigation(fromNode.url, canonical);

    // Always record the raw navigate edge (preserves actual user flow)
    addEdge(currentNodeId, id, 'navigate');

    // Annotate the edge with the relationship type for the viewer
    const lastEdge = session.edges[session.edges.length - 1];
    if (lastEdge && lastEdge.from === currentNodeId && lastEdge.to === id) {
      lastEdge.navClass = navType;
    }
  }

  // Build ancestor chain (creates stubs + child-of edges)
  ensureAncestorChain(canonical);

  // Navigation implicitly dismisses any open modal
  if (activeModalNodeId) {
    const pageId = urlHash(canonicalUrl(url));
    addEdge(activeModalNodeId, pageId, 'modal-dismiss');
    activeModalNodeId = null;
  }

  // Update tracking
  previousNodeId = currentNodeId;
  currentNodeId = id;

  persistSession();
  updateBadge();

  // Schedule screenshot capture
  if (tabId) {
    scheduleScreenshot(id, tabId);
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        scheduleScreenshot(id, tabs[0].id);
      }
    });
  }
}

/**
 * Add a directed edge. If the same from→to+type edge exists, increment count.
 * Hierarchy edges (child-of) are idempotent — count stays at 1.
 */
function addEdge(fromId, toId, type = 'navigate') {
  const existing = session.edges.find(
    e => e.from === fromId && e.to === toId && e.type === type
  );
  if (existing) {
    if (type !== 'child-of') {
      existing.count += 1;
    }
  } else {
    session.edges.push({ from: fromId, to: toId, type, count: 1 });
  }
}

// ---------------------------------------------------------------------------
// Modal graph construction
// ---------------------------------------------------------------------------

// Track the currently active modal node so we can create step/dismiss edges
let activeModalNodeId = null;

/**
 * Build a modal node ID: {page-url-hash}:modal:{content-hash}
 */
function modalNodeId(pageUrl, contentHash) {
  return urlHash(pageUrl) + ':modal:' + contentHash;
}

/**
 * Record a modal opening on the current page.
 * Creates a modal node and a modal-open edge from the page node.
 */
function recordModalOpen(pageUrl, contentHash, title) {
  if (!session) return;

  const pageId = urlHash(canonicalUrl(pageUrl));
  const modalId = modalNodeId(pageUrl, contentHash);

  // Create modal node if it doesn't exist
  if (!session.nodes[modalId]) {
    session.nodes[modalId] = {
      url: canonicalUrl(pageUrl) + '#modal:' + contentHash,
      title: title || 'Modal',
      screenshot: null,
      notes: [],
      flags: [],
      stub: false,
      inferredParent: pageId,
      isModal: true,
      modalContentHash: contentHash,
      parentPageId: pageId
    };
  } else if (title) {
    session.nodes[modalId].title = title;
  }

  // Edge from page → modal
  addEdge(pageId, modalId, 'modal-open');

  activeModalNodeId = modalId;
  persistSession();
  updateBadge();

  // Schedule screenshot for the modal
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      scheduleScreenshot(modalId, tabs[0].id);
    }
  });
}

/**
 * Record a step within a modal (content changed but modal container persists).
 * Creates a new modal node and a modal-step edge from the previous modal state.
 */
function recordModalStep(pageUrl, contentHash, title, prevContentHash) {
  if (!session) return;

  const prevModalId = prevContentHash
    ? modalNodeId(pageUrl, prevContentHash)
    : activeModalNodeId;
  const newModalId = modalNodeId(pageUrl, contentHash);
  const pageId = urlHash(canonicalUrl(pageUrl));

  // Create new modal state node
  if (!session.nodes[newModalId]) {
    session.nodes[newModalId] = {
      url: canonicalUrl(pageUrl) + '#modal:' + contentHash,
      title: title || 'Modal Step',
      screenshot: null,
      notes: [],
      flags: [],
      stub: false,
      inferredParent: pageId,
      isModal: true,
      modalContentHash: contentHash,
      parentPageId: pageId
    };
  } else if (title) {
    session.nodes[newModalId].title = title;
  }

  // Edge from previous modal state → new modal state
  if (prevModalId && prevModalId !== newModalId) {
    addEdge(prevModalId, newModalId, 'modal-step');
  }

  activeModalNodeId = newModalId;
  persistSession();
  updateBadge();
}

/**
 * Record a modal being dismissed.
 * Creates a modal-dismiss edge back to the parent page node.
 */
function recordModalDismiss(pageUrl, contentHash) {
  if (!session) return;

  const modalId = contentHash
    ? modalNodeId(pageUrl, contentHash)
    : activeModalNodeId;
  const pageId = urlHash(canonicalUrl(pageUrl));

  if (modalId && session.nodes[modalId]) {
    addEdge(modalId, pageId, 'modal-dismiss');
  }

  activeModalNodeId = null;
  persistSession();
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

// Track which nodes already have screenshots
const capturedScreenshots = new Set();
// Debounce: only one pending capture per tab
const pendingCaptures = new Map(); // tabId → timeoutId

/**
 * Schedule a screenshot capture for a node.
 *
 * Strategy: debounce per tab. Each new navigation on the same tab cancels
 * the previous pending capture and starts a new 1.5s timer. When the timer
 * fires, we capture whatever is currently visible and tag it to the current
 * node. This naturally handles fast SPA navigation — only the page the user
 * actually pauses on gets captured.
 */
function scheduleScreenshot(nodeId, tabId) {
  if (!session) return;
  if (capturedScreenshots.has(nodeId)) return;

  // Cancel any pending capture for this tab
  if (pendingCaptures.has(tabId)) {
    clearTimeout(pendingCaptures.get(tabId));
  }

  const timeoutId = setTimeout(async () => {
    pendingCaptures.delete(tabId);

    try {
      // Get fresh tab state
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) return;
      if (!isDockerUrl(tab.url)) return;

      // Figure out which node this tab is currently showing
      const currentUrl = canonicalUrl(tab.url);
      const currentId = urlHash(currentUrl);

      // Skip if already captured
      if (capturedScreenshots.has(currentId)) return;
      if (!session || !session.nodes[currentId]) return;

      console.log('[screenshot] Capturing:', currentId, 'tab:', tabId);

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
      });

      if (!dataUrl) {
        console.warn('[screenshot] captureVisibleTab returned empty');
        return;
      }

      // Store against the node the tab is actually showing
      const screenshotKey = `screenshot_${currentId}`;
      await chrome.storage.local.set({ [screenshotKey]: dataUrl });

      session.nodes[currentId].screenshot = `screenshots/${currentId}.png`;
      session.nodes[currentId].screenshotDataUrl = dataUrl;
      capturedScreenshots.add(currentId);
      persistSession();
      console.log('[screenshot] Stored:', currentId);
    } catch (err) {
      console.warn('[screenshot] Failed:', err.message || err);
    }
  }, 1500);

  pendingCaptures.set(tabId, timeoutId);
}

/**
 * Send a message to a tab's content script and await the response.
 */
function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Whisper offscreen document management
// ---------------------------------------------------------------------------

let whisperOffscreenReady = false;
let whisperPort = null;
let whisperResolve = null;
let whisperReject = null;

async function ensureWhisperOffscreen() {
  if (whisperOffscreenReady && whisperPort) return;

  // Close any existing offscreen doc
  try {
    await chrome.offscreen.closeDocument();
  } catch { /* none open */ }

  whisperOffscreenReady = false;
  whisperPort = null;

  await chrome.offscreen.createDocument({
    url: 'whisper-offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run Whisper speech-to-text model via Transformers.js WebAssembly',
  });

  // Wait for the offscreen doc to connect via port
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Whisper offscreen connect timeout')), 10000);

    function onConnect(port) {
      if (port.name === 'whisper') {
        clearTimeout(timeout);
        chrome.runtime.onConnect.removeListener(onConnect);
        whisperPort = port;
        whisperPort.onMessage.addListener((msg) => {
          if (msg.type === 'WHISPER_RESULT') {
            if (whisperResolve) {
              if (msg.ok) {
                whisperResolve({ text: msg.text, chunks: msg.chunks || [] });
              } else {
                whisperReject(new Error(msg.error || 'Transcription failed'));
              }
              whisperResolve = null;
              whisperReject = null;
            }
          } else if (msg.type === 'WHISPER_PROGRESS') {
            // Could forward to side panel
            console.log('[whisper] Progress:', msg.file, Math.round(msg.progress || 0) + '%');
          }
        });
        whisperPort.onDisconnect.addListener(() => {
          whisperPort = null;
          whisperOffscreenReady = false;
        });
        resolve();
      }
    }

    chrome.runtime.onConnect.addListener(onConnect);
  });

  whisperOffscreenReady = true;
  console.log('[whisper] Offscreen document connected');
}

/**
 * Send audio to the Whisper offscreen document for transcription.
 */
async function transcribeAudio(audioData, modelId) {
  await ensureWhisperOffscreen();

  return new Promise((resolve, reject) => {
    whisperResolve = resolve;
    whisperReject = reject;

    whisperPort.postMessage({
      type: 'WHISPER_TRANSCRIBE',
      audioData: Array.from(audioData),
      modelId: modelId || 'onnx-community/whisper-base',
    });
  });
}

// Track which node a recording was started on
let recordingStartNodeId = null;

// ---------------------------------------------------------------------------
// Navigation listeners
// ---------------------------------------------------------------------------

// Fires on full page loads / traditional navigation
chrome.webNavigation.onCompleted.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (!session) return;
    if (!isDockerUrl(details.url)) return;

    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      recordNavigation(details.url, tab.title, details.tabId);
    });
  },
  { url: [{ hostSuffix: '.docker.com' }, { hostEquals: 'docker.com' }] }
);

// Fires on SPA history changes (pushState / replaceState)
chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (!session) return;
    if (!isDockerUrl(details.url)) return;

    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      recordNavigation(details.url, tab.title, details.tabId);
    });
  },
  { url: [{ hostSuffix: '.docker.com' }, { hostEquals: 'docker.com' }] }
);

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages not meant for the background
  if (message.type === 'WHISPER_TRANSCRIBE' || message.type === 'WHISPER_LOAD_MODEL'
      || message.type === 'WHISPER_PROGRESS' || message.type === 'WHISPER_RESULT'
      || message.type === 'MIC_PERMISSION_GRANTED') {
    return false;
  }

  // Handle messages that work without an active session
  if (message.type === 'GET_SESSION_STATUS') {
    if (session) {
      sendResponse({
        active: true,
        nodeCount: Object.keys(session.nodes).length,
        edgeCount: session.edges.length,
        contributor: session.meta.contributor,
        mode: session.meta.mode
      });
    } else {
      sendResponse({ active: false, nodeCount: 0 });
    }
    return true;
  }

  if (message.type === 'START_SESSION') {
    startSession(message.contributor);
    sendResponse({ ok: true });
    return true;
  }

  // Everything below requires an active session
  if (!session) {
    sendResponse({ ok: false, reason: 'no active session' });
    return true;
  }

  switch (message.type) {
    case 'NAVIGATION': {
      recordNavigation(message.url, message.title, sender.tab?.id);
      sendResponse({ ok: true });
      break;
    }

    case 'STOP_SESSION': {
      const data = stopSession();
      sendResponse({ ok: true, session: data });
      break;
    }

    case 'EXPORT_SESSION': {
      sendResponse({ ok: true, session: session });
      break;
    }

    case 'FLAG_NODE': {
      // Flag the active modal node if one is open, otherwise the current page
      const targetId = activeModalNodeId || currentNodeId;
      if (targetId && session.nodes[targetId]) {
        const flags = session.nodes[targetId].flags;
        if (!flags.includes(message.flag)) {
          flags.push(message.flag);
          persistSession();
        }
      }
      sendResponse({ ok: true });
      break;
    }

    case 'MODAL_OPEN': {
      recordModalOpen(message.url, message.contentHash, message.title);
      sendResponse({ ok: true });
      break;
    }

    case 'MODAL_STEP': {
      recordModalStep(message.url, message.contentHash, message.title, message.prevContentHash);
      sendResponse({ ok: true });
      break;
    }

    case 'MODAL_DISMISS': {
      recordModalDismiss(message.url, message.contentHash);
      sendResponse({ ok: true });
      break;
    }

    case 'RETRIGGER_SCREENSHOT': {
      // Force re-capture of the current node's screenshot
      const targetId = activeModalNodeId || currentNodeId;
      if (targetId) {
        capturedScreenshots.delete(targetId);
        pendingCaptures.forEach((tid, tabKey) => clearTimeout(tid));
        if (session.nodes[targetId]) {
          session.nodes[targetId].screenshot = null;
          session.nodes[targetId].screenshotDataUrl = null;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            scheduleScreenshot(targetId, tabs[0].id);
          }
        });
      }
      sendResponse({ ok: true });
      break;
    }

    case 'GET_SCREENSHOT': {
      // Return screenshot data URL for a specific node
      const key = `screenshot_${message.nodeId}`;
      chrome.storage.local.get(key, (result) => {
        sendResponse({ ok: true, dataUrl: result[key] || null });
      });
      return true; // async
    }

    case 'EXPORT_SESSION_WITH_SCREENSHOTS': {
      // Return session data with all screenshot data URLs embedded
      const exportData = structuredClone(session);
      const screenshotKeys = Object.keys(exportData.nodes)
        .filter(id => exportData.nodes[id].screenshot)
        .map(id => `screenshot_${id}`);

      if (screenshotKeys.length === 0) {
        sendResponse({ ok: true, session: exportData });
        return true;
      }

      chrome.storage.local.get(screenshotKeys, (result) => {
        for (const [id, node] of Object.entries(exportData.nodes)) {
          const key = `screenshot_${id}`;
          if (result[key]) {
            node.screenshotDataUrl = result[key];
          }
        }
        sendResponse({ ok: true, session: exportData });
      });
      return true; // async
    }

    case 'AUDIO_RECORDING_STARTED': {
      // Remember which node the recording started on
      recordingStartNodeId = activeModalNodeId || currentNodeId;
      console.log('[audio] Recording started on node:', recordingStartNodeId);
      sendResponse({ ok: true, nodeId: recordingStartNodeId });
      break;
    }

    case 'AUDIO_TRANSCRIBE': {
      // Receive audio data from side panel, send to Whisper offscreen doc
      const targetNodeId = message.nodeId || recordingStartNodeId || currentNodeId;
      const audioData = new Float32Array(message.audioData);
      const modelId = message.modelId || 'onnx-community/whisper-base';

      console.log('[audio] Transcribing for node:', targetNodeId, 'samples:', audioData.length);

      transcribeAudio(audioData, modelId)
        .then((result) => {
          // Attach transcription to the node
          if (session && session.nodes[targetNodeId]) {
            const note = {
              text: result.text.trim(),
              contributor: session.meta.contributor,
              timestamp: new Date().toISOString(),
              type: 'audio',
            };
            session.nodes[targetNodeId].notes.push(note);
            persistSession();
            console.log('[audio] Note attached to', targetNodeId, ':', result.text.trim());
          }
          sendResponse({
            ok: true,
            text: result.text.trim(),
            nodeId: targetNodeId,
          });
        })
        .catch((err) => {
          console.error('[audio] Transcription failed:', err);
          sendResponse({ ok: false, error: err.message });
        });

      recordingStartNodeId = null;
      return true; // Async response
    }

    default:
      sendResponse({ ok: false, reason: 'unknown message type' });
  }

  return true;
});

// ---------------------------------------------------------------------------
// Side panel: open on extension icon click
// ---------------------------------------------------------------------------

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

restoreSession();
