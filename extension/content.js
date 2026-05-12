// IA Mapper — Content Script
// Detects SPA route changes and modal/dialog overlays.
// Injected into all *.docker.com pages.

(() => {
  'use strict';

  let lastUrl = location.href;
  let lastTitle = document.title;

  // -----------------------------------------------------------------------
  // Safe message sender — guards against invalidated extension context
  // (happens when the extension is reloaded while the page is still open)
  // -----------------------------------------------------------------------

  function safeSendMessage(message, callback) {
    try {
      if (!chrome.runtime?.id) return; // Extension context gone
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) { /* noop */ }
        if (callback) callback(response);
      });
    } catch {
      // Extension context invalidated — silently ignore
    }
  }

  // -----------------------------------------------------------------------
  // Notify background of current page (on initial load)
  // -----------------------------------------------------------------------

  function notifyNavigation() {
    const url = location.href;
    const title = document.title || url;
    safeSendMessage({ type: 'NAVIGATION', url, title });
  }

  // -----------------------------------------------------------------------
  // Monkey-patch History API to catch pushState / replaceState
  // -----------------------------------------------------------------------

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    onUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    onUrlChange();
  };

  // -----------------------------------------------------------------------
  // Listen for popstate (back/forward button)
  // -----------------------------------------------------------------------

  window.addEventListener('popstate', () => {
    onUrlChange();
  });

  // -----------------------------------------------------------------------
  // URL change handler
  // -----------------------------------------------------------------------

  function onUrlChange() {
    const newUrl = location.href;
    if (newUrl === lastUrl) return;

    lastUrl = newUrl;

    setTimeout(() => {
      lastTitle = document.title || newUrl;
      notifyNavigation();
    }, 100);
  }

  // -----------------------------------------------------------------------
  // Title observer — some SPAs update the title after route change
  // -----------------------------------------------------------------------

  const titleObserver = new MutationObserver(() => {
    const newTitle = document.title;
    if (newTitle && newTitle !== lastTitle) {
      lastTitle = newTitle;
      safeSendMessage({ type: 'NAVIGATION', url: location.href, title: newTitle });
    }
  });

  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // =======================================================================
  // MODAL / DIALOG DETECTION
  // =======================================================================

  // Track active modals so we can detect steps and dismissals
  let activeModals = new Map(); // element → { contentHash, title }
  let lastModalContentHash = null;

  // -----------------------------------------------------------------------
  // Content hashing — simple djb2 of visible text content
  // -----------------------------------------------------------------------

  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Extract a stable content fingerprint from a modal element.
   * Uses visible text + key structural hints, trimmed and normalized.
   */
  function getModalContentHash(el) {
    // Get visible text, collapse whitespace
    const text = (el.innerText || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000); // Cap to avoid hashing huge DOMs
    return hashString(text);
  }

  /**
   * Try to extract a meaningful title from a modal element.
   * Looks for headings, aria-label, title attributes, or first text line.
   */
  function getModalTitle(el) {
    // aria-label or aria-labelledby
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }

    // First heading inside the modal
    const heading = el.querySelector('h1, h2, h3, [role="heading"]');
    if (heading) return heading.textContent.trim();

    // data-testid or title attribute
    const testId = el.getAttribute('data-testid');
    if (testId) return testId.replace(/[-_]/g, ' ');

    const titleAttr = el.getAttribute('title');
    if (titleAttr) return titleAttr;

    // First line of text content
    const firstLine = (el.innerText || '').split('\n').find(l => l.trim());
    if (firstLine) return firstLine.trim().slice(0, 80);

    return 'Modal';
  }

  // -----------------------------------------------------------------------
  // Selectors and detection heuristics
  // -----------------------------------------------------------------------

  /**
   * Selectors that match common modal/dialog/overlay patterns.
   * Covers native <dialog>, ARIA roles, and common CSS patterns
   * used by React portals, MUI, Radix, Headless UI, etc.
   */
  const MODAL_SELECTORS = [
    'dialog[open]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[aria-modal="true"]',
    '[data-testid*="modal"]',
    '[data-testid*="dialog"]',
    '[class*="modal" i]',
    '[class*="dialog" i]',
    '[class*="overlay" i]',
    '[class*="drawer" i]',
  ].join(', ');

  /**
   * Text patterns that indicate persistent feedback/NPS widgets,
   * cookie banners, and other non-modal overlays we should ignore.
   */
  const IGNORED_CONTENT_PATTERNS = [
    /was this page useful/i,
    /was this helpful/i,
    /rate this page/i,
    /give feedback/i,
    /cookie\s*(consent|preferences|settings|banner)/i,
    /accept\s*(all\s*)?cookies/i,
    /we use cookies/i,
    /manage\s*preferences/i,
  ];

  /**
   * Class/ID patterns for known persistent widgets to ignore.
   */
  const IGNORED_ELEMENT_PATTERNS = [
    /feedback/i,
    /nps/i,
    /survey/i,
    /cookie/i,
    /consent/i,
    /intercom/i,
    /drift/i,
    /hubspot/i,
    /zendesk/i,
    /crisp/i,
    /hotjar/i,
  ];

  // Track elements that were in the DOM at page load — these are not
  // user-triggered modals.
  const initialElements = new WeakSet();
  let initialScanDone = false;

  /**
   * Filter out false positives — elements that match selectors but
   * aren't actually visible modals.
   */
  function isVisibleModal(el) {
    // Must be in the DOM and visible
    if (!el.isConnected) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;

    const rect = el.getBoundingClientRect();
    // Must have meaningful size (not a hidden container)
    if (rect.width < 100 || rect.height < 80) return false;

    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) < 0.1) return false;

    // --- Reject known persistent widgets ---

    // Check element class/id against ignored patterns
    const classAndId = (el.className || '') + ' ' + (el.id || '');
    if (IGNORED_ELEMENT_PATTERNS.some(p => p.test(classAndId))) return false;

    // Check text content against ignored patterns
    const text = (el.innerText || '').slice(0, 500);
    if (IGNORED_CONTENT_PATTERNS.some(p => p.test(text))) return false;

    // Skip elements that were present at page load (not user-triggered)
    if (initialElements.has(el)) return false;

    // --- Size heuristic: real modals are substantial ---
    // NPS widgets, tooltips, and toasts are typically small.
    // A real modal usually covers a significant portion of the viewport.
    const viewportArea = window.innerWidth * window.innerHeight;
    const elArea = rect.width * rect.height;
    // Must cover at least 5% of viewport OR be at least 300x200
    if (elArea < viewportArea * 0.05 && (rect.width < 300 || rect.height < 200)) return false;

    // Must be above the page (z-index or position:fixed/absolute)
    const position = style.position;
    const zIndex = parseInt(style.zIndex, 10);
    if (position === 'fixed' || position === 'absolute' || zIndex > 10) return true;

    // Native <dialog> with open attribute
    if (el.tagName === 'DIALOG' && el.hasAttribute('open')) return true;

    // ARIA modal
    if (el.getAttribute('aria-modal') === 'true') return true;
    if (el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog') return true;

    return false;
  }

  // -----------------------------------------------------------------------
  // Scan for modals currently in the DOM
  // -----------------------------------------------------------------------

  function scanForModals() {
    const candidates = document.querySelectorAll(MODAL_SELECTORS);
    const currentModals = new Set();

    for (const el of candidates) {
      if (!isVisibleModal(el)) continue;

      // Skip if this element is a child of another detected modal
      let isNested = false;
      for (const [parentEl] of activeModals) {
        if (parentEl !== el && parentEl.contains(el)) {
          isNested = true;
          break;
        }
      }
      // Also check against other candidates
      if (!isNested) {
        for (const otherEl of candidates) {
          if (otherEl !== el && otherEl.contains(el) && isVisibleModal(otherEl)) {
            isNested = true;
            break;
          }
        }
      }
      if (isNested) continue;

      currentModals.add(el);

      const contentHash = getModalContentHash(el);
      const title = getModalTitle(el);

      if (activeModals.has(el)) {
        // Modal already tracked — check if content changed (step)
        const prev = activeModals.get(el);
        if (prev.contentHash !== contentHash) {
          // Content changed within the same modal container → modal-step
          notifyModalStep(contentHash, title, prev.contentHash);
          activeModals.set(el, { contentHash, title });
        }
      } else {
        // New modal appeared → modal-open
        notifyModalOpen(contentHash, title);
        activeModals.set(el, { contentHash, title });
      }
    }

    // Check for dismissed modals
    for (const [el, data] of activeModals) {
      if (!currentModals.has(el)) {
        // Modal was removed or hidden
        notifyModalDismiss(data.contentHash, data.title);
        activeModals.delete(el);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Notify background of modal events
  // -----------------------------------------------------------------------

  function notifyModalOpen(contentHash, title) {
    lastModalContentHash = contentHash;
    safeSendMessage({
      type: 'MODAL_OPEN',
      url: location.href,
      contentHash,
      title
    });
  }

  function notifyModalStep(contentHash, title, prevContentHash) {
    lastModalContentHash = contentHash;
    safeSendMessage({
      type: 'MODAL_STEP',
      url: location.href,
      contentHash,
      title,
      prevContentHash
    });
  }

  function notifyModalDismiss(contentHash, title) {
    safeSendMessage({
      type: 'MODAL_DISMISS',
      url: location.href,
      contentHash,
      title
    });
    lastModalContentHash = null;
  }

  // -----------------------------------------------------------------------
  // MutationObserver — watch for DOM changes that indicate modals
  // -----------------------------------------------------------------------

  let scanTimeout = null;

  function debouncedScan() {
    // Debounce to avoid scanning on every micro-mutation
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanForModals, 200);
  }

  const bodyObserver = new MutationObserver((mutations) => {
    // Quick check: did any mutation add/remove nodes or change attributes
    // that could indicate a modal appearing?
    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // New nodes added — could be a modal portal
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            shouldScan = true;
            break;
          }
        }
      }
      if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
        // Nodes removed — could be a modal dismissal
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            shouldScan = true;
            break;
          }
        }
      }
      if (mutation.type === 'attributes') {
        // Attribute change — could be dialog[open], aria-modal, class change
        const attr = mutation.attributeName;
        if (['open', 'aria-modal', 'role', 'class', 'style', 'data-state'].includes(attr)) {
          shouldScan = true;
        }
      }
      if (shouldScan) break;
    }

    if (shouldScan) {
      debouncedScan();
    }
  });

  // Also watch for native <dialog> show/close events
  document.addEventListener('close', (e) => {
    if (e.target.tagName === 'DIALOG') {
      debouncedScan();
    }
  }, true);

  // Start observing once the body is available
  function startObserving() {
    if (document.body) {
      // Mark all currently-matching elements as "initial" so we don't
      // treat persistent widgets (NPS, feedback, etc.) as modals.
      if (!initialScanDone) {
        const existing = document.querySelectorAll(MODAL_SELECTORS);
        for (const el of existing) {
          initialElements.add(el);
        }
        initialScanDone = true;
      }

      bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['open', 'aria-modal', 'role', 'class', 'style', 'data-state']
      });
    } else {
      // Body not ready yet, wait
      const readyObserver = new MutationObserver(() => {
        if (document.body) {
          readyObserver.disconnect();
          startObserving();
        }
      });
      readyObserver.observe(document.documentElement, { childList: true });
    }
  }

  startObserving();

  // =======================================================================
  // SCREENSHOT SUPPORT
  // =======================================================================

  // =======================================================================
  // SANITY CHECK TOAST (Piece 4)
  // =======================================================================

  // The toast is rendered inside a shadow DOM to avoid style conflicts
  // with Docker's pages. It appears at the bottom-right of the viewport.

  let toastHost = null;
  let toastShadow = null;
  let toastDismissTimer = null;
  let toastCurrentNodeId = null;

  function ensureToastHost() {
    if (toastHost && toastHost.isConnected) return;

    toastHost = document.createElement('ia-mapper-toast');
    toastHost.style.cssText = 'all:initial; position:fixed; z-index:2147483647; bottom:20px; right:20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;';
    toastShadow = toastHost.attachShadow({ mode: 'closed' });
    document.body.appendChild(toastHost);
  }

  function showSanityToast(data) {
    dismissToast(); // Clear any existing toast first
    ensureToastHost(); // Then create fresh host

    toastCurrentNodeId = data.nodeId;

    const reasonLabel = {
      'cross-domain': 'Cross-domain navigation',
      'back-button-branch': 'Back-button branch',
      'hierarchy-skip': 'Hierarchy skip',
    }[data.reason] || 'Ambiguous navigation';

    const parentDisplay = data.parentTitle
      ? escapeForHtml(data.parentTitle)
      : '<em style="opacity:.6">domain root</em>';

    toastShadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .toast {
          width: 340px;
          background: #1e1e38;
          border: 1px solid #3a3a5c;
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0,0,0,.45);
          color: #e0e0f0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          font-size: 13px;
          overflow: hidden;
          animation: slideIn .25s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .toast.dismissing {
          animation: slideOut .2s ease-in forwards;
        }
        @keyframes slideOut {
          to { opacity: 0; transform: translateY(8px) scale(.97); }
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px 8px;
          border-bottom: 1px solid #2a2a4a;
        }
        .label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .05em;
          color: #8888aa;
        }
        .reason {
          font-size: 10px;
          font-weight: 500;
          color: #eab308;
          background: rgba(234,179,8,.1);
          padding: 2px 7px;
          border-radius: 8px;
        }
        .body {
          padding: 12px 14px;
        }
        .guess {
          line-height: 1.5;
          margin-bottom: 10px;
        }
        .guess strong {
          color: #a5b4fc;
          font-weight: 600;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          flex: 1;
          padding: 7px 0;
          font-size: 12px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background .12s, color .12s;
        }
        .btn-confirm {
          background: rgba(99,102,241,.15);
          color: #818cf8;
          border: 1px solid rgba(99,102,241,.25);
        }
        .btn-confirm:hover { background: rgba(99,102,241,.25); color: #a5b4fc; }
        .btn-correct {
          background: rgba(234,179,8,.1);
          color: #eab308;
          border: 1px solid rgba(234,179,8,.2);
        }
        .btn-correct:hover { background: rgba(234,179,8,.18); color: #facc15; }
        .progress {
          height: 2px;
          background: #2a2a4a;
          overflow: hidden;
        }
        .progress-bar {
          height: 100%;
          background: #6366f1;
          width: 100%;
          animation: countdown 10s linear forwards;
        }
        @keyframes countdown {
          from { width: 100%; }
          to   { width: 0%; }
        }
        /* Parent picker */
        .picker {
          padding: 10px 14px 14px;
          border-top: 1px solid #2a2a4a;
        }
        .picker-label {
          font-size: 11px;
          font-weight: 600;
          color: #8888aa;
          margin-bottom: 8px;
        }
        .picker-list {
          max-height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .picker-item {
          padding: 7px 10px;
          background: #222240;
          border: 1px solid #333355;
          border-radius: 6px;
          cursor: pointer;
          transition: border-color .12s, background .12s;
        }
        .picker-item:hover {
          border-color: #6366f1;
          background: #2a2a4a;
        }
        .picker-item-title {
          font-size: 12px;
          font-weight: 500;
          color: #e0e0f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .picker-item-url {
          font-size: 10px;
          color: #6668aa;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }
        .picker-loading {
          font-size: 11px;
          color: #8888aa;
          padding: 8px 0;
        }
      </style>
      <div class="toast" id="toast">
        <div class="header">
          <span class="label">IA Mapper</span>
          <span class="reason">${escapeForHtml(reasonLabel)}</span>
        </div>
        <div class="body">
          <div class="guess">
            Placed <strong>${escapeForHtml(data.nodeTitle)}</strong>
            as child of <strong>${parentDisplay}</strong> — correct?
          </div>
          <div class="actions">
            <button class="btn btn-confirm" id="btn-confirm">Correct</button>
            <button class="btn btn-correct" id="btn-change">Change parent</button>
          </div>
        </div>
        <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
      </div>
    `;

    // Wire up buttons
    const btnConfirm = toastShadow.getElementById('btn-confirm');
    const btnChange = toastShadow.getElementById('btn-change');

    btnConfirm.addEventListener('click', () => {
      dismissToast();
    });

    btnChange.addEventListener('click', () => {
      showParentPicker(data.nodeId);
    });

    // Auto-dismiss after 10 seconds
    toastDismissTimer = setTimeout(() => {
      dismissToast();
    }, 10000);
  }

  function showParentPicker(nodeId) {
    // Cancel auto-dismiss while picker is open
    if (toastDismissTimer) {
      clearTimeout(toastDismissTimer);
      toastDismissTimer = null;
    }

    // Stop the progress bar animation
    const progressBar = toastShadow.getElementById('progress-bar');
    if (progressBar) progressBar.style.animation = 'none';

    // Replace the actions area with a loading state, then fetch recent nodes
    const toastEl = toastShadow.getElementById('toast');
    if (!toastEl) return;

    // Remove existing picker if any
    const existingPicker = toastShadow.querySelector('.picker');
    if (existingPicker) existingPicker.remove();

    // Hide the action buttons
    const actionsEl = toastShadow.querySelector('.actions');
    if (actionsEl) actionsEl.style.display = 'none';

    // Add picker container
    const picker = document.createElement('div');
    picker.className = 'picker';
    picker.innerHTML = '<div class="picker-label">Choose new parent</div><div class="picker-loading">Loading recent pages...</div>';
    toastEl.querySelector('.body').appendChild(picker);

    // Fetch recent nodes from background
    safeSendMessage({ type: 'GET_RECENT_NODES', excludeId: nodeId }, (response) => {
      if (!response || !response.ok || !response.nodes || response.nodes.length === 0) {
        picker.innerHTML = '<div class="picker-label">Choose new parent</div><div class="picker-loading">No recent pages available</div>';
        // Re-show dismiss after 5s
        toastDismissTimer = setTimeout(() => dismissToast(), 5000);
        return;
      }

      const list = document.createElement('div');
      list.className = 'picker-list';

      for (const node of response.nodes) {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.innerHTML = `
          <div class="picker-item-title">${escapeForHtml(node.title)}</div>
          <div class="picker-item-url">${escapeForHtml(node.url)}</div>
        `;
        item.addEventListener('click', () => {
          // Send correction to background
          safeSendMessage({
            type: 'CORRECT_PARENT',
            nodeId: nodeId,
            newParentId: node.id,
          });
          dismissToast();
        });
        list.appendChild(item);
      }

      picker.innerHTML = '<div class="picker-label">Choose new parent</div>';
      picker.appendChild(list);
    });
  }

  function dismissToast() {
    if (toastDismissTimer) {
      clearTimeout(toastDismissTimer);
      toastDismissTimer = null;
    }

    const toastEl = toastShadow ? toastShadow.getElementById('toast') : null;
    if (toastEl) {
      toastEl.classList.add('dismissing');
      setTimeout(() => {
        if (toastHost && toastHost.isConnected) {
          toastHost.remove();
        }
      }, 200);
    } else if (toastHost && toastHost.isConnected) {
      toastHost.remove();
    }

    toastCurrentNodeId = null;
  }

  function escapeForHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // =======================================================================
  // MESSAGE HANDLER (screenshots, toast, etc.)
  // =======================================================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_PAGE_DIMENSIONS': {
        // Return full page dimensions for scroll-and-stitch
        const body = document.body;
        const html = document.documentElement;
        const pageWidth = Math.max(
          body.scrollWidth || 0, body.offsetWidth || 0,
          html.clientWidth || 0, html.scrollWidth || 0, html.offsetWidth || 0
        );
        const pageHeight = Math.max(
          body.scrollHeight || 0, body.offsetHeight || 0,
          html.clientHeight || 0, html.scrollHeight || 0, html.offsetHeight || 0
        );
        sendResponse({
          pageWidth,
          pageHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
          currentScrollX: window.scrollX,
          currentScrollY: window.scrollY,
        });
        return true;
      }

      case 'SCROLL_TO': {
        window.scrollTo(message.x || 0, message.y || 0);
        // Wait a frame for rendering to settle
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            sendResponse({ ok: true, scrollY: window.scrollY });
          });
        });
        return true;
      }

      case 'RESTORE_SCROLL': {
        window.scrollTo(message.x || 0, message.y || 0);
        sendResponse({ ok: true });
        return true;
      }

      case 'CAPTURE_MODAL_SCREENSHOT': {
        // Capture just the modal element area
        // Find the modal by matching content hash
        const modals = document.querySelectorAll(MODAL_SELECTORS);
        for (const el of modals) {
          if (!isVisibleModal(el)) continue;
          const hash = getModalContentHash(el);
          if (hash === message.contentHash) {
            const rect = el.getBoundingClientRect();
            sendResponse({
              ok: true,
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              devicePixelRatio: window.devicePixelRatio || 1,
            });
            return true;
          }
        }
        sendResponse({ ok: false, error: 'Modal not found' });
        return true;
      }

      case 'SHOW_SANITY_TOAST': {
        showSanityToast(message);
        // No response needed — fire and forget
        return false;
      }
    }
  });

  // -----------------------------------------------------------------------
  // Initial navigation notification
  // -----------------------------------------------------------------------

  setTimeout(notifyNavigation, 500);
})();
