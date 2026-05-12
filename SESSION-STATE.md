# IA Mapper — Session State

Last updated: 2026-05-12

## What this project is

A Chrome extension + HTML viewer for mapping Docker's information architecture. See `ia-mapper-spec.md` for the full spec. The tool captures navigation, screenshots, and annotations as you browse `*.docker.com`, then visualizes the IA as an interactive graph.

## Repo structure

```
journeymap/
├── ia-mapper-spec.md          # Full project spec (8 pieces)
├── extension/                 # Chrome Extension (Manifest V3, no build step)
│   ├── manifest.json          # MV3, v0.4.0
│   ├── background.js          # Service worker: session state, graph, screenshots, audio routing
│   ├── content.js             # SPA route detection, modal detection, screenshot scroll support
│   ├── sidepanel.html/css/js  # Main UI: docked right panel
│   ├── offscreen.html/js      # Screenshot stitching (unused now, single-viewport capture)
│   ├── whisper-offscreen.html # Offscreen doc for Whisper transcription
│   ├── whisper-worker.js      # Transformers.js Whisper pipeline (ES module)
│   ├── mic-permission.html/js # Mic permission grant page
│   ├── lib/transformers.min.js # Bundled Transformers.js v3.4.2 (830KB)
│   ├── icons/                 # Placeholder PNGs
│   └── generate-icons.html    # Open in browser to make nicer icons
├── viewer/                    # React Flow graph viewer
│   ├── src/
│   │   ├── App.jsx            # Main app: directory loading, merge, graph view
│   │   ├── layout.js          # Dagre layout: hierarchy (TB per domain) + navigation (LR)
│   │   ├── merge.js           # Session merge logic (Piece 5)
│   │   ├── sessionToGraph.js  # Convert session JSON → React Flow nodes/edges
│   │   ├── DetailPanel.jsx    # Right panel: node details, screenshot, notes, edges
│   │   ├── nodes/             # PageNode, StubNode, ModalNode components
│   │   └── styles.css         # Dark theme, all viewer styles
│   ├── package.json           # React Flow + Dagre + Vite + singlefile plugin
│   └── vite.config.js         # Builds to ../dist/index.html (single file)
├── dist/index.html            # Built viewer (self-contained, ~465KB)
├── examples/                  # Example session JSONs + screenshots from testing
└── exports/                   # Live export directory (extension writes here)
```

## Build order status

| # | Piece | Status | Notes |
|---|---|---|---|
| 1 | Extension skeleton + nav capture | **Done** | SPA detection, URL hierarchy inference, stub nodes |
| 2 | Screenshots + modal capture | **Done** | Viewport capture, debounced per-tab, modal detection with NPS filtering |
| 3 | Whisper audio notes | **WIP** | See "Piece 3 status" below |
| 4 | Sanity check toast | Not started | |
| 5 | Merge logic | **Done** | Shared module in `viewer/src/merge.js` |
| 6 | HTML viewer (static) | **Done** | React Flow + Dagre, hierarchy/navigation/all views, detail panel |
| 7 | Workflows + gap detection | Not started | |
| 8 | Workflow recording mode | Not started | |

## Key architecture decisions

### Extension (no build step)
- Plain JS, loads unpacked via `chrome://extensions`
- Side panel (not popup) — stays open while browsing
- Contributor name + export directory set once, persisted permanently
- Directory handle stored in IndexedDB (chrome.storage can't hold FileSystemDirectoryHandle)

### URL hierarchy inference
- Every node gets an `inferredParent` field derived from URL path segments
- Stub nodes auto-created for unvisited ancestors (e.g. `/ai` when you visit `/ai/sandboxes`)
- `child-of` edges (idempotent, count=1) separate from `navigate` edges (count increments)
- Navigation classified as: `cross-domain`, `same-domain-parent-child`, `same-domain-sibling`, `same-domain-other`

### Screenshots
- `captureVisibleTab` (single viewport, not scroll-and-stitch — more reliable)
- Debounced per-tab: fast SPA clicks cancel previous timer, captures page you pause on 1.5s
- Requires `<all_urls>` host permission (not just `*.docker.com`)
- Stored in `chrome.storage.local` during session, exported as separate PNGs

### Modal detection
- MutationObserver on `document.body` watching for dialog/overlay elements
- Filters: NPS widgets ("was this page useful"), cookie banners, feedback widgets
- Elements present at page load marked as "initial" and ignored
- Size threshold: must cover 5% of viewport or be 300x200+

### Viewer
- Vite + vite-plugin-singlefile → one self-contained HTML file
- Hierarchy view: top-down tree per domain cluster, domains arranged left-to-right
- Navigation view: LR flow showing actual user path
- Auto-loads from a chosen directory (File System Access API)
- Scans recursively for `session.json` files + `screenshots/` folders
- Merges all sessions into unified graph

### Export format
```
exports/
  session-Earl-2026-05-12-143052/
    session.json              # Clean JSON, no base64
    screenshots/
      ad239ba8.png            # {url-hash}.png
      d4038df9:modal:d30ef885.png
```

## Piece 3 status (Whisper audio notes) — WIP

### What's built
- Recording UI in side panel: record button with waveform visualizer
- MediaRecorder captures audio in side panel
- Offscreen document (`whisper-offscreen.html`) with Transformers.js bundled locally
- Port-based communication between background ↔ offscreen doc (avoids message port conflicts)
- Mic permission page (`mic-permission.html`) for initial grant
- Background routes audio from side panel → offscreen doc → transcription → attach to node
- Notes append to node with contributor + timestamp + type:"audio"

### What's broken / needs fixing
1. **Offscreen doc connect timeout** — the offscreen document creates but the port connection times out. Likely cause: the ES module import of `./lib/transformers.min.js` may be failing silently, or the `connect` call happens before the module finishes loading. Debug by inspecting the offscreen doc's console (chrome://extensions → IA Mapper → inspect the offscreen page if visible, or add try/catch logging around the import).

2. **Potential fixes to try:**
   - Wrap the `chrome.runtime.connect` call in a try/catch and add console logging before/after the import
   - Check if `transformers.min.js` is a proper ES module (has `export` statements) — if it's a UMD bundle, the `import { pipeline, env }` syntax won't work. May need `import` of the default export or a different bundle format.
   - Alternative: use `importScripts` or a dynamic `import()` with error handling
   - Alternative: load Transformers.js via a `<script>` tag in the HTML instead of ES module import, then access `window.Transformers` or similar global

3. **CSP config** (manifest.json):
   - `script-src 'self' 'wasm-unsafe-eval'` — allows local scripts + WASM
   - `connect-src` allows cdn.jsdelivr.net + huggingface.co for model weight downloads
   - Model weights are fetched via `fetch()` (covered by connect-src), not script loading

4. **Model choice**: Currently set to `onnx-community/whisper-base` (q8, ~140MB). Spec says whisper-small (~250MB) as default. Can be changed in `whisper-worker.js`.

## Git setup
- Remote: `git@github-work:earl-carlson/journeymap.git` (SSH via `github-work` host alias → `earl-carlson` account)
- Branch: `main`
- SSH config: `~/.ssh/config` has `Host github-work` using `~/.ssh/id_github_work`

## How to rebuild the viewer
```bash
cd viewer && npm run build
# Output: dist/index.html
```

## How to test the extension
1. `chrome://extensions` → Developer Mode → Load unpacked → select `extension/`
2. Click extension icon to open side panel
3. Navigate to any `*.docker.com` page
4. Start session → browse → screenshots auto-capture
5. End session → files written to chosen export directory
6. Open `dist/index.html` → choose export directory → graph loads
