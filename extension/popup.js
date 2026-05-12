// IA Mapper — Popup Script

const viewIdle = document.getElementById('view-idle');
const viewActive = document.getElementById('view-active');
const contributorInput = document.getElementById('contributor');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnExport = document.getElementById('btn-export');
const statNodes = document.getElementById('stat-nodes');
const statEdges = document.getElementById('stat-edges');
const metaContributor = document.getElementById('meta-contributor');
const metaMode = document.getElementById('meta-mode');
const flagButtons = document.querySelectorAll('.btn-flag');

// ---------------------------------------------------------------------------
// Init — check session status
// ---------------------------------------------------------------------------

async function init() {
  // Restore saved contributor name
  const stored = await chrome.storage.local.get('ia_contributor');
  if (stored.ia_contributor) {
    contributorInput.value = stored.ia_contributor;
  }

  // Check if a session is already running
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    if (response.active) {
      showActiveView(response);
    } else {
      showIdleView();
    }
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function showIdleView() {
  viewIdle.classList.remove('hidden');
  viewActive.classList.add('hidden');
}

function showActiveView(status) {
  viewIdle.classList.add('hidden');
  viewActive.classList.remove('hidden');

  if (status) {
    statNodes.textContent = status.nodeCount || 0;
    statEdges.textContent = status.edgeCount || 0;
    metaContributor.textContent = status.contributor || '—';
    metaMode.textContent = (status.mode || 'map').charAt(0).toUpperCase() + (status.mode || 'map').slice(1);
  }
}

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

btnStart.addEventListener('click', () => {
  const contributor = contributorInput.value.trim();
  if (!contributor) {
    contributorInput.focus();
    contributorInput.style.borderColor = '#ef4444';
    setTimeout(() => { contributorInput.style.borderColor = ''; }, 1500);
    return;
  }

  // Save contributor name for next time
  chrome.storage.local.set({ ia_contributor: contributor });

  chrome.runtime.sendMessage({ type: 'START_SESSION', contributor }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok) {
      showActiveView({ nodeCount: 0, edgeCount: 0, contributor, mode: 'map' });

      // Capture the current tab immediately if it's a docker.com page
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
          } catch { /* ignore invalid URLs */ }
        }
      });
    }
  });
});

// Enter key starts session
contributorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnStart.click();
});

// ---------------------------------------------------------------------------
// Stop session
// ---------------------------------------------------------------------------

btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok && response.session) {
      // Auto-download the session JSON
      downloadSession(response.session);
      showIdleView();
    }
  });
});

// ---------------------------------------------------------------------------
// Export session (without stopping)
// ---------------------------------------------------------------------------

btnExport.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'EXPORT_SESSION' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok && response.session) {
      downloadSession(response.session);
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
// Download helper
// ---------------------------------------------------------------------------

function downloadSession(sessionData) {
  const contributor = sessionData.meta.contributor || 'anonymous';
  const date = sessionData.meta.date || new Date().toISOString().slice(0, 10);
  const filename = `session-${contributor}-${date}.json`;

  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Refresh stats periodically while popup is open
// ---------------------------------------------------------------------------

setInterval(() => {
  if (!viewActive.classList.contains('hidden')) {
    chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.active) return;
      statNodes.textContent = response.nodeCount || 0;
      statEdges.textContent = response.edgeCount || 0;
    });
  }
}, 2000);

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

init();
