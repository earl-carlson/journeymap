// IA Mapper — Side Panel Script (workflow-first)

const viewSetup  = document.getElementById('view-setup');
const viewIdle   = document.getElementById('view-idle');
const viewActive = document.getElementById('view-active');

// Setup view
const contributorInput = document.getElementById('contributor');
const btnSaveSetup     = document.getElementById('btn-save-setup');
const btnPickDir       = document.getElementById('btn-pick-dir');
const setupDirName     = document.getElementById('setup-dir-name');

// Idle view
const idleContributor    = document.getElementById('idle-contributor');
const idleDir            = document.getElementById('idle-dir');
const btnChangeName      = document.getElementById('btn-change-name');
const btnChangeDir       = document.getElementById('btn-change-dir');
const idleWorkflowName   = document.getElementById('idle-workflow-name');
const idlePersona        = document.getElementById('idle-persona');
const btnStart           = document.getElementById('btn-start');

// Active view
const activeWorkflowName  = document.getElementById('active-workflow-name');
const activePersonaBadge  = document.getElementById('active-persona-badge');
const statNodes           = document.getElementById('stat-nodes');
const statSteps           = document.getElementById('stat-steps');
const metaContributor     = document.getElementById('meta-contributor');
const activeDir           = document.getElementById('active-dir');
const currentPageEl       = document.getElementById('current-page');
const currentPageTitle    = document.getElementById('current-page-title');
const currentPageUrl      = document.getElementById('current-page-url');
const screenshotIndicator = document.getElementById('screenshot-indicator');
const btnRetrigger        = document.getElementById('btn-retrigger');
const recentList          = document.getElementById('recent-list');
const flagButtons         = document.querySelectorAll('.btn-flag');
const actionsRecording    = document.getElementById('actions-recording');
const btnStop             = document.getElementById('btn-stop');

// Workflow editor
const workflowEdit  = document.getElementById('workflow-edit');
const wfEditName    = document.getElementById('wf-edit-name');
const wfEditSteps   = document.getElementById('wf-edit-steps');
const btnWfSave     = document.getElementById('btn-wf-save');
const btnWfDiscard  = document.getElementById('btn-wf-discard');

// (Audio removed)

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let savedContributor   = null;
let dirHandle          = null;
let dirName            = null;
let editingWorkflowPath = [];

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function isTrackedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const domains = ['docker.com', 'testcontainers.com', 'dockerstatus.com'];
    return domains.some((d) => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
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
  } catch { return url; }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// IndexedDB — directory handle persistence
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ia_mapper', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'exportDir');
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadDirHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx  = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('exportDir');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Directory picker
// ---------------------------------------------------------------------------

async function pickDirectory() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    dirHandle = handle;
    dirName   = handle.name;
    await saveDirHandle(handle);
    chrome.storage.local.set({ ia_dir_name: dirName });
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false;
    console.error('Directory picker error:', err);
    return false;
  }
}

btnPickDir.addEventListener('click', async () => {
  const ok = await pickDirectory();
  if (ok) {
    setupDirName.textContent = dirName;
    btnPickDir.textContent   = dirName;
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const stored = await chrome.storage.local.get(['ia_contributor', 'ia_dir_name']);
  savedContributor = stored.ia_contributor || null;
  dirName          = stored.ia_dir_name    || null;
  dirHandle        = await loadDirHandle();

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
  idleDir.textContent         = dirName || '—';
  idleWorkflowName.value      = '';
  idlePersona.value           = '';
  workflowEdit.classList.add('hidden');
  editingWorkflowPath = [];
  setTimeout(() => idleWorkflowName.focus(), 50);
}

function showActiveView(status) {
  viewSetup.classList.add('hidden');
  viewIdle.classList.add('hidden');
  viewActive.classList.remove('hidden');

  metaContributor.textContent = status?.contributor || savedContributor || '—';
  activeDir.textContent       = dirName || '—';

  if (status) {
    statNodes.textContent = status.nodeCount || 0;
    statSteps.textContent = status.workflowSteps || 0;

    if (status.workflowName) {
      activeWorkflowName.textContent = status.workflowName;
    }
    if (status.workflowPersona) {
      activePersonaBadge.textContent = status.workflowPersona;
      activePersonaBadge.classList.remove('hidden');
    } else {
      activePersonaBadge.classList.add('hidden');
    }
  }
}

// ---------------------------------------------------------------------------
// Setup save
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

btnChangeName.addEventListener('click', () => {
  viewIdle.classList.add('hidden');
  viewSetup.classList.remove('hidden');
  contributorInput.value = savedContributor || '';
  if (dirName) { setupDirName.textContent = dirName; btnPickDir.textContent = dirName; }
  contributorInput.focus();
  contributorInput.select();
});

btnChangeDir.addEventListener('click', async () => {
  const ok = await pickDirectory();
  if (ok) idleDir.textContent = dirName;
});

// ---------------------------------------------------------------------------
// Start recording — workflow-first
// ---------------------------------------------------------------------------

btnStart.addEventListener('click', () => {
  const name    = idleWorkflowName.value.trim();
  const persona = idlePersona.value || null;

  if (!name) {
    idleWorkflowName.focus();
    idleWorkflowName.style.borderColor = '#ef4444';
    setTimeout(() => { idleWorkflowName.style.borderColor = ''; }, 1500);
    return;
  }

  // Start session, then immediately switch to workflow mode
  chrome.runtime.sendMessage({ type: 'START_SESSION', contributor: savedContributor }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) return;

    // Capture current tab if it's a tracked domain
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && isTrackedUrl(tabs[0].url)) {
        chrome.runtime.sendMessage({ type: 'NAVIGATION', url: tabs[0].url, title: tabs[0].title });
      }
    });

    // Switch straight into workflow mode with the provided name + persona
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'workflow', workflowName: name, persona }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) return;
      showActiveView({
        nodeCount: 0,
        workflowSteps: 0,
        contributor: savedContributor,
        workflowName: name,
        workflowPersona: persona,
      });
    });
  });
});

idleWorkflowName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnStart.click();
});

// ---------------------------------------------------------------------------
// Stop — always shows workflow editor first
// ---------------------------------------------------------------------------

btnStop.addEventListener('click', () => {
  showWorkflowEditor();
});

// ---------------------------------------------------------------------------
// Workflow editor
// ---------------------------------------------------------------------------

function showWorkflowEditor() {
  chrome.runtime.sendMessage({ type: 'GET_WORKFLOW_PATH' }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) return;

    editingWorkflowPath = (resp.path || []).map((s) => ({ ...s }));
    wfEditName.value    = resp.name || '';
    renderWorkflowSteps();
    actionsRecording.classList.add('hidden');
    workflowEdit.classList.remove('hidden');
    workflowEdit.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderWorkflowSteps() {
  wfEditSteps.innerHTML = '';
  editingWorkflowPath.forEach((step, i) => {
    const div = document.createElement('div');
    div.className  = 'wf-edit-step';
    div.draggable  = true;
    div.dataset.index = i;
    div.innerHTML = `
      <span class="wf-edit-step-num">${i + 1}</span>
      <div class="wf-edit-step-info">
        <div class="wf-edit-step-title">${escapeHtml(step.title)}</div>
        <div class="wf-edit-step-url">${escapeHtml(step.url)}</div>
      </div>
      <button class="wf-edit-step-remove" data-idx="${i}" title="Remove step">&times;</button>
    `;

    div.querySelector('.wf-edit-step-remove').addEventListener('click', (e) => {
      editingWorkflowPath.splice(parseInt(e.target.dataset.idx, 10), 1);
      renderWorkflowSteps();
    });

    div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); div.classList.add('dragging'); });
    div.addEventListener('dragend',   () => div.classList.remove('dragging'));
    div.addEventListener('dragover',  (e) => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('drag-over');
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (from === i) return;
      const [moved] = editingWorkflowPath.splice(from, 1);
      editingWorkflowPath.splice(i, 0, moved);
      renderWorkflowSteps();
    });

    wfEditSteps.appendChild(div);
  });
}

btnWfSave.addEventListener('click', () => {
  const name = wfEditName.value.trim();
  if (!name || editingWorkflowPath.length < 1) return;

  chrome.runtime.sendMessage({
    type: 'UPDATE_WORKFLOW_PATH',
    name,
    path: editingWorkflowPath.map((s) => s.id),
  }, () => {
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'map' }, () => {
      chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, async (response) => {
        if (chrome.runtime.lastError || !response?.ok || !response.session) return;
        await saveToDirectory(response.session);
        chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
          showIdleView();
        });
      });
    });
  });
});

btnWfDiscard.addEventListener('click', () => {
  workflowEdit.classList.add('hidden');
  actionsRecording.classList.remove('hidden');
  editingWorkflowPath = [];
});



async function exportAsZip(sessionData) {
  const contributor = sessionData.meta.contributor || 'anonymous';
  const date        = sessionData.meta.date || new Date().toISOString().slice(0, 10);
  const now         = new Date();
  const time        = String(now.getHours()).padStart(2, '0')
                    + String(now.getMinutes()).padStart(2, '0')
                    + String(now.getSeconds()).padStart(2, '0');
  const folderName  = `session-${contributor}-${date}-${time}`;

  // Build a simple ZIP in memory using CompressionStream (deflate-raw)
  // We use the "stored" method (no compression) for simplicity and compatibility
  const files = [];

  // session.json
  const exportData = structuredClone(sessionData);
  const nodeIdsWithScreenshots = [];
  for (const [id, node] of Object.entries(exportData.nodes)) {
    delete node.screenshotDataUrl;
    if (node.screenshot) nodeIdsWithScreenshots.push(id);
  }
  const jsonBytes = new TextEncoder().encode(JSON.stringify(exportData, null, 2));
  files.push({ name: `${folderName}/session.json`, data: jsonBytes });

  // Screenshots from chrome.storage.local
  if (nodeIdsWithScreenshots.length > 0) {
    const BATCH = 10;
    for (let i = 0; i < nodeIdsWithScreenshots.length; i += BATCH) {
      const batch  = nodeIdsWithScreenshots.slice(i, i + BATCH);
      const keys   = batch.map((id) => `screenshot_${id}`);
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(keys, (r) => resolve(chrome.runtime.lastError ? {} : r || {}));
      });
      for (const id of batch) {
        const dataUrl = result[`screenshot_${id}`];
        if (!dataUrl) continue;
        try {
          const blob  = dataUrlToBlob(dataUrl);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          files.push({ name: `${folderName}/screenshots/${id}.png`, data: bytes });
        } catch { /* skip */ }
      }
    }
  }

  // Build ZIP bytes (stored, no compression — maximum compatibility)
  const zipBytes = buildZip(files);

  // Trigger download
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${folderName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a ZIP archive (PKZIP format, stored/no-compression method).
 * No external dependencies — pure JS.
 */
function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const crc       = crc32(data);
    const size      = data.length;

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0,  0x04034b50, true); // signature
    lv.setUint16(4,  20,         true); // version needed
    lv.setUint16(6,  0,          true); // flags
    lv.setUint16(8,  0,          true); // compression: stored
    lv.setUint16(10, 0,          true); // mod time
    lv.setUint16(12, 0,          true); // mod date
    lv.setUint32(14, crc,        true); // crc32
    lv.setUint32(18, size,       true); // compressed size
    lv.setUint32(22, size,       true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0,          true); // extra field length
    local.set(nameBytes, 30);

    parts.push(local);
    parts.push(data);

    // Central directory entry
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0,  0x02014b50, true); // signature
    cv.setUint16(4,  20,         true); // version made by
    cv.setUint16(6,  20,         true); // version needed
    cv.setUint16(8,  0,          true); // flags
    cv.setUint16(10, 0,          true); // compression
    cv.setUint16(12, 0,          true); // mod time
    cv.setUint16(14, 0,          true); // mod date
    cv.setUint32(16, crc,        true); // crc32
    cv.setUint32(20, size,       true); // compressed size
    cv.setUint32(24, size,       true); // uncompressed size
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0,          true); // extra
    cv.setUint16(32, 0,          true); // comment
    cv.setUint16(34, 0,          true); // disk start
    cv.setUint16(36, 0,          true); // internal attr
    cv.setUint32(38, 0,          true); // external attr
    cv.setUint32(42, offset,     true); // local header offset
    cd.set(nameBytes, 46);
    centralDir.push(cd);

    offset += local.length + data.length;
  }

  const cdBytes  = concat(centralDir);
  const eocd     = new Uint8Array(22);
  const ev       = new DataView(eocd.buffer);
  ev.setUint32(0,  0x06054b50,        true); // signature
  ev.setUint16(4,  0,                 true); // disk number
  ev.setUint16(6,  0,                 true); // disk with cd
  ev.setUint16(8,  files.length,      true); // entries on disk
  ev.setUint16(10, files.length,      true); // total entries
  ev.setUint32(12, cdBytes.length,    true); // cd size
  ev.setUint32(16, offset,            true); // cd offset
  ev.setUint16(20, 0,                 true); // comment length

  return concat([...parts, cdBytes, eocd]);
}

function concat(arrays) {
  const total  = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { result.set(a, pos); pos += a.length; }
  return result;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------------------
// Save to directory (unchanged from original)
// ---------------------------------------------------------------------------

async function verifyDirPermission() {
  if (!dirHandle) return false;
  try {
    const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    return (await dirHandle.requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch { return false; }
}

async function saveToDirectory(sessionData) {
  if (!dirHandle) { downloadSession(sessionData); return; }
  const hasPermission = await verifyDirPermission();
  if (!hasPermission) { downloadSession(sessionData); return; }

  const contributor = sessionData.meta.contributor || 'anonymous';
  const date        = sessionData.meta.date || new Date().toISOString().slice(0, 10);
  const now         = new Date();
  const time        = String(now.getHours()).padStart(2, '0')
                    + String(now.getMinutes()).padStart(2, '0')
                    + String(now.getSeconds()).padStart(2, '0');
  const folderName  = `session-${contributor}-${date}-${time}`;

  try {
    const sessionDir = await dirHandle.getDirectoryHandle(folderName, { create: true });

    const exportData = structuredClone(sessionData);
    const nodeIdsWithScreenshots = [];
    for (const [id, node] of Object.entries(exportData.nodes)) {
      delete node.screenshotDataUrl;
      if (node.screenshot) nodeIdsWithScreenshots.push(id);
    }

    const jsonFile     = await sessionDir.getFileHandle('session.json', { create: true });
    const jsonWritable = await jsonFile.createWritable();
    await jsonWritable.write(JSON.stringify(exportData, null, 2));
    await jsonWritable.close();

    if (nodeIdsWithScreenshots.length > 0) {
      const screenshotDir = await sessionDir.getDirectoryHandle('screenshots', { create: true });
      const BATCH_SIZE    = 10;
      for (let i = 0; i < nodeIdsWithScreenshots.length; i += BATCH_SIZE) {
        const batch  = nodeIdsWithScreenshots.slice(i, i + BATCH_SIZE);
        const keys   = batch.map((id) => `screenshot_${id}`);
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(keys, (r) => resolve(chrome.runtime.lastError ? {} : r || {}));
        });
        for (const id of batch) {
          const dataUrl = result[`screenshot_${id}`];
          if (!dataUrl) continue;
          try {
            const blob     = dataUrlToBlob(dataUrl);
            const file     = await screenshotDir.getFileHandle(`${id}.png`, { create: true });
            const writable = await file.createWritable();
            await writable.write(blob);
            await writable.close();
          } catch (err) {
            console.warn('[export] Failed to write screenshot for', id, err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[export] Failed to save to directory:', err);
    downloadSession(sessionData);
  }
}

function downloadSession(sessionData) {
  const contributor = sessionData.meta.contributor || 'anonymous';
  const date        = sessionData.meta.date || new Date().toISOString().slice(0, 10);
  const now         = new Date();
  const time        = String(now.getHours()).padStart(2, '0')
                    + String(now.getMinutes()).padStart(2, '0')
                    + String(now.getSeconds()).padStart(2, '0');
  const filename    = `session-${contributor}-${date}-${time}.json`;
  const blob        = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url         = URL.createObjectURL(blob);
  const a           = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Retrigger screenshot
// ---------------------------------------------------------------------------

btnRetrigger.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RETRIGGER_SCREENSHOT' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.ok) {
      screenshotIndicator.textContent = 'Capturing...';
      screenshotIndicator.className   = 'screenshot-indicator pending';
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
      if (response?.ok) {
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 1500);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Live status polling
// ---------------------------------------------------------------------------

function refreshStatus() {
  if (viewActive.classList.contains('hidden')) return;

  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    if (!response.active) { showIdleView(); return; }

    statNodes.textContent = response.nodeCount    || 0;
    statSteps.textContent = response.workflowSteps || 0;
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      if (isTrackedUrl(tabs[0].url)) {
        currentPageEl.classList.remove('hidden');
        currentPageTitle.textContent = tabs[0].title || '—';
        currentPageUrl.textContent   = tabs[0].url;

        chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, (resp) => {
          if (chrome.runtime.lastError || !resp?.session) return;
          const clean = cleanTrackedUrl(tabs[0].url);
          for (const [, node] of Object.entries(resp.session.nodes)) {
            if (node.url === clean || cleanTrackedUrl(node.url) === clean) {
              if (node.screenshot) {
                screenshotIndicator.textContent = 'Screenshot captured';
                screenshotIndicator.className   = 'screenshot-indicator captured';
                btnRetrigger.textContent        = 'retake screenshot';
              } else {
                screenshotIndicator.textContent = 'No screenshot yet';
                screenshotIndicator.className   = 'screenshot-indicator pending';
                btnRetrigger.textContent        = 'take screenshot';
              }
              return;
            }
          }
        });
      } else {
        currentPageEl.classList.add('hidden');
      }
    } catch { currentPageEl.classList.add('hidden'); }
  });

  // Recent nodes
  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, (response) => {
    if (chrome.runtime.lastError || !response?.session) return;
    const entries = Object.entries(response.session.nodes)
      .filter(([, n]) => !n.stub)
      .slice(-8)
      .reverse();

    recentList.innerHTML = '';
    for (const [, node] of entries) {
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

setInterval(refreshStatus, 1500);



// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

init();
