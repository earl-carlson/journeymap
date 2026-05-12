# IA Mapper — Project Specification

A Chrome extension and companion HTML viewer for building, annotating, and sharing a living Information Architecture map of the Docker web platform. Designed for team use: one person maps the full IA, others contribute targeted workflow recordings, all sessions merge into a single shared graph.

---

## Problem

Maintaining an accurate IA diagram of a large, evolving platform is slow and fragile. Screenshots go stale, manual diagramming in Miro or Figma doesn't scale across contributors, and there's no good way to capture qualitative notes (what's confusing, what's broken) alongside structure in a single artifact.

---

## Goals

Three goals, in priority order, as defined by Mat Wilson:

1. **Referenceable architecture** — every surface documented in one place so anyone can understand where things live today and where they *should* live. Unlocks near-term decisions: where does AI governance go, what does Docker Desktop 5.0 deep-link to, what redirects where when things move.
2. **Identify what to burn down** — once the estate is mapped, kick off actual projects to re-architect the things that are fundamentally broken. Not paper cuts — structural fixes.
3. **Paper cuts** — lowest priority. Will largely fall out of the bottom of #1 and #2 naturally.

**Living reference caveat:** The *rule set* defined through this process stays long term. The *mapping* itself will go stale as the platform evolves. The tool should make re-mapping fast, not assume the first pass is permanent.

---

## Prerequisites (before mapping begins)

Before surface mapping starts, define:
- **3–5 personas** and their core journeys (net new user, admin, repurchasing, adding a feature, etc.)
- **Surface catalog** — a complete list of every user-facing surface to ensure nothing is missed during mapping

These inform which workflows get recorded first and how the graph is eventually structured.

---

## Surfaces in scope

All subdomains under `*.docker.com` — one wildcard permission in the extension manifest covers everything. No list to maintain as new surfaces appear.

**Primary surfaces:** `www`, `hub`, `app`, `admin`, `scout`, `build`, `docs`
**Docs caveat:** Key journeys only — full docs tree is too large to map exhaustively.
**Docker Desktop:** Fast follow — see below.

---

## Non-Goals (current build)

- Docker Desktop — fast follow, not in current build
- Automated crawling — navigation is intentionally manual and human-driven
- Persona tagging — deferred until after full IA is mapped
- Any server infrastructure — fully local, file-based
- Full docs mapping — key journeys only, not the entire docs tree

---

## Fast Follow: Docker Desktop (Mac App)

Docker Desktop is a key part of the platform and needs to be included in the IA — particularly relevant for Desktop 5.0 and understanding how deep links connect Desktop to web surfaces. A native Mac app using the same capture approach (manual navigation, screenshots, audio notes) is the planned fast follow after the Chrome extension is stable.

The schema already accommodates this via the `platform` field (`"desktop"`). Desktop sessions will merge into the same graph as web sessions, with Desktop as a separate root cluster in the viewer.

---

## Timeline

| Week | Target |
|---|---|
| Week 1 | Personas defined, journeys sketched, surface catalog complete |
| Week 2 | 80% of estate mapped across core surfaces |
| Week 3 | Complete, reviewed, referenceable |

---

## Architecture Overview

### 1. Chrome Extension (capture layer)
The primary tool. Runs in the user's browser, inheriting their auth session naturally.

**Two modes:**

**Map Mode**
For broad IA sweeps. Auto-captures every page navigated. Builds the graph continuously. Used by designers and researchers walking through the full platform.

**Workflow Mode**
For targeted flow recording. User names the workflow before starting. Records the same data as Map Mode but also registers the ordered navigation path as a named workflow. Used by PMs or researchers documenting a specific user journey.

**Core capabilities:**
- Auto-navigation capture → graph construction
- Full-page screenshots via scroll-and-stitch → saved as files
- Audio notes → transcribed via local Whisper (Transformers.js, runs in-extension via WebAssembly)
- Page flagging: `broken` · `confusing` · `missing` · `good`
- Sanity check toast on ambiguous navigation ("Added as child of X — wrong?")

---

### 2. Session Output (file structure)

Each session produces a folder:

```
/session-{contributor}-{date}/
  session.json
  /screenshots/
    {url-hash}.png
    {url-hash}.png
    ...
```

**session.json structure:**
```json
{
  "meta": {
    "contributor": "earl",
    "date": "2026-05-12",
    "mode": "map"
  },
  "nodes": {
    "{url-hash}": {
      "url": "https://...",
      "title": "Page Title",
      "screenshot": "screenshots/{url-hash}.png",
      "notes": ["transcribed audio note here"],
      "flags": ["confusing"]
    }
  },
  "edges": [
    { "from": "{url-hash}", "to": "{url-hash}", "count": 1 }
  ],
  "workflows": [
    {
      "name": "Create new project",
      "path": ["{url-hash}", "{url-hash}", "{url-hash}"]
    }
  ]
}
```

---

### 3. Merge Layer

Two paths to merge sessions:

**Git merge** (for contributors comfortable with git)
JSON keyed by URL hash means deterministic keys — contributors mapping different sections of the platform produce zero-conflict merges. Conflicts only arise when two people annotate the same page, resolved via standard git conflict flow.

**Live merge in HTML viewer** (for everyone else)
Drag in multiple session folders. Client-side merge logic runs the same algorithm: match nodes by URL hash, union edges, append notes and screenshots, register new workflow paths using existing node IDs. No duplication.

---

### 4. HTML Viewer (shareable artifact)

A self-contained, interactive HTML file. No server required. Shareable with stakeholders.

**Features:**
- Hierarchical graph layout, ordered by experience flow (not alphabetical)
- Click any node → screenshot + transcribed notes panel opens
- Flag filter: surface only `broken` or `confusing` nodes
- Select a workflow → edges animate sequentially through the graph
- Drag in additional session folders to merge live
- All screenshots embedded or referenced via relative paths

---

## Data Model Notes

- The graph is the source of truth — not a tree. Pages reachable from multiple places appear as a single node with multiple incoming edges.
- URL hash is the universal key across nodes, edges, workflows, and filenames.
- Screenshots stored separately as `.png` files; JSON holds relative paths only (avoids bloated JSON from base64 encoding).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome Extension (Manifest V3) |
| Audio transcription | Whisper-small via Transformers.js (WebAssembly, runs locally in-extension); Whisper-medium optional |
| Full-page screenshots | Scroll-and-stitch via injected content script + Canvas API |
| Modal detection | DOM MutationObserver watching for dialog/overlay elements |
| Graph data | JSON (file-based, git-mergeable); screenshots stored as separate `.png` files |
| HTML viewer | React Flow + Dagre LR; File System Access API for read/write; fully bundled, no runtime fetches |
| Distribution | Load unpacked via `chrome://extensions` — no Chrome Web Store required |

---

## Build Order

| # | Piece | Description |
|---|---|---|
| 1 | Extension skeleton + navigation capture | Auto-track navigation, build graph, export session JSON |
| 2 | Full-page screenshots | Scroll-and-stitch, save to `/screenshots/` with URL-hash filename |
| 3 | Whisper audio notes | Local transcription via Transformers.js, attach to current node |
| 4 | Sanity check toast | Ambiguous navigation prompt, simple correction flow |
| 5 | Merge logic | Core algorithm: dedup by URL hash, union edges, append notes, register workflows |
| 6 | HTML viewer — static | Hierarchical graph, node detail panel, flag filtering |
| 7 | HTML viewer — workflows | Named workflow selection, edge animation |
| 8 | Workflow recording mode | Named flow capture, path registration, merges into existing graph |

---

## Success Criteria

### Piece 1 — Extension skeleton + navigation capture

1. Any team member can clone the repo, load unpacked via `chrome://extensions`, and have it running with no build step
2. User explicitly starts a session via the extension UI — nothing is captured before that
3. Captures navigation across all `*.docker.com` subdomains — single wildcard manifest permission, no list to maintain
4. SPA route changes are captured as navigation events — not just full page loads
5. The same URL visited multiple times creates one node, not duplicates
6. Every navigation between pages creates a directed edge, including cross-domain navigation (e.g. hub → app is one edge)
7. Back-button behavior: returning to B and navigating to D creates a new B→D edge — B is treated as the branch point
8. Nothing outside `*.docker.com` enters the graph
9. User can end session and export a valid `session.json` matching the agreed schema with correct nodes, edges, and session meta

**Out of scope for this piece:** screenshots, audio, sanity check toast, workflow mode

**Retroactive addition from piece #2 scoping:**
- Edge schema gains a `type` field: `"navigate"` (default) · `"modal-open"` · `"modal-step"` · `"modal-dismiss"`
- Modal node IDs follow the scheme: `{url-hash}:modal:{content-hash}`

---

### Piece 2 — Full-page screenshots + modal capture

1. Screenshot triggers automatically on arrival at each new node — network idle or 2 seconds, whichever comes first
2. Full page captured via scroll-and-stitch — content below the fold included, stops at first natural end of content
3. Saved as `{url-hash}.png` in `/screenshots/`, relative path written to node in `session.json`
4. Pages visited multiple times don't retrigger a screenshot — one capture per node
5. Stitch is clean — no visible seams or duplicate content at scroll boundaries
6. User can manually retrigger a screenshot for any node if the capture was bad
7. Overlays and banners captured as-is — no dismissal attempted
8. DOM mutation observer auto-detects modal opens — no manual trigger required
9. Each modal state captured as a peer node: `{url-hash}:modal:{content-hash}.png` in `/screenshots/`
10. Modal steps captured as sequential peer nodes with `modal-step` typed edges between them
11. Modal dismissal creates a `modal-dismiss` typed edge back to the parent page node
12. All modal nodes and typed edges appear correctly in `session.json`

**Out of scope for this piece:** audio notes, sanity check, workflow mode, merge logic

---

### Piece 3 — Whisper audio notes

**Model recommendation:** Whisper-small (~250MB) as default — meaningful accuracy improvement over base on technical terminology at acceptable WebAssembly speeds. Whisper-medium (~450MB) available as an optional setting for users who prefer accuracy over speed.

1. User starts and stops recording with a single tap in the extension UI — no secondary confirmation needed
2. Live waveform visualizer displays during recording — gives confidence the mic is active
3. Audio is transcribed locally via Whisper-small (Transformers.js, WebAssembly) — no audio leaves the machine
4. Whisper-medium available as an optional setting for users who prefer accuracy over speed
5. Model downloads once on first use and caches permanently — zero download delay on subsequent sessions
6. Transcription attaches to the currently active node at the time recording stops — including modal nodes
7. Multiple notes on the same node are supported — each appended as a separate entry, not overwritten
8. Low-confidence or garbled transcriptions are flagged for review in the UI — user can correct, re-record, or dismiss
9. Accepted transcription is written to `session.json` immediately — not held in memory until export
10. Recording is non-blocking — user can navigate to a new page mid-note, transcription still attaches to the node where recording started

**Out of scope for this piece:** sanity check, workflow mode, merge logic, HTML viewer

---

### Piece 4 — Sanity check toast

1. Toast triggers on any of the following ambiguous navigation events:
   - Back-button branch (returning to a node and navigating a new direction)
   - Navigation that skips more than one level in the existing hierarchy
   - Cross-domain navigation (e.g. hub → app)
2. Toast is non-blocking — user can ignore it, keep navigating, and the best guess stands
3. Toast appears within 1 second of the triggering navigation event
4. Toast clearly shows the guess: "Placed [Page Title] as child of [Parent Title] — correct?"
5. Single-tap confirm accepts the guess and dismisses immediately
6. Single-tap correct opens an inline parent-picker for the current node only — fast, minimal UI
7. Parent-picker lists recently visited nodes as options — no need to traverse the whole graph
8. An "Edit session" option is accessible from the toast that opens a broader session graph review — all nodes editable, not just the current one
9. Toast auto-dismisses after 10 seconds if not interacted with — guess is locked in
10. Corrections update all affected edges immediately and write to `session.json`
11. A full session can be completed with zero toast interactions — guesses are good enough to ignore when in flow

**Note:** The session graph review surface (criterion 8) is a meaningful UI — may warrant its own sub-piece when development begins.

**Out of scope for this piece:** workflow mode, merge logic, HTML viewer

---

### Piece 5 — Merge logic

1. Two sessions mapping entirely different sections merge with zero conflicts — all nodes, edges, notes, and screenshots present in the unified output
2. Same page visited by multiple contributors deduplicates to one node — notes from all sessions appended as separate entries with contributor attribution
3. Edge deduplication is additive — same A→B navigation from two contributors becomes one edge with `count: 2`, not two edges
4. Workflow paths from all sessions preserved — node IDs in workflow paths updated to match unified node IDs
5. Modal nodes deduplicate correctly by `{url-hash}:modal:{content-hash}` — same modal from multiple sessions merges cleanly
6. Conflicting screenshots: most recent is the canonical screenshot, earlier versions stored as alternates — all accessible, none discarded
7. Conflicting flags: all flags from all contributors are surfaced on the node — `confusing` from one and `good` from another both appear
8. Contributor attribution is preserved on every note, screenshot, and flag — always clear who captured what
9. Merge is non-destructive — original session folders are never modified
10. Merged output is a valid `session.json` matching the standard schema, plus a `contributors` array listing all merged sessions and their metadata
11. CLI accepts an optional output path argument, defaults to `/merged/` if not specified
12. Merge logic is a single shared implementation — used identically by the CLI and the HTML viewer's drag-in merge, no divergent code paths

**Out of scope for this piece:** HTML viewer UI, workflow recording mode

---

### Piece 6 — HTML viewer, static

**Library decision:** React Flow + Dagre LR — matches the n8n / reference aesthetic out of the box (dark canvas, dot grid, bezier edges, custom nodes, zoom/pan/minimap). Bundled into a single self-contained HTML file, no runtime fetches.

**Entry point strategy:** `www.docker.com` is the primary root node. `app.docker.com`, `hub.docker.com`, and `docs.docker.com` are peer entry-point roots — multiple valid entry points supported, not a forced single root. Admin flows starting at `app.docker.com` read naturally without routing through `www`.

1. Viewer is a single self-contained HTML file — fully bundled, no runtime dependency fetches, works offline
2. Built with React Flow + Dagre LR — left-to-right hierarchical layout
3. Dark canvas with dot grid background — visually consistent with the n8n / reference aesthetic
4. `www.docker.com` is the primary root node; `app.docker.com`, `hub.docker.com`, `docs.docker.com` render as peer entry-point roots
5. Page nodes and modal nodes are visually distinct — different node shape or color treatment
6. Edge types visually differentiated — `navigate`, `modal-open`, `modal-step`, `modal-dismiss` each have a distinct style (color, dash pattern, or label)
7. Clicking any node slides in a detail panel from the right — canonical screenshot displayed, alternate screenshots browsable if present, all notes with contributor attribution, all flags from all contributors
8. Flag filter surfaces only `broken`, `confusing`, `missing`, or `good` nodes — combinable
9. Contributor filter — show only nodes touched by a specific contributor
10. Graph is zoomable and pannable with a minimap — 200+ nodes remain performant
11. Drag one or more session folders into the viewer — merge runs client-side using the shared merge logic from piece #5, graph updates live
12. Fully offline capable — no requests leave the machine at runtime

**Out of scope for this piece:** workflow animations (piece #7), workflow recording mode (piece #8)

---

### Piece 7 — Workflow definition, gap detection, and platform extensibility

**Architecture decision:** File System Access API — viewer prompts for folder access on first load, then reads and writes `session.json` and `/screenshots/` directly. No server, no Electron, no manual export step. Chrome required (already a given for the extension).

**Dynamic file access:**
1. Viewer prompts for folder access on first load via File System Access API — one permission grant, then full read/write for the session lifetime
2. All changes (workflow definitions, stub nodes, gap flags) write back to `session.json` immediately — no manual export step

**Workflow definition:**
3. User can define a named workflow by clicking nodes in the graph in sequence, or searching by page title and adding — both input methods work together in the same definition flow
4. Defined workflows saved to `session.json` under the `workflows` array immediately on save — same schema as extension-recorded workflows
5. Selecting a defined workflow highlights the path sequentially, dims everything else
6. Two workflows selectable simultaneously for comparison — shared nodes and divergent paths visually distinct. Single workflow is the primary mode

**Gap detection:**
7. Workflows with missing intermediate nodes surface gaps explicitly — "2 uncaptured steps between X and Y"
8. Gaps resolved two ways: stub a placeholder node (URL + title, no screenshot) or add to capture queue
9. Stub nodes visually distinct from captured nodes throughout the viewer — never ambiguous
10. Capture queue exportable as a JSON file the extension can ingest as a prioritised list of pages to visit next

**Platform extensibility:**
11. Node schema gains a `platform` field: `"web"` · `"desktop"` · `"cli"` · extensible
12. Each platform renders as a separate root cluster — distinct visual treatment per platform
13. Platform filter: show/hide entire clusters independently
14. Adding a new platform requires no structural changes — new `platform` value and root node only
15. All merge logic and gap detection operate correctly across platform boundaries

**Out of scope for this piece:** workflow animation, piece #8 recording mode

---

### Piece 8 — Workflow recording mode

**Mode management:**
1. Mode toggle available at any point during a session — not locked to session start. Switching from Map to Workflow prompts for a workflow name; switching back to Map resumes general capture
2. Current mode always visible in the extension UI — never ambiguous which mode is active

**Workflow recording:**
3. Workflow mode prompts for a workflow name before the first capture in that mode — required, not skippable
4. All capture behavior from pieces #1–4 applies in workflow mode — navigation, screenshots, audio notes, modal detection, sanity check toasts
5. Workflow path recorded as an ordered array of node IDs in real time — not reconstructed after the session
6. Captures everything the user navigates, including tangents — full path recorded, not just a curated subset

**Editing:**
7. Workflow path editable after the session ends — contributor can remove accidental tangent nodes, reorder steps, or rename the workflow before export
8. Edit UI presents the workflow as an ordered list of page titles with screenshots — reorderable, deletable, not just raw node IDs

**Merge behavior:**
9. Session JSON from a workflow session is valid and mergeable — same schema as a map session
10. On merge, workflow nodes deduplicate correctly against the existing map — shared pages become one node, workflow path updated to use unified IDs

**Capture queue:**
11. Extension can load a capture queue JSON exported from the viewer
12. Active capture queue shows a persistent, dismissible "next target" chip in the extension UI — page title and URL of the next uncaptured stub
13. Completing a queued page marks it as done in the chip — advances to the next target automatically

**Out of scope for this piece:** Docker Desktop and CLI capture (extensibility accounted for in schema, not yet built)

---

## Open Questions

All questions resolved through scoping sessions. None outstanding.
