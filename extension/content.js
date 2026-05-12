// IA Mapper — Content Script
// Detects SPA route changes and modal/dialog overlays.
// Injected into all *.docker.com pages.

(() => {
  'use strict';

  let lastUrl = location.href;
  let lastTitle = document.title;

  // -----------------------------------------------------------------------
  // Notify background of current page (on initial load)
  // -----------------------------------------------------------------------

  function notifyNavigation() {
    const url = location.href;
    const title = document.title || url;

    chrome.runtime.sendMessage(
      { type: 'NAVIGATION', url, title },
      () => {
        if (chrome.runtime.lastError) { /* noop */ }
      }
    );
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
      chrome.runtime.sendMessage(
        { type: 'NAVIGATION', url: location.href, title: newTitle },
        () => {
          if (chrome.runtime.lastError) { /* noop */ }
        }
      );
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
    chrome.runtime.sendMessage(
      {
        type: 'MODAL_OPEN',
        url: location.href,
        contentHash,
        title
      },
      () => { if (chrome.runtime.lastError) { /* noop */ } }
    );
  }

  function notifyModalStep(contentHash, title, prevContentHash) {
    lastModalContentHash = contentHash;
    chrome.runtime.sendMessage(
      {
        type: 'MODAL_STEP',
        url: location.href,
        contentHash,
        title,
        prevContentHash
      },
      () => { if (chrome.runtime.lastError) { /* noop */ } }
    );
  }

  function notifyModalDismiss(contentHash, title) {
    chrome.runtime.sendMessage(
      {
        type: 'MODAL_DISMISS',
        url: location.href,
        contentHash,
        title
      },
      () => { if (chrome.runtime.lastError) { /* noop */ } }
    );
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

  // -----------------------------------------------------------------------
  // Initial navigation notification
  // -----------------------------------------------------------------------

  setTimeout(notifyNavigation, 500);
})();
