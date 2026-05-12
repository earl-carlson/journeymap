# IA Mapper

A Chrome extension and interactive viewer for mapping Docker's information architecture across all `*.docker.com` surfaces. Captures navigation, screenshots, and annotations as you browse, then visualizes the IA as an interactive graph.

## Quick Start

### 1. Install the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder from this repo
4. Click the IA Mapper icon to open the side panel

### 2. Map a surface

1. Navigate to any `*.docker.com` page
2. In the side panel, set your name and choose the `exports/` folder from this repo
3. Click **Start Session**
4. Browse Docker surfaces — navigation, screenshots, and hierarchy are captured automatically
5. Flag pages as you go: `broken`, `confusing`, `missing`, or `good`
6. To record a workflow, click **Workflow** in the mode toggle, name it, pick a persona, and browse the flow
7. Click **End Session** when done — files are saved to `exports/`

### 3. View the map

1. Open `dist/index.html` in Chrome
2. If you've loaded before, click **Load from exports** — it remembers the folder
3. First time only: click **Open Exports Folder** and select the `exports/` directory
4. All sessions are merged automatically into a single graph
5. Click **Refresh** in the toolbar to pick up new sessions without reopening

### 4. Add workflows and notes in the viewer

- Click **Workflows** in the toolbar to open the workflow panel
- Click **+ New Workflow**, name it, pick a persona, add workflow-level notes
- Click nodes on the graph to add steps, or use **+ Add Custom Step** for off-platform steps (e.g. email, desktop app)
- Custom steps support a title, notes, and an optional screenshot upload
- Click any node to open the detail panel — add notes, toggle flags
- All changes save to `exports/session-viewer/session.json` automatically

## Team Workflow

### Mapping (designers, engineers)

Each person maps their own surfaces:

1. Clone the repo
2. Install the extension (step 1 above)
3. Start a session, browse your surfaces, flag issues, record workflows
4. End session — your data lands in `exports/session-{name}-{date}/`
5. Commit and push your session folder

### Reviewing (PMs, directors)

Open the viewer to explore what's been mapped:

1. Pull the latest from the repo
2. Open `dist/index.html`, click **Load from exports** (or pick the folder first time)
3. Browse the graph, check workflows, add notes and flags
4. Commit and push `exports/session-viewer/` with your additions

### Merging

No manual merge needed. The viewer scans all `session-*/` folders in `exports/` and merges them automatically:

- Same page from multiple contributors = one node with combined notes and flags
- Workflows from all contributors appear in the workflow panel
- Screenshots use the most recent capture

## Repo Structure

```
extension/          Chrome extension (load unpacked, no build step)
viewer/             React Flow viewer (Vite + single-file build)
dist/index.html     Built viewer (self-contained, open in Chrome)
exports/            Session data (each contributor gets their own folder)
```

## Viewer Controls

| Control | Action |
|---|---|
| **Hierarchy / Navigation / All** | Switch graph layout mode |
| **Workflows** | Open workflow panel (define, view, compare) |
| **Hide/Show Stubs** | Toggle inferred (unvisited) nodes |
| **Refresh** | Reload sessions from the exports folder |
| **Flag pills** (top right) | Filter to broken / confusing / missing / good nodes |
| **Click a node** | Open detail panel with screenshot, notes, flags, edges |
| **Click a workflow** | Highlight the path, dim everything else |

## Extension Modes

**Map Mode** — Default. Auto-captures every page you navigate. Builds the graph continuously.

**Workflow Mode** — Toggle via the Map/Workflow switch. Names the workflow, picks a persona, records the ordered navigation path. Edit the path before saving when you end the session.

## Workflows

Workflows support:

- **Persona** — tag with Admin, Docker Employee, Purchaser, Developer, VP of Engineering, or custom
- **Notes** — annotate the workflow itself with context, assumptions, or observations
- **Custom steps** — add steps that aren't in the captured graph (e.g. "Check email for login link", "Open Docker Desktop"). Custom steps can have a title, notes, and an optional screenshot
- **Gap detection** — the viewer identifies missing intermediate nodes between workflow steps
- **Capture queue** — export uncaptured stubs as a JSON file the extension can load to guide the next mapping session

## Persistence

- **Extension sessions** save to `exports/session-{name}-{date}-{time}/` with `session.json` + `screenshots/`
- **Viewer changes** (workflows, notes, flags added in the viewer) save to `exports/session-viewer/session.json`
- **Reload** picks up all changes — no rebuild needed
- The viewer remembers the exports folder between sessions (stored in browser IndexedDB)

## Building the Viewer

Only needed if you change the viewer source code. Not needed for day-to-day use.

```bash
cd viewer
npm install
npm run build
# Output: dist/index.html
```

Requires Node.js 18+.
