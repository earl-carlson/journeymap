// IA Mapper — Side Panel Script

const viewSetup = document.getElementById('view-setup');
const viewIdle = document.getElementById('view-idle');
const viewActive = document.getElementById('view-active');

const contributorInput = document.getElementById('contributor');
const btnSaveName = document.getElementById('btn-save-name');
const btnChangeName = document.getElementById('btn-change-name');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnExport = document.getElementById('btn-export');

const idleContributor = document.getElementById('idle-contributor');
const statNodes = document.getElementById('stat-nodes');
const statEdges = document.getElementById('stat-edges');
const metaContributor = document.getElementById('meta-contributor');
const metaMode = document.getElementById('meta-mode');
const currentPageEl = document.getElementById('current-page');
const currentPageTitle = document.getElementById('current-page-title');
const currentPageUrl = document.getElementById('current-page-url');
const recentList = document.getElementById('recent-list');
const flagButtons = document.querySelectorAll('.btn-flag');

let savedContributor = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  // Load persisted contributor name
  const stored = await chrome.storage.local.get('ia_contributor');
  savedContributor = stored.ia_contributor || null;

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

  if (!savedContributor) {
    // First time — need name
    viewSetup.classList.remove('hidden');
    contributorInput.focus();
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
}

function showActiveView(status) {
  viewSetup.classList.add('hidden');
  viewIdle.classList.add('hidden');
  viewActive.classList.remove('hidden');

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
// Save contributor name (permanent)
// ---------------------------------------------------------------------------

btnSaveName.addEventListener('click', () => {
  const name = contributorInput.value.trim();
  if (!name) {
    contributorInput.focus();
    contributorInput.style.borderColor = '#ef4444';
    setTimeout(() => { contributorInput.style.borderColor = ''; }, 1500);
    return;
  }

  savedContributor = name;
  chrome.storage.local.set({ ia_contributor: name });
  showIdleView();
});

contributorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnSaveName.click();
});

// Edit name (from idle view)
btnChangeName.addEventListener('click', () => {
  viewIdle.classList.add('hidden');
  viewActive.classList.add('hidden');
  viewSetup.classList.remove('hidden');
  contributorInput.value = savedContributor || '';
  contributorInput.focus();
  contributorInput.select();
});

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
// Stop session
// ---------------------------------------------------------------------------

btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.ok && response.session) {
      downloadSession(response.session);
      showIdleView();
    }
  });
});

// ---------------------------------------------------------------------------
// Export (without stopping)
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
// Download helper — filename includes time to avoid duplicates
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

  // Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      const hostname = new URL(tabs[0].url).hostname;
      if (hostname === 'docker.com' || hostname.endsWith('.docker.com')) {
        currentPageEl.classList.remove('hidden');
        currentPageTitle.textContent = tabs[0].title || '—';
        currentPageUrl.textContent = tabs[0].url;
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
