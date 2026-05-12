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

let savedContributor = null;
let dirHandle = null;    // FileSystemDirectoryHandle — persisted across sessions
let dirName = null;      // Display name of the directory

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
    metaMode.textContent = capitalize(status.mode || 'map');
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
 */
async function saveToDirectory(sessionData) {
  if (!dirHandle) {
    // Fallback to download
    downloadSession(sessionData);
    return;
  }

  const hasPermission = await verifyDirPermission();
  if (!hasPermission) {
    // Fallback to download
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
    // Create session subfolder
    const sessionDir = await dirHandle.getDirectoryHandle(folderName, { create: true });

    // Separate screenshot data URLs from the JSON
    const exportData = structuredClone(sessionData);
    const screenshots = {};

    for (const [id, node] of Object.entries(exportData.nodes)) {
      if (node.screenshotDataUrl) {
        // Store for file writing, remove from JSON to keep it clean
        screenshots[id] = node.screenshotDataUrl;
        delete node.screenshotDataUrl;
        // Ensure the relative path is set
        node.screenshot = `screenshots/${id}.png`;
      }
    }

    // Write session.json
    const jsonFile = await sessionDir.getFileHandle('session.json', { create: true });
    const jsonWritable = await jsonFile.createWritable();
    await jsonWritable.write(JSON.stringify(exportData, null, 2));
    await jsonWritable.close();

    // Write screenshots
    if (Object.keys(screenshots).length > 0) {
      const screenshotDir = await sessionDir.getDirectoryHandle('screenshots', { create: true });

      for (const [id, dataUrl] of Object.entries(screenshots)) {
        try {
          // Convert data URL to blob
          const response = await fetch(dataUrl);
          const blob = await response.blob();

          const filename = `${id}.png`;
          const file = await screenshotDir.getFileHandle(filename, { create: true });
          const writable = await file.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          console.warn('Failed to write screenshot for', id, err);
        }
      }
    }

    console.log(`Session saved to ${folderName}/`);
  } catch (err) {
    console.error('Failed to save to directory:', err);
    // Fallback to download
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
            if (hostname === 'docker.com' || hostname.endsWith('.docker.com')) {
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
  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION_WITH_SCREENSHOTS' }, async (response) => {
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
  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION_WITH_SCREENSHOTS' }, async (response) => {
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
  });

  // Get current tab info + screenshot status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      const hostname = new URL(tabs[0].url).hostname;
      if (hostname === 'docker.com' || hostname.endsWith('.docker.com')) {
        currentPageEl.classList.remove('hidden');
        currentPageTitle.textContent = tabs[0].title || '—';
        currentPageUrl.textContent = tabs[0].url;

        // Check screenshot status for current page
        chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.session) return;
          for (const [id, node] of Object.entries(resp.session.nodes)) {
            if (node.url === tabs[0].url.replace(/\/+$/, '').replace(/#.*$/, '')) {
              if (node.screenshot) {
                screenshotIndicator.textContent = 'Screenshot captured';
                screenshotIndicator.className = 'screenshot-indicator captured';
              } else {
                screenshotIndicator.textContent = 'No screenshot yet';
                screenshotIndicator.className = 'screenshot-indicator pending';
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
// Go
// ---------------------------------------------------------------------------

init();
