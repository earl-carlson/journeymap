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
| 3 | Whisper audio notes | **Deferred** | See "Piece 3 status" below |
| 4 | Sanity check toast | **Done** | See "Piece 4 status" below |
| 5 | Merge logic | **Done** | Shared module in `viewer/src/merge.js` |
| 6 | HTML viewer (static) | **Done** | React Flow + Dagre, hierarchy/navigation/all views, detail panel |
| 7 | Workflows + gap detection | **Done** | See "Piece 7 status" below |
| 8 | Workflow recording mode | **Done** | See "Piece 8 status" below |

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

## Piece 3 status (Whisper audio notes) — needs live testing

### What's built
- Recording UI in side panel: record button with waveform visualizer
- MediaRecorder captures audio in side panel (webm/opus, 16kHz mono)
- Offscreen document (`whisper-offscreen.html`) with Transformers.js v3.4.2 bundled locally
- Port-based communication between background ↔ offscreen doc (avoids message port conflicts)
- Mic permission page (`mic-permission.html`) for initial grant
- Background routes audio from side panel → offscreen doc → transcription → attach to node
- Notes append to node with contributor + timestamp + type:"audio"
- Lazy loading: Transformers.js library loaded on first transcription request, not at startup

### Bugs fixed (2026-05-12)
1. **Offscreen doc connect timeout** — Root cause: the static `import { pipeline, env }` at the top of `whisper-worker.js` blocked the `chrome.runtime.connect()` call. The 830KB Transformers.js module had to fully parse before the port connected, causing the 10s timeout in the background.
   - **Fix**: Moved `chrome.runtime.connect()` to run immediately (before any imports). Switched from static `import` to lazy `import()` that only loads when transcription is first requested.

2. **Race condition in background.js** — The `onConnect` listener was registered AFTER `createDocument()` resolved. With the fast port connection, the offscreen doc could connect before the listener was in place.
   - **Fix**: Register `onConnect` listener BEFORE calling `createDocument()`.

3. **AUDIO_TRANSCRIBE message dropped** — The message filter at the top of the background's `onMessage` handler was filtering out `AUDIO_TRANSCRIBE` messages (intended for the side panel → background flow), so the transcription handler in the switch statement was never reached.
   - **Fix**: Removed `AUDIO_TRANSCRIBE` from the filter list. Also added proper handler for `MIC_PERMISSION_GRANTED`.

### Still needs live testing
- Load the extension in Chrome, start a session, record an audio note
- First transcription will trigger Transformers.js load + model download (~140MB)
- Watch the offscreen document console for `[whisper]` log messages
- Verify transcription result appears in the side panel and attaches to the correct node

### Notes
- **CSP config** (manifest.json): `script-src 'self' 'wasm-unsafe-eval'` for WASM; `connect-src` allows cdn.jsdelivr.net + huggingface.co for model weight downloads
- **Model**: `onnx-community/whisper-base` (q8, ~140MB). Spec says whisper-small (~250MB) as default. Can be changed in `whisper-worker.js`.
- **ONNX Runtime WASM**: The bundled `transformers.min.js` auto-resolves WASM binaries from jsdelivr CDN. No local WASM files needed.

## Piece 4 status (Sanity check toast) — Done

### What's built
- **Ambiguous navigation detection** in `background.js` — three trigger conditions:
  1. **Cross-domain navigation** (e.g. hub.docker.com → app.docker.com)
  2. **Back-button branch** — user returned to a previously visited node and navigated somewhere new
  3. **Hierarchy skip** — navigation jumps more than 2 levels in the URL path tree
- **Visit history tracking** — ordered list of visited node IDs, capped at 500 entries
- **Toast UI** in `content.js` — rendered in shadow DOM to avoid style conflicts with Docker pages
  - Non-blocking overlay at bottom-right of viewport
  - Shows: "Placed [Page Title] as child of [Parent Title] — correct?"
  - Reason badge: cross-domain / back-button branch / hierarchy skip
  - 10-second countdown progress bar with auto-dismiss
  - Slide-in/out animation
- **Confirm action** — single click accepts the guess and dismisses
- **Change parent action** — opens inline parent-picker listing recently visited nodes
  - Fetches recent nodes from background via `GET_RECENT_NODES` message
  - Up to 12 most-recently-visited non-stub nodes, deduped
  - Click a node to correct the parent — updates `child-of` edge and `inferredParent`
- **Correction handler** in `background.js` (`CORRECT_PARENT` message):
  - Removes old `child-of` edge from previous parent
  - Adds new `child-of` edge from selected parent
  - Updates `inferredParent` on the node
  - Persists immediately

### Architecture notes
- Toast is injected into the Docker page (content script), not the side panel
- Shadow DOM (`mode: 'closed'`) isolates toast styles completely from host page
- Custom element `<ia-mapper-toast>` with `z-index: 2147483647` ensures visibility
- `chrome.tabs.sendMessage` delivers toast data from background to content script
- `safeSendMessage` in content script handles corrections back to background

## Piece 7 status (Workflows, gap detection, platform extensibility) — Done

### What's built

**File System Access API — read-write:**
- Directory picker upgraded from `mode: 'read'` to `mode: 'readwrite'`
- `writeBackSession()` helper writes changes back to `session.json` immediately
- All mutations (workflow create/delete, stub creation) persist to disk automatically
- Falls back to creating a new session directory if no existing one found

**Workflow definition UI (`WorkflowPanel.jsx`):**
- Left sidebar panel toggled via "Workflows" toolbar button
- Three modes: List (browse/select), Define (build new), View (inspect active)
- **Define mode**: click nodes on the graph to add steps, or search by page title
  - Search filters session nodes by title/URL, excludes already-added steps
  - Steps shown as numbered list with remove buttons
  - Save requires a name and at least 2 steps
- **List mode**: shows all workflows with step count and contributor
- **View mode**: shows full path with step numbers, gap indicators, and actions
- Workflows saved to `session.workflows[]` array, same schema as extension-recorded workflows

**Workflow path highlighting (`sessionToGraph.js`):**
- Active workflow dims all non-path nodes (opacity 0.2) and non-path edges (opacity 0.15)
- Workflow path edges highlighted in green (#22c55e), animated, 3px stroke
- All three node types (PageNode, StubNode, ModalNode) support `dimmed` prop
- Stubs on the workflow path are always shown even when "Hide Stubs" is active
- Workflow path nodes always shown even when flag filter is active
- Legend gains a green "Workflow" entry when a workflow is active

**Gap detection:**
- Detects missing intermediate nodes between consecutive workflow steps
- Checks for direct navigate or child-of edges between steps
- Computes hierarchy distance to estimate number of missing steps
- Gaps shown inline in the workflow path view with warning icon and count
- Gap summary at bottom of workflow view

**Gap resolution:**
- "Stub" button on each gap creates a placeholder node (inferred from URL path)
- Stub nodes get proper title, URL, and platform field
- Capture queue: lists all stub nodes on the active workflow path
- "Export Capture Queue" button downloads a JSON file the extension can ingest

**Platform extensibility:**
- `sessionToGraph.js` reads `node.platform` field (defaults to `'web'`)
- Platform filter in the filter bar (only shown when multiple platforms exist)
- `getSessionStats()` returns `platforms` array
- Stats bar shows workflow count
- Platform field preserved through merge and stub creation

**Bug fix — notes display:**
- `DetailPanel.jsx` now handles both string notes and `{ text, contributor }` objects
- Contributor attribution shown below each note after merge

### Architecture notes
- `WorkflowPanel.jsx` is a new component (300+ lines), rendered as left sidebar
- `mutateSession()` helper in App.jsx does `structuredClone` + mutator + async write-back
- `sessionToGraph()` accepts `activeWorkflow` and `platformFilter` options
- Node dimming is a data prop (`dimmed: true`) set during graph conversion, not CSS
- Workflow edges use a `workflowEdgeKeys` Set for O(1) lookup during edge iteration
- Define mode intercepts `onNodeClick` to add steps instead of selecting nodes

## Piece 8 status (Workflow recording mode) — Done

### What's built

**Mode toggle (side panel):**
- Map/Workflow toggle buttons in the active session view
- Switching to Workflow mode prompts for a workflow name (required, not skippable)
- Mode always visible — Map button is indigo, Workflow button is green when active
- Workflow info bar shows recording name and step count
- Switching back to Map saves the workflow and resumes general capture
- Mode can be toggled at any point during a session

**Workflow recording (background.js):**
- `activeWorkflowName` and `activeWorkflowPath` track the recording in real time
- Every navigation in workflow mode appends the node ID to the path
- Current node added as first step when entering workflow mode
- Stopping a session auto-finalizes any active workflow
- `SET_MODE` message handler manages transitions between map and workflow
- `GET_WORKFLOW_PATH` returns the current path for editing
- `UPDATE_WORKFLOW_PATH` accepts reordered/trimmed path and renamed workflow

**Post-session editing (side panel):**
- Ending a session while in workflow mode shows the workflow editor instead of immediately stopping
- Editor shows the workflow name (editable) and all steps as a numbered list
- Steps are drag-and-drop reorderable
- Steps can be removed individually
- "Save Workflow" finalizes the edit, exports the session, and stops
- "Discard" drops the workflow, exports the session without it, and stops

**Capture queue (extension):**
- "Load Capture Queue" button in the side panel actions area
- Accepts the JSON format exported by the viewer (`{ captureQueue: [...] }`)
- Active queue shows a persistent chip with the next target's title and URL
- Navigating to the target URL auto-advances to the next target
- "Skip" button advances without visiting
- "Clear" button removes the queue entirely
- Progress counter shows done/total
- `LOAD_CAPTURE_QUEUE`, `DISMISS_QUEUE_TARGET`, `CLEAR_CAPTURE_QUEUE` message handlers

### Architecture notes
- Workflow state (`activeWorkflowName`, `activeWorkflowPath`) lives in background.js alongside session state
- Capture queue state (`captureQueue`, `captureQueueIndex`) also in background.js
- `recordNavigation()` appends to workflow path and checks capture queue on every navigation
- `stopSession()` auto-saves any active workflow before clearing state
- Workflow editing uses drag-and-drop HTML5 API in the side panel
- Session JSON from workflow mode is fully mergeable — same schema as map mode

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
