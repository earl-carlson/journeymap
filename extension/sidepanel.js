// IA Mapper — Side Panel Script

const viewSetup = document.getElementById('view-setup');
const viewIdle = document.getElementById('view-idle');
const viewActive = document.getElementById('view-active');

const contributorInput = document.getElementById('contributor');
const btnSaveSetup = document.getElementById('btn-save-setup');
const btnPickDir = document.getElementById('btn-pick-dir');
const setupDirName = document.getElementById('setup-dir-name');
const btnChangeName = document.getElementById('btn-change-name');
const btnChangeDir = document.getElementById('btn-change-dir');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnExport = document.getElementById('btn-export');

const idleContributor = document.getElementById('idle-contributor');
const idleDir = document.getElementById('idle-dir');
const statNodes = document.getElementById('stat-nodes');
const statEdges = document.getElementById('stat-edges');
const metaContributor = document.getElementById('meta-contributor');
const metaMode = document.getElementById('meta-mode');
const activeDir = document.getElementById('active-dir');
const currentPageEl = document.getElementById('current-page');
const currentPageTitle = document.getElementById('current-page-title');
const currentPageUrl = document.getElementById('current-page-url');
const recentList = document.getElementById('recent-list');
const flagButtons = document.querySelectorAll('.btn-flag');
const screenshotIndicator = document.getElementById('screenshot-indicator');
const btnRetrigger = document.getElementById('btn-retrigger');
const btnRecord = document.getElementById('btn-record');
const recordLabel = document.getElementById('record-label');
const waveformCanvas = document.getElementById('waveform');
const audioStatus = document.getElementById('audio-status');
const transcriptionResult = document.getElementById('transcription-result');

// Mode toggle + workflow elements
const btnModeMap = document.getElementById('btn-mode-map');
const btnModeWorkflow = document.getElementById('btn-mode-workflow');
const workflowInfo = document.getElementById('workflow-info');
const workflowNameDisplay = document.getElementById('workflow-name-display');
const workflowStepCount = document.getElementById('workflow-step-count');
const workflowPrompt = document.getElementById('workflow-prompt');
const workflowNameInput = document.getElementById('workflow-name-input');
const workflowPersonaSelect = document.getElementById('workflow-persona-select');
const workflowPersonaDisplay = document.getElementById('workflow-persona-display');
const btnWfStart = document.getElementById('btn-wf-start');
const btnWfCancel = document.getElementById('btn-wf-cancel');
const workflowEdit = document.getElementById('workflow-edit');
const wfEditName = document.getElementById('wf-edit-name');
const wfEditSteps = document.getElementById('wf-edit-steps');
const btnWfSave = document.getElementById('btn-wf-save');
const btnWfDiscard = document.getElementById('btn-wf-discard');

// Capture queue elements
const captureQueueChip = document.getElementById('capture-queue-chip');
const queueTargetTitle = document.getElementById('queue-target-title');
const queueTargetUrl = document.getElementById('queue-target-url');
const queueProgress = document.getElementById('queue-progress');
const btnQueueDismiss = document.getElementById('btn-queue-dismiss');
const btnQueueClear = document.getElementById('btn-queue-clear');
const btnLoadQueue = document.getElementById('btn-load-queue');
const queueFileInput = document.getElementById('queue-file-input');

function isTrackedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const domains = ['docker.com', 'testcontainers.com', 'dockerstatus.com'];
    return domains.some((d) => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

const _TRACKING_PARAMS = new Set([
  '_gl', '_ga', '_gid', '_gac',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gclsrc', 'dclid', 'fbclid', 'msclkid', 'twclid',
  'ref', 'referrer', '_hsenc', '_hsmi',
]);

function cleanTrackedUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (_TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
    }
    let result = u.toString().replace(/\/+$/, '');
    if (result.endsWith('?')) result = result.slice(0, -1);
    return result;
  } catch {
    return url;
  }
}

/**
 * Convert a data URL to a Blob without using fetch.
 */
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

let savedContributor = null;
let dirHandle = null;    // FileSystemDirectoryHandle — persisted across sessions
let dirName = null;      // Display name of the directory
let currentMode = 'map'; // 'map' or 'workflow'
let editingWorkflowPath = []; // For post-session workflow editing

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  // Load persisted contributor name
  const stored = await chrome.storage.local.get(['ia_contributor', 'ia_dir_name']);
  savedContributor = stored.ia_contributor || null;
  dirName = stored.ia_dir_name || null;

  // Try to restore the directory handle from IndexedDB
  dirHandle = await loadDirHandle();

  // Check session status
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      showCorrectView(null);
      return;
    }
    showCorrectView(response);
  });
}

function showCorrectView(status) {
  viewSetup.classList.add('hidden');
  viewIdle.classList.add('hidden');
  viewActive.classList.add('hidden');

  if (!savedContributor || !dirHandle) {
    viewSetup.classList.remove('hidden');
    if (savedContributor) contributorInput.value = savedContributor;
    if (dirName) setupDirName.textContent = dirName;
    if (!savedContributor) contributorInput.focus();
    return;
  }

  if (status && status.active) {
    showActiveView(status);
  } else {
    showIdleView();
  }
}

function showIdleView() {
  viewSetup.classList.add('hidden');
  viewActive.classList.add('hidden');
  viewIdle.classList.remove('hidden');
  idleContributor.textContent = savedContributor;
  idleDir.textContent = dirName || '—';
}

function showActiveView(status) {
  viewSetup.classList.add('hidden');
  viewIdle.classList.add('hidden');
  viewActive.classList.remove('hidden');
  activeDir.textContent = dirName || '—';

  if (status) {
    statNodes.textContent = status.nodeCount || 0;
    statEdges.textContent = status.edgeCount || 0;
    metaContributor.textContent = status.contributor || savedContributor || '—';

    // Update mode UI
    currentMode = status.mode || 'map';
    updateModeUI(status);
  }
}

function updateModeUI(status) {
  const isWorkflow = currentMode === 'workflow';
  btnModeMap.classList.toggle('active', !isWorkflow);
  btnModeWorkflow.classList.toggle('active', isWorkflow);

  if (isWorkflow && status?.workflowName) {
    workflowInfo.classList.remove('hidden');
    workflowNameDisplay.textContent = status.workflowName;
    workflowStepCount.textContent = (status.workflowSteps || 0) + ' steps';
    if (status.workflowPersona) {
      workflowPersonaDisplay.textContent = status.workflowPersona;
      workflowPersonaDisplay.classList.remove('hidden');
    } else {
      workflowPersonaDisplay.classList.add('hidden');
    }
  } else {
    workflowInfo.classList.add('hidden');
  }

  // Capture queue chip
  if (status?.queueTarget) {
    captureQueueChip.classList.remove('hidden');
    queueTargetTitle.textContent = status.queueTarget.title || '—';
    queueTargetUrl.textContent = status.queueTarget.url || '—';
    queueProgress.textContent = `${status.queueDone || 0} / ${status.queueTotal || 0} done`;
  } else if (status?.queueTotal > 0 && status?.queueDone >= status?.queueTotal) {
    captureQueueChip.classList.remove('hidden');
    queueTargetTitle.textContent = 'Queue complete!';
    queueTargetUrl.textContent = '';
    queueProgress.textContent = `${status.queueTotal} / ${status.queueTotal} done`;
  } else {
    captureQueueChip.classList.add('hidden');
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Directory handle persistence via IndexedDB
// (chrome.storage.local can't store FileSystemDirectoryHandle)
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ia_mapper', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'exportDir');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('exportDir');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Directory picker
// ---------------------------------------------------------------------------

async function pickDirectory() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    dirHandle = handle;
    dirName = handle.name;
    await saveDirHandle(handle);
    chrome.storage.local.set({ ia_dir_name: dirName });
    return true;
  } catch (err) {
    // User cancelled
    if (err.name === 'AbortError') return false;
    console.error('Directory picker error:', err);
    return false;
  }
}

btnPickDir.addEventListener('click', async () => {
  const ok = await pickDirectory();
  if (ok) {
    setupDirName.textContent = dirName;
    btnPickDir.textContent = dirName;
  }
});

// ---------------------------------------------------------------------------
// Save setup (name + directory)
// ---------------------------------------------------------------------------

btnSaveSetup.addEventListener('click', async () => {
  const name = contributorInput.value.trim();
  if (!name) {
    contributorInput.focus();
    contributorInput.style.borderColor = '#ef4444';
    setTimeout(() => { contributorInput.style.borderColor = ''; }, 1500);
    return;
  }

  if (!dirHandle) {
    const ok = await pickDirectory();
    if (!ok) return;
  }

  savedContributor = name;
  chrome.storage.local.set({ ia_contributor: name });
  showIdleView();
});

contributorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnSaveSetup.click();
});

// Edit settings (from idle view)
btnChangeName.addEventListener('click', () => {
  viewIdle.classList.add('hidden');
  viewActive.classList.add('hidden');
  viewSetup.classList.remove('hidden');
  contributorInput.value = savedContributor || '';
  if (dirName) {
    setupDirName.textContent = dirName;
    btnPickDir.textContent = dirName;
  }
  contributorInput.focus();
  contributorInput.select();
});

btnChangeDir.addEventListener('click', async () => {
  const ok = await pickDirectory();
  if (ok) {
    idleDir.textContent = dirName;
  }
});

// ---------------------------------------------------------------------------
// Write files to the chosen directory
// ---------------------------------------------------------------------------

/**
 * Verify we still have permission to write to the directory.
 * The browser may revoke permission between sessions.
 */
async function verifyDirPermission() {
  if (!dirHandle) return false;
  try {
    const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    const req = await dirHandle.requestPermission({ mode: 'readwrite' });
    return req === 'granted';
  } catch {
    return false;
  }
}

/**
 * Save session.json and screenshots to the export directory.
 * Creates a session subfolder: session-{contributor}-{date}-{time}/
 *
 * Screenshots are fetched directly from chrome.storage.local in batches
 * to avoid passing large payloads through the message channel.
 */
async function saveToDirectory(sessionData) {
  if (!dirHandle) {
    downloadSession(sessionData);
    return;
  }

  const hasPermission = await verifyDirPermission();
  if (!hasPermission) {
    downloadSession(sessionData);
    return;
  }

  const contributor = sessionData.meta.contributor || 'anonymous';
  const date = sessionData.meta.date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const time = String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const folderName = `session-${contributor}-${date}-${time}`;

  try {
    const sessionDir = await dirHandle.getDirectoryHandle(folderName, { create: true });

    // Clean the session data for JSON (strip any embedded data URLs)
    const exportData = structuredClone(sessionData);
    const nodeIdsWithScreenshots = [];

    for (const [id, node] of Object.entries(exportData.nodes)) {
      delete node.screenshotDataUrl;
      if (node.screenshot) {
        nodeIdsWithScreenshots.push(id);
      }
    }

    // Write session.json first (small, fast)
    const jsonFile = await sessionDir.getFileHandle('session.json', { create: true });
    const jsonWritable = await jsonFile.createWritable();
    await jsonWritable.write(JSON.stringify(exportData, null, 2));
    await jsonWritable.close();
    console.log(`[export] Wrote session.json (${Object.keys(exportData.nodes).length} nodes)`);

    // Write screenshots in batches directly from chrome.storage.local
    if (nodeIdsWithScreenshots.length > 0) {
      const screenshotDir = await sessionDir.getDirectoryHandle('screenshots', { create: true });
      const BATCH_SIZE = 10;
      let written = 0;
      let missing = 0;

      console.log(`[export] Writing ${nodeIdsWithScreenshots.length} screenshots...`);

      for (let i = 0; i < nodeIdsWithScreenshots.length; i += BATCH_SIZE) {
        const batch = nodeIdsWithScreenshots.slice(i, i + BATCH_SIZE);
        const keys = batch.map((id) => `screenshot_${id}`);

        const result = await new Promise((resolve) => {
          chrome.storage.local.get(keys, (r) => {
            if (chrome.runtime.lastError) {
              console.warn('[export] storage.get error:', chrome.runtime.lastError.message);
              resolve({});
            } else {
              resolve(r || {});
            }
          });
        });

        for (const id of batch) {
          const dataUrl = result[`screenshot_${id}`];
          if (!dataUrl) {
            missing++;
            continue;
          }

          try {
            // Convert data URL to blob without fetch
            const blob = dataUrlToBlob(dataUrl);
            const file = await screenshotDir.getFileHandle(`${id}.png`, { create: true });
            const writable = await file.createWritable();
            await writable.write(blob);
            await writable.close();
            written++;
          } catch (err) {
            console.warn('[export] Failed to write screenshot for', id, err);
          }
        }
      }

      console.log(`[export] Screenshots: ${written} written, ${missing} not in storage`);
    }

    console.log(`[export] Session saved to ${folderName}/`);
  } catch (err) {
    console.error('[export] Failed to save to directory:', err);
    downloadSession(sessionData);
  }
}

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

btnStart.addEventListener('click', () => {
  if (!savedContributor) return;

  chrome.runtime.sendMessage({ type: 'START_SESSION', contributor: savedContributor }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok) {
      showActiveView({ nodeCount: 0, edgeCount: 0, contributor: savedContributor, mode: 'map' });

      // Capture current tab if it's docker.com
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
          try {
            const hostname = new URL(tabs[0].url).hostname;
            if (isTrackedUrl(tabs[0].url)) {
              chrome.runtime.sendMessage({
                type: 'NAVIGATION',
                url: tabs[0].url,
                title: tabs[0].title
              });
            }
          } catch { /* ignore */ }
        }
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Stop session — save to directory
// ---------------------------------------------------------------------------

btnStop.addEventListener('click', () => {
  // If in workflow mode, show the editor first before ending
  if (currentMode === 'workflow') {
    showWorkflowEditor();
    return;
  }

  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, async (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok && response.session) {
      await saveToDirectory(response.session);
      chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
        showIdleView();
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Export snapshot (without stopping) — save to directory
// ---------------------------------------------------------------------------

btnExport.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, async (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok && response.session) {
      await saveToDirectory(response.session);
    }
  });
});

// ---------------------------------------------------------------------------
// Retrigger screenshot
// ---------------------------------------------------------------------------

btnRetrigger.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RETRIGGER_SCREENSHOT' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok) {
      screenshotIndicator.textContent = 'Capturing...';
      screenshotIndicator.className = 'screenshot-indicator pending';
    }
  });
});

// ---------------------------------------------------------------------------
// Flag buttons
// ---------------------------------------------------------------------------

flagButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const flag = btn.dataset.flag;
    chrome.runtime.sendMessage({ type: 'FLAG_NODE', flag }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.ok) {
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 1500);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Mode toggle — Map / Workflow
// ---------------------------------------------------------------------------

btnModeMap.addEventListener('click', () => {
  if (currentMode === 'map') return;
  chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'map' }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) return;
    currentMode = 'map';
    workflowPrompt.classList.add('hidden');
    updateModeUI(resp);
  });
});

btnModeWorkflow.addEventListener('click', () => {
  if (currentMode === 'workflow') return;
  // Show the workflow name prompt
  workflowPrompt.classList.remove('hidden');
  workflowNameInput.value = '';
  workflowNameInput.focus();
});

btnWfStart.addEventListener('click', () => {
  const name = workflowNameInput.value.trim();
  if (!name) {
    workflowNameInput.style.borderColor = '#ef4444';
    setTimeout(() => { workflowNameInput.style.borderColor = ''; }, 1500);
    return;
  }
  const persona = workflowPersonaSelect.value || null;
  chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'workflow', workflowName: name, persona }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) return;
    currentMode = 'workflow';
    workflowPrompt.classList.add('hidden');
    updateModeUI({ ...resp, workflowName: name, workflowSteps: 1, workflowPersona: persona });
  });
});

btnWfCancel.addEventListener('click', () => {
  workflowPrompt.classList.add('hidden');
});

workflowNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnWfStart.click();
  if (e.key === 'Escape') btnWfCancel.click();
});

// ---------------------------------------------------------------------------
// Workflow editing (post-session)
// ---------------------------------------------------------------------------

function showWorkflowEditor() {
  chrome.runtime.sendMessage({ type: 'GET_WORKFLOW_PATH' }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) return;
    if (!resp.path || resp.path.length === 0) return;

    editingWorkflowPath = resp.path.map((s) => ({ ...s }));
    wfEditName.value = resp.name || '';
    renderWorkflowSteps();
    workflowEdit.classList.remove('hidden');
  });
}

function renderWorkflowSteps() {
  wfEditSteps.innerHTML = '';
  editingWorkflowPath.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'wf-edit-step';
    div.draggable = true;
    div.dataset.index = i;
    div.innerHTML = `
      <span class="wf-edit-step-num">${i + 1}</span>
      <div class="wf-edit-step-info">
        <div class="wf-edit-step-title">${escapeHtml(step.title)}</div>
        <div class="wf-edit-step-url">${escapeHtml(step.url)}</div>
      </div>
      <button class="wf-edit-step-remove" data-idx="${i}" title="Remove step">&times;</button>
    `;

    // Remove button
    div.querySelector('.wf-edit-step-remove').addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      editingWorkflowPath.splice(idx, 1);
      renderWorkflowSteps();
    });

    // Drag-and-drop reordering
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(i));
      div.classList.add('dragging');
    });
    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
    });
    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      div.classList.add('drag-over');
    });
    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-over');
    });
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('drag-over');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = i;
      if (fromIdx === toIdx) return;
      const [moved] = editingWorkflowPath.splice(fromIdx, 1);
      editingWorkflowPath.splice(toIdx, 0, moved);
      renderWorkflowSteps();
    });

    wfEditSteps.appendChild(div);
  });
}

btnWfSave.addEventListener('click', () => {
  const name = wfEditName.value.trim();
  if (!name || editingWorkflowPath.length < 2) return;
  chrome.runtime.sendMessage({
    type: 'UPDATE_WORKFLOW_PATH',
    name,
    path: editingWorkflowPath.map((s) => s.id),
  }, () => {
    // Switch to map mode to finalize the workflow, then export and stop
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'map' }, () => {
      chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, async (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.ok && response.session) {
          await saveToDirectory(response.session);
          chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
            workflowEdit.classList.add('hidden');
            editingWorkflowPath = [];
            showIdleView();
          });
        }
      });
    });
  });
});

btnWfDiscard.addEventListener('click', () => {
  // Discard the workflow, then export and stop session
  chrome.runtime.sendMessage({ type: 'UPDATE_WORKFLOW_PATH', name: null, path: [] }, () => {
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'map' }, () => {
      chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, async (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.ok && response.session) {
          await saveToDirectory(response.session);
          chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
            workflowEdit.classList.add('hidden');
            editingWorkflowPath = [];
            showIdleView();
          });
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Capture queue
// ---------------------------------------------------------------------------

btnLoadQueue.addEventListener('click', () => {
  queueFileInput.click();
});

queueFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const queue = data.captureQueue || data.queue || [];
    if (queue.length === 0) return;

    chrome.runtime.sendMessage({ type: 'LOAD_CAPTURE_QUEUE', queue }, (resp) => {
      if (chrome.runtime.lastError) return;
      // UI will update on next refresh cycle
    });
  } catch (err) {
    console.error('Failed to load capture queue:', err);
  }
});

btnQueueDismiss.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISMISS_QUEUE_TARGET' });
});

btnQueueClear.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURE_QUEUE' }, () => {
    captureQueueChip.classList.add('hidden');
  });
});

// ---------------------------------------------------------------------------
// Download fallback — used when directory isn't available
// ---------------------------------------------------------------------------

function downloadSession(sessionData) {
  const contributor = sessionData.meta.contributor || 'anonymous';
  const date = sessionData.meta.date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const time = String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const filename = `session-${contributor}-${date}-${time}.json`;

  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Live updates — poll for session status + current page
// ---------------------------------------------------------------------------

function refreshStatus() {
  if (viewActive.classList.contains('hidden')) return;

  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    if (!response.active) {
      showIdleView();
      return;
    }

    statNodes.textContent = response.nodeCount || 0;
    statEdges.textContent = response.edgeCount || 0;
    currentMode = response.mode || 'map';
    updateModeUI(response);
  });

  // Get current tab info + screenshot status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      if (isTrackedUrl(tabs[0].url)) {
        currentPageEl.classList.remove('hidden');
        currentPageTitle.textContent = tabs[0].title || '—';
        currentPageUrl.textContent = tabs[0].url;

        // Check screenshot status for current page
        chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.session) return;
          const currentClean = cleanTrackedUrl(tabs[0].url);
          for (const [id, node] of Object.entries(resp.session.nodes)) {
            if (node.url === currentClean || cleanTrackedUrl(node.url) === currentClean) {
              if (node.screenshot) {
                screenshotIndicator.textContent = 'Screenshot captured';
                screenshotIndicator.className = 'screenshot-indicator captured';
                btnRetrigger.textContent = 'retake screenshot';
              } else {
                screenshotIndicator.textContent = 'No screenshot yet';
                screenshotIndicator.className = 'screenshot-indicator pending';
                btnRetrigger.textContent = 'take screenshot';
              }
              return;
            }
          }
        });
      } else {
        currentPageEl.classList.add('hidden');
      }
    } catch {
      currentPageEl.classList.add('hidden');
    }
  });

  // Get recent nodes
  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.session) return;

    const nodes = response.session.nodes;
    const entries = Object.entries(nodes)
      .filter(([_, n]) => !n.stub)
      .slice(-8)
      .reverse();

    recentList.innerHTML = '';
    for (const [id, node] of entries) {
      const div = document.createElement('div');
      div.className = 'recent-item';
      div.innerHTML = `
        <div class="recent-item-title">${escapeHtml(node.title)}</div>
        <div class="recent-item-url">${escapeHtml(node.url)}</div>
      `;
      recentList.appendChild(div);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

setInterval(refreshStatus, 1500);

// ---------------------------------------------------------------------------
// Audio recording + transcription
// ---------------------------------------------------------------------------

let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let animFrameId = null;
let recordingNodeId = null;

btnRecord.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  try {
    // Check if getUserMedia is available in this context
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Side panel may not support getUserMedia — open permission page
      openMicPermissionPage();
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (micErr) {
      if (micErr.name === 'NotAllowedError' || micErr.name === 'NotFoundError') {
        // Permission denied or no mic — open permission page in a new tab
        openMicPermissionPage();
        return;
      }
      throw micErr;
    }

    // Tell background which node we're recording on
    chrome.runtime.sendMessage({ type: 'AUDIO_RECORDING_STARTED' }, (resp) => {
      if (resp && resp.nodeId) {
        recordingNodeId = resp.nodeId;
      }
    });

    // Set up audio context for waveform visualization
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Start MediaRecorder
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameId);

      if (audioChunks.length === 0) {
        showAudioStatus('No audio recorded');
        return;
      }

      showAudioStatus('Transcribing...');

      try {
        // Convert recorded audio to Float32Array at 16kHz
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const float32Data = audioBuffer.getChannelData(0);

        // Send to background for Whisper transcription
        chrome.runtime.sendMessage(
          {
            type: 'AUDIO_TRANSCRIBE',
            audioData: Array.from(float32Data),
            nodeId: recordingNodeId,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              showAudioStatus('Error: ' + chrome.runtime.lastError.message);
              return;
            }
            if (response && response.ok) {
              showTranscription(response.text, response.nodeId);
              showAudioStatus('');
            } else {
              showAudioStatus('Transcription failed: ' + (response?.error || 'unknown'));
            }
          }
        );
      } catch (err) {
        showAudioStatus('Error processing audio: ' + err.message);
      }
    };

    mediaRecorder.start(250); // Collect data every 250ms
    isRecording = true;
    btnRecord.classList.add('recording');
    recordLabel.textContent = 'Stop';
    transcriptionResult.classList.add('hidden');
    showAudioStatus('Recording...');

    // Start waveform visualization
    drawWaveform();
  } catch (err) {
    showAudioStatus('Error: ' + err.message);
  }
}

function openMicPermissionPage() {
  showAudioStatus('Opening microphone permission page...');
  chrome.tabs.create({
    url: chrome.runtime.getURL('mic-permission.html'),
    active: true,
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  btnRecord.classList.remove('recording');
  recordLabel.textContent = 'Record';
}

function drawWaveform() {
  if (!analyser || !isRecording) return;

  const canvas = waveformCanvas;
  const ctx = canvas.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    if (!isRecording) return;
    animFrameId = requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = '#222240';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4B7BE5';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  draw();
}

function showAudioStatus(text) {
  if (text) {
    audioStatus.textContent = text;
    audioStatus.classList.remove('hidden');
  } else {
    audioStatus.classList.add('hidden');
  }
}

function showTranscription(text, nodeId) {
  if (!text || !text.trim()) {
    transcriptionResult.innerHTML = '<em style="color: var(--text-muted)">No speech detected</em>';
    transcriptionResult.classList.remove('hidden');
    return;
  }

  transcriptionResult.innerHTML = `
    <div style="margin-bottom: 4px">${escapeHtml(text)}</div>
    <div style="font-size: 10px; color: var(--text-muted)">Attached to node ${nodeId || 'current'}</div>
  `;
  transcriptionResult.classList.remove('hidden');
}

// Listen for Whisper progress events (model download)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'WHISPER_PROGRESS') {
    const pct = Math.round(message.progress || 0);
    showAudioStatus(`Loading model: ${pct}% (${message.file || ''})`);
  }
});

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

init();
