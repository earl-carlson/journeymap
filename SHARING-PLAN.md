# IA Mapper — Sharing & Collaboration Plan

## Problem

The viewer currently runs locally and reads session data from the filesystem. To make the IA map useful to the broader team, we need:

1. **Anyone can view the map** without cloning the repo or running anything
2. **Anyone can contribute** — add workflows, flag pages, write notes
3. **Contributions flow back** into the canonical dataset and get republished

## Current state

- Viewer: single self-contained HTML file (474KB), reads from local directory via File System Access API
- Session data: JSON files + PNG screenshots (~10MB currently, could grow to 50-100MB at full mapping)
- Merge logic: already handles multi-contributor dedup (nodes by URL hash, notes attributed, flags unioned, workflows deduped by name)

---

## Phase 1: Publish + Export Changes (no infrastructure)

### Publish command

A build step that produces a single self-contained HTML file with all session data and screenshots embedded.

```
npm run publish
→ reads all sessions from exports/
→ merges into unified graph
→ embeds screenshots as base64 data URLs
→ outputs dist/ia-map.html (~50-100MB depending on screenshot count)
```

Share `ia-map.html` via Slack, Google Drive, or any file host. Anyone opens it in a browser — no install, no server, no auth.

### Export Changes button

The published viewer tracks what the user changes during their session (new workflows, new notes, new flags). An "Export Changes" button downloads a delta JSON:

```json
{
  "contributor": "Mat",
  "timestamp": "2026-05-13T14:30:00Z",
  "workflows": [
    { "name": "New user onboarding", "persona": "Developer", "path": ["a1b2c3", "d4e5f6", ...] }
  ],
  "notes": {
    "a1b2c3": [{ "text": "This page is confusing", "contributor": "Mat" }]
  },
  "flags": {
    "d4e5f6": ["confusing"]
  }
}
```

### Merge changes command

A CLI command that folds exported changes back into the canonical session data:

```
npm run merge-changes changes-mat-2026-05-13.json
→ reads the changes JSON
→ applies workflows, notes, flags to the merged session
→ writes updated session.json
```

Then republish:

```
npm run publish
→ updated ia-map.html with Mat's workflows included
```

### Workflow

```
You:  npm run publish → ia-map.html
You:  share ia-map.html via Slack/Drive
Them: open in browser, explore, add workflows, flag pages, write notes
Them: click "Export Changes" → downloads changes-{name}-{date}.json
Them: drop the JSON in Slack
You:  npm run merge-changes changes-{name}-{date}.json
You:  npm run publish → updated ia-map.html
```

### Pros
- Zero infrastructure — no server, no hosting, no auth
- Works offline once opened
- Merge logic already exists
- Small team = Slack handoff is fine
- Changes are reviewed before going live (you control the merge)

### Cons
- Manual round-trip (Slack/email for the changes file)
- You're the bottleneck for merging and republishing
- Published file could be large with many screenshots (50-100MB)
- No real-time collaboration — each person works on a snapshot

---

## Phase 2: GitHub Pages (live URL, still manual merge)

Host the viewer on GitHub Pages with session data as static JSON + screenshot files.

```
https://earl-carlson.github.io/journeymap/
```

- Viewer loads `session.json` + screenshots via fetch (no File System Access API needed)
- Same "Export Changes" button — user downloads delta JSON
- Same merge-changes CLI to fold contributions back in
- `git push` to update the live site

### What changes from Phase 1
- Viewer gains a URL-based data loader (fetch from known path)
- Screenshots served as individual files (not base64 embedded) — faster load
- Anyone with the URL sees the latest published state
- Still no write-back — contributions still go through you

### Pros
- Persistent URL instead of passing files around
- Faster load (lazy screenshot loading vs. embedded base64)
- Free hosting via GitHub Pages

### Cons
- Still manual merge for contributions
- Screenshots in the repo (could use Git LFS or a separate branch)
- Need to set up GitHub Pages deployment

---

## Phase 3: Cloudflare Worker + R2 (real-time collaboration)

Add a thin API layer for read/write. Viewer fetches data on load and POSTs changes back.

- **Cloudflare Pages**: hosts the viewer (free)
- **Cloudflare R2**: stores session JSON + screenshots (10GB free tier)
- **Cloudflare Worker**: thin API — GET session data, POST changes, optional auth

### What changes from Phase 2
- Viewer's `mutateSession()` writes to the API instead of File System Access
- Changes are immediately visible to everyone on next load
- Optional: simple auth (shared password, or Cloudflare Access for Docker SSO)

### Pros
- Real-time collaboration — no manual merge
- Changes persist immediately
- Free tier covers this project easily
- No server to manage (serverless)

### Cons
- Most setup effort
- Need auth to prevent random writes
- Conflict resolution if two people edit simultaneously (last-write-wins is probably fine for this team size)

---

## Recommendation

Start with **Phase 1**. It's the fastest path to getting the map in front of the team. The manual Slack handoff is fine for a team of 5-10 people doing a 3-week mapping sprint.

Move to **Phase 2** once the map is stable enough to warrant a persistent URL (probably end of week 1).

Move to **Phase 3** only if the manual merge becomes a bottleneck — unlikely for this project's scope and timeline.

---

## Open questions

- File size: at full mapping, how many screenshots? If >200, the self-contained HTML could exceed 100MB. May need to strip screenshots from the published file and host them separately.
- Auth: does the team need edit access controlled, or is "anyone with the link can contribute" fine?
- Frequency: how often will you republish? Daily? After each mapping session?
- Existing tooling: is there a preferred place to host static files at Docker (internal CDN, Confluence, etc.)?
