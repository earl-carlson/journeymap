---
marp: true
theme: docker-light
paginate: true
html: true
size: 1920x1080
---

<!-- _class: accent-wave -->
<!-- _paginate: false -->

<img src="/Users/earl/Documents/GitHub/loupe/themes/logos/brand/docker-mark.png" style="height: 24px; margin-bottom: 48px;">

# Docker IA Map

May 2026 — Working draft

<!--
Internal stakeholder update. Covers the six-area IA model, key journeys per surface, and open questions that need decisions.
-->

---

<!-- _class: lead -->

# The product landscape has grown faster than the IA that holds it together.

<!--
Six distinct surfaces. Multiple orgs. Overlapping ownership. Users navigating between Hub, Desktop, Admin, and app.docker.com to do a single job.
This deck maps where we are, where things belong, and what's unresolved.
-->

---

<!-- _class: centered -->

## Three principles that govern every placement decision

<!--
These aren't aspirational. They're the rules we apply when something new gets built and someone asks "where does this go?"
-->

<style scoped>
.principles { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 48px; max-width: 1400px; }
.p { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px 28px; }
.p-title { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 12px; }
.p-body { font-size: 15px; color: #6b7280; line-height: 1.6; }
</style>

<div class="principles">
<div class="p">
<div class="p-title">Everything has a home.</div>
<div class="p-body">Every feature, setting, and workflow has one primary home. No squatting in the wrong space because it's convenient.</div>
</div>
<div class="p">
<div class="p-title">Each space is made for someone.</div>
<div class="p-body">The spaces are distinct enough that you know which one is yours without having to search. If someone looks in three places, the IA is wrong.</div>
</div>
<div class="p">
<div class="p-title">The system is modular.</div>
<div class="p-body">Any surface can expose a contextual window into another — a billing widget, a doc panel, a usage summary. That window is a peek, not a copy. The full experience lives in one place.</div>
</div>
</div>

---

<!-- _class: lead -->

# Six areas. One model.

<!--
The entire Docker product landscape maps to six areas. Each has a clear owner, a clear audience, and a clear boundary.
-->

---

<!-- _class: full -->

## The six areas

<style scoped>
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 32px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px 24px 20px; }
.card-area { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 8px; }
.card-title { font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 10px; }
.card-who { font-size: 13px; color: #0091E2; font-weight: 500; margin-bottom: 8px; }
.card-owns { font-size: 13px; color: #6b7280; line-height: 1.5; }
</style>

<div class="grid">
<div class="card">
<div class="card-area">Area 01</div>
<div class="card-title">www</div>
<div class="card-who">Execs & senior leaders evaluating Docker</div>
<div class="card-owns">Marketing, product pages, pricing, conversion</div>
</div>
<div class="card">
<div class="card-area">Area 02</div>
<div class="card-title">Docs</div>
<div class="card-who">Anyone using the tools</div>
<div class="card-owns">Full documentation, guides, reference</div>
</div>
<div class="card">
<div class="card-area">Area 03</div>
<div class="card-title">Hub</div>
<div class="card-who">Developers publishing and pulling images</div>
<div class="card-owns">Image registry, marketplace, search, org namespaces</div>
</div>
<div class="card">
<div class="card-area">Area 04</div>
<div class="card-title">Container Platform</div>
<div class="card-who">Developers working with containers</div>
<div class="card-owns">Docker Desktop, Build, Compose, Secure Artifacts, CLI</div>
</div>
<div class="card">
<div class="card-area">Area 05</div>
<div class="card-title">Agentic Platform</div>
<div class="card-who">Developers working with AI agents</div>
<div class="card-owns">Agent sessions, MCP, Gordon, Cloud Sandboxes, CLI</div>
</div>
<div class="card">
<div class="card-area">Area 06</div>
<div class="card-title">Admin</div>
<div class="card-who">IT admins, security leads, procurement</div>
<div class="card-owns">Org management, billing, governance config, provisioning</div>
</div>
</div>

<!--
Hub is kept standalone for now even though Container Platform org owns it. Worth revisiting.
-->

---

<!-- _class: full -->

## www

<style scoped>
.area-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
.area-desc { font-size: 18px; color: #374151; line-height: 1.6; margin-bottom: 32px; }
.list-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 10px; }
.items { list-style: none; padding: 0; }
.items li { font-size: 15px; color: #374151; padding: 6px 0 6px 16px; position: relative; border-bottom: 1px solid #f3f4f6; }
.items li::before { content: '—'; position: absolute; left: 0; color: #d1d5db; }
.not li { color: #9ca3af; }
.not li::before { content: '×'; color: #d1d5db; }
.warning-box { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 6px; padding: 16px 20px; margin-top: 24px; font-size: 14px; color: #92400e; line-height: 1.5; }
</style>

<div class="area-layout">
<div>
<div class="area-desc">Marketing, product pages, pricing, and conversion. The pre-purchase surface for execs and senior leaders evaluating Docker.</div>
<div class="list-label">What lives here</div>
<ul class="items">
<li>Product pages, use cases, customer stories</li>
<li>Pricing and plan comparison</li>
<li>Conversion flows — sign up, start trial, talk to sales</li>
<li>Blog, press, company</li>
</ul>
</div>
<div>
<div class="list-label">What does not live here</div>
<ul class="items not">
<li>Any authenticated product experience</li>
<li>Settings of any kind</li>
<li>Billing — link to Admin</li>
<li>Documentation — link to Docs</li>
</ul>
<div class="warning-box">⚠ Highest-debt surface. Every page has diverged independently. No page should be used as a reference for what www should look like. Needs a full audit before any new content is added.</div>
</div>
</div>

---

<!-- _class: table-slide -->

## www — journeys

| Journey | Role | Key stages |
|---|---|---|
| **Evaluation & purchase** | Exec · Procurement | Land on docker.com → read product pages → compare plans → convert (sign up / talk to sales) |

---

<!-- _class: full -->

## www — what needs to be fixed

<style scoped>
.empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 48px 32px; text-align: center; color: #9ca3af; font-size: 15px; margin-top: 32px; }
</style>

<div class="empty">Add known issues here.</div>

---

<!-- _class: full -->

## Docs

<style scoped>
.area-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
.area-desc { font-size: 18px; color: #374151; line-height: 1.6; margin-bottom: 32px; }
.list-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 10px; }
.items { list-style: none; padding: 0; }
.items li { font-size: 15px; color: #374151; padding: 6px 0 6px 16px; position: relative; border-bottom: 1px solid #f3f4f6; }
.items li::before { content: '—'; position: absolute; left: 0; color: #d1d5db; }
.not li { color: #9ca3af; }
.not li::before { content: '×'; color: #d1d5db; }
.note-box { background: rgba(0,145,226,0.06); border: 1px solid rgba(0,145,226,0.15); border-radius: 6px; padding: 16px 20px; margin-top: 24px; font-size: 14px; color: #0369a1; line-height: 1.5; }
</style>

<div class="area-layout">
<div>
<div class="area-desc">Full documentation, guides, tutorials, and API reference. The single source of truth for anyone actively using Docker tools.</div>
<div class="list-label">What lives here</div>
<ul class="items">
<li>Full documentation site</li>
<li>Guides, tutorials, reference, API docs</li>
<li>Changelog and release notes</li>
</ul>
</div>
<div>
<div class="list-label">What does not live here</div>
<ul class="items not">
<li>Marketing copy — www</li>
<li>Product UI — each platform</li>
<li>Settings of any kind</li>
</ul>
<div class="note-box">Any product surface can embed a contextual doc panel. That panel is a peek into Docs, not a copy of it. A platform team owns the panel component. The Docs team owns the content inside it.</div>
</div>
</div>

---

<!-- _class: table-slide -->

## Docs — journeys

| Journey | Role | Key stages |
|---|---|---|
| **Self-serve documentation** | Any role | Hit an error or knowledge gap → search Docs → find the guide → apply it → unblocked |

---

<!-- _class: full -->

## Docs — what needs to be fixed

<style scoped>
.empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 48px 32px; text-align: center; color: #9ca3af; font-size: 15px; margin-top: 32px; }
</style>

<div class="empty">Add known issues here.</div>

---

<!-- _class: full -->

## Hub

<style scoped>
.area-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
.area-desc { font-size: 18px; color: #374151; line-height: 1.6; margin-bottom: 32px; }
.list-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 10px; }
.items { list-style: none; padding: 0; }
.items li { font-size: 15px; color: #374151; padding: 6px 0 6px 16px; position: relative; border-bottom: 1px solid #f3f4f6; }
.items li::before { content: '—'; position: absolute; left: 0; color: #d1d5db; }
.not li { color: #9ca3af; }
.not li::before { content: '×'; color: #d1d5db; }
.workflow { margin-bottom: 20px; }
.wf-name { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 4px; }
.wf-body { font-size: 14px; color: #6b7280; line-height: 1.5; }
</style>

<div class="area-layout">
<div>
<div class="area-desc">The world's largest container registry. Developers push, pull, search, and share images. Home to Docker Official Images, Verified Publishers, and the MCP catalog.</div>
<div class="list-label">Key workflows</div>
<div class="workflow">
<div class="wf-name">Publishing</div>
<div class="wf-body">Developer builds an image locally → tags it → pushes to Hub → sets visibility → team pulls it as a dependency.</div>
</div>
<div class="workflow">
<div class="wf-name">Discovery</div>
<div class="wf-body">Developer searches Hub for a base image → browses the Marketplace → pulls and integrates.</div>
</div>
</div>
<div>
<div class="list-label">What lives here</div>
<ul class="items" style="margin-bottom:24px;">
<li>Image registry — push, pull, search, browse</li>
<li>Org namespaces and repository management</li>
<li>Marketplace</li>
<li>Webhooks and access tokens for registry automation</li>
</ul>
<div class="list-label">What does not live here</div>
<ul class="items not">
<li>Hardened Images catalog — Container Platform</li>
<li>Full billing — billing widget yes; plan management in Admin</li>
<li>Org-level auth — Admin</li>
<li>Container runtime — Desktop</li>
</ul>
</div>
</div>

---

<!-- _class: table-slide -->

## Hub — journeys

| Journey | Role | Key stages |
|---|---|---|
| **Image discovery** | Developer | Search Hub → filter by category / trusted content → browse result → read repo overview → pull image |
| **Private repo management** | Developer · Platform Engineer | Create private repo → push images → manage tags and visibility → monitor pull and storage usage |
| **Hub Publisher** | Developer · Platform Engineer | Build image locally → tag → push to Hub → set visibility → write repo overview → team pulls |
| **DVP insights** | Platform Engineer | Access DVP dashboard → view pull data by image → analyze distribution → export for reporting |
| **MCP Hub discovery** | Developer | Browse MCP catalog on Hub → read server overview → connect to Docker Desktop to use |
| **DHI on Hub** | Developer · Security Lead | Log in → browse DHI catalog → find hardened image → get pull command → enterprise: manage entitlements |

<!--
Hub now has 6 journeys. DVP insights was previously flagged as a gap (Q09). MCP Hub and DHI on Hub are disconnected from the main Hub search — that disconnection is itself a known issue.
-->

---

<!-- _class: full -->

## Hub — what needs to be fixed

<style scoped>
.empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 48px 32px; text-align: center; color: #9ca3af; font-size: 15px; margin-top: 32px; }
</style>

<div class="empty">Add known issues here.</div>

---

<!-- _class: full -->

## Container Platform

<style scoped>
.area-desc { font-size: 16px; color: #374151; line-height: 1.6; margin-bottom: 28px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.col-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 12px; margin-top: 20px; }
.col-head:first-child { margin-top: 0; }
.items { list-style: none; padding: 0; }
.items li { font-size: 13px; color: #374151; padding: 4px 0 4px 14px; position: relative; border-bottom: 1px solid #f9fafb; }
.items li::before { content: '—'; position: absolute; left: 0; color: #d1d5db; }
.not li { color: #9ca3af; }
.not li::before { content: '×'; }
.note-box { background: rgba(0,145,226,0.06); border: 1px solid rgba(0,145,226,0.15); border-radius: 6px; padding: 12px 16px; margin-top: 16px; font-size: 13px; color: #0369a1; }
</style>

<div class="area-desc">Docker Desktop, Build Cloud, Offload, Hardened Images, Scout, and Testcontainers Cloud. The daily workspace for developers and DevOps engineers building and running containerized applications.</div>

<div class="two-col">
<div>
<div class="col-head">Docker Desktop</div>
<ul class="items">
<li>Container and image management UI</li>
<li>Compose File Viewer + Compose Bridge (local → Kubernetes)</li>
<li>Build UI — history, troubleshooting, performance comparison</li>
<li>Gordon — AI assistant, context-aware to local environment</li>
<li>Docker Offload — local/cloud engine switching</li>
<li>Coding Agent Sandboxes — local isolation for agentic work</li>
</ul>
<div class="col-head">Docker Scout + Testcontainers Cloud</div>
<ul class="items">
<li>Scout: vulnerability scanning, image policy, SBOM</li>
<li>TCC: cloud-based runtime for integration tests</li>
</ul>
</div>
<div>
<div class="col-head">Docker Build Cloud</div>
<ul class="items">
<li>Shared cache, accelerated CI builds</li>
<li>Build performance analytics — org, user, time period</li>
<li>CI pipeline debugging and metadata</li>
</ul>
<div class="col-head">Secure Artifacts</div>
<ul class="items">
<li>Docker Hardened Images (DHI) catalog, mirroring, customizations</li>
<li>Helm Charts, DOI (Docker Official Images)</li>
</ul>
<div class="col-head">What does not live here</div>
<ul class="items not">
<li>Org-level policy enforcement — Admin</li>
<li>Agent session history, scheduling, cloud sandboxes — Agentic Platform</li>
<li>MCP Toolkit — Agentic Platform</li>
</ul>
<div class="note-box">Scout straddles Container Platform (developer-facing) and Admin (org policy). Same open question as Gordon's placement.</div>
</div>
</div>

---

<!-- _class: table-slide -->

## Container Platform — journeys

| Journey | Role | Key stages |
|---|---|---|
| **First-time setup** | Developer | Install Desktop → open Learning center → complete walkthrough → run first container |
| **Desktop & CLI** | Developer | Start work → run in container → iterate with logs, exec, container state |
| **Model Runner** | Developer | Enable → pull model → hit local API → integrate → share with team |
| **Gordon** | Developer | Hit an error → ask Gordon → get a specific fix → use daily |
| **Docker Scout** | Developer · Security Lead | View image vulnerabilities → understand policy violation → remediate → recheck |
| **Compose GUI** | Developer · DevOps | Inspect running stack → convert and deploy to Kubernetes |
| **Build UI** | Developer · DevOps | Build fails → trace → fix → compare performance |
| **Build Cloud** | DevOps Engineer | Connect to CI → shared cache → analytics → pipeline debug |
| **Offload** | Developer · DevOps | Select cloud engine → workloads run remotely → team rollout |
| **Sandboxes** | Developer · DevOps · IT Admin | Isolate agent → parallel threads → cloud sandboxes → org governance |
| **Hardened Images** | Platform Engineer · Security Lead | Browse catalog → mirror to internal registry → apply customizations |

---

<!-- _class: full -->

## Container Platform — what needs to be fixed

<style scoped>
.empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 48px 32px; text-align: center; color: #9ca3af; font-size: 15px; margin-top: 32px; }
</style>

<div class="empty">Add known issues here.</div>

---

<!-- _class: full -->

## Agentic Platform

<style scoped>
.area-desc { font-size: 16px; color: #374151; line-height: 1.6; margin-bottom: 28px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.col-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 12px; margin-top: 20px; }
.col-head:first-child { margin-top: 0; }
.items { list-style: none; padding: 0; }
.items li { font-size: 13px; color: #374151; padding: 4px 0 4px 14px; position: relative; border-bottom: 1px solid #f9fafb; }
.items li::before { content: '—'; position: absolute; left: 0; color: #d1d5db; }
.not li { color: #9ca3af; }
.not li::before { content: '×'; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.chip { font-size: 12px; color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 3px 10px; }
</style>

<div class="area-desc">Agent sessions, MCP Toolkit, Gordon, and Cloud Sandboxes. For tech leads and senior engineers who want to delegate well-defined coding work to autonomous agents.</div>

<div class="two-col">
<div>
<div class="col-head">What lives here</div>
<ul class="items">
<li>Agent session management — create, run, monitor, review</li>
<li>Agent team configuration — orchestrator, implementer, reviewer, documentalist, custom</li>
<li>Project setup — repository connection, GitHub permissions, session history</li>
<li>Scheduling — daily/weekly agent runs tied to GitHub events or cron</li>
<li>BYOK — bring your own API key (Anthropic, OpenAI, etc.)</li>
<li>Slack and GitHub integrations</li>
<li>Session artifacts — PRs opened, diffs, logs</li>
<li>MCP Toolkit — browse, configure, share MCP server profiles</li>
<li>Cloud Sandboxes — <code>sbx --cloud</code></li>
</ul>
</div>
<div>
<div class="col-head">User settings</div>
<div class="chips">
<span class="chip">API key management (BYOK)</span>
<span class="chip">GitHub integration credentials</span>
<span class="chip">Slack integration credentials</span>
<span class="chip">Agent default behavior & instructions</span>
<span class="chip">MCP server profiles & client connections</span>
</div>
<div class="col-head" style="margin-top:28px;">What does not live here</div>
<ul class="items not">
<li>Org-level agent governance — Admin</li>
<li>Container runtime — Desktop</li>
<li>Local coding agent sandboxes — Container Platform</li>
<li>Full billing — billing widget yes; plan management in Admin</li>
</ul>
</div>
</div>

---

<!-- _class: table-slide -->

## Agentic Platform — journeys

| Journey | Role | Key stages |
|---|---|---|
| **Agentic Platform** | Tech Lead | Connect repo → first agent run → customize agents → schedule → team rollout |
| **MCP Toolkit** | Developer | Browse catalog → connect server → connect AI client → share profile |

---

<!-- _class: full -->

## Agentic Platform — what needs to be fixed

<style scoped>
.empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 48px 32px; text-align: center; color: #9ca3af; font-size: 15px; margin-top: 32px; }
</style>

<div class="empty">Add known issues here.</div>

---

<!-- _class: full -->

## Admin

<style scoped>
.area-desc { font-size: 16px; color: #374151; line-height: 1.6; margin-bottom: 28px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.col-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 12px; margin-top: 20px; }
.col-head:first-child { margin-top: 0; }
.items { list-style: none; padding: 0; }
.items li { font-size: 13px; color: #374151; padding: 4px 0 4px 14px; position: relative; border-bottom: 1px solid #f9fafb; }
.items li::before { content: '—'; position: absolute; left: 0; color: #d1d5db; }
.not li { color: #9ca3af; }
.not li::before { content: '×'; }
.note-box { background: rgba(0,145,226,0.06); border: 1px solid rgba(0,145,226,0.15); border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #0369a1; }
</style>

<div class="area-desc">Billing, subscriptions, org onboarding, SSO, governance configuration, and compliance. For IT admins, security leads, and procurement at Business-tier orgs.</div>

<div class="note-box">Admin is the UI where org admins configure governance. The Governance Platform is the underlying substrate that Container Platform, Agentic Platform, and other products plug into. Admin exposes the controls; the platform enforces them.</div>

<div class="two-col">
<div>
<div class="col-head">Billing & subscriptions</div>
<ul class="items">
<li>Plan management (Pro, Team, Business) and add-ons (Gordon, DHI)</li>
<li>PAYG enable/disable and spend controls</li>
<li>License quantity management</li>
<li>Usage dashboards — org-wide, by product</li>
<li>Invoices and payment methods</li>
</ul>
<div class="col-head">Org onboarding & authentication</div>
<ul class="items">
<li>Organization creation and settings</li>
<li>SSO configuration and SCIM provisioning</li>
<li>License assignment</li>
<li>Session and token policies</li>
</ul>
</div>
<div>
<div class="col-head">Governance configuration</div>
<ul class="items">
<li>Registry access restrictions</li>
<li>Network and filesystem policies for AI tools</li>
<li>Gordon governance — what Gordon can access and execute</li>
<li>Agentic Platform governance — sandbox controls, blast radius limits</li>
<li>Cross-product policy enforcement</li>
</ul>
<div class="col-head">Compliance & monitoring</div>
<ul class="items">
<li>Compliance Reporting</li>
<li>Adoption monitoring across the org</li>
<li>Audit logs</li>
</ul>
</div>
</div>

---

<!-- _class: table-slide -->

## Admin — journeys

| Journey | Role | Key stages |
|---|---|---|
| **Billing** | Procurement · IT Admin | Subscribe → enable PAYG → manage seats → review usage |
| **Admin & org provisioning** | IT Admin · Procurement · Security Lead | Set up org → configure SSO + SCIM → assign licenses → verify compliance |
| **DD deployment & policy management** | IT Admin · Platform Engineer | Deploy Desktop to org machines → define settings policies → view compliance reporting |

---

<!-- _class: full -->

## Admin — what needs to be fixed

<style scoped>
.empty { border: 1px dashed #d1d5db; border-radius: 8px; padding: 48px 32px; text-align: center; color: #9ca3af; font-size: 15px; margin-top: 32px; }
</style>

<div class="empty">Add known issues here.</div>

---

<!-- _class: lead -->

# Open questions

<!--
Eight questions — four active, one blocked, three parked. The active ones need decisions before the IA can be considered stable.
-->

---

<!-- _class: full -->

## Open questions — active

<style scoped>
.q { display: flex; gap: 20px; padding: 16px 0; border-bottom: 1px solid #f3f4f6; align-items: flex-start; }
.q:last-child { border-bottom: none; }
.q-num { font-size: 13px; font-weight: 600; color: #0091E2; width: 28px; flex-shrink: 0; padding-top: 2px; }
.q-title { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px; }
.q-body { font-size: 13px; color: #6b7280; line-height: 1.5; }
.tag { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 3px; border: 1px solid; margin-left: 8px; vertical-align: middle; }
.active { color: #0091E2; border-color: rgba(0,145,226,0.3); background: rgba(0,145,226,0.06); }
.blocked { color: #b45309; border-color: rgba(180,83,9,0.3); background: rgba(180,83,9,0.06); }
</style>

<div class="q">
<div class="q-num">01</div>
<div>
<div class="q-title">Gordon placement <span class="tag active">Active</span></div>
<div class="q-body">Gordon is owned by the Agents group but lives in Docker Desktop (Container Platform). Does Gordon have a presence in both, or does it move fully to Agentic Platform?</div>
</div>
</div>
<div class="q">
<div class="q-num">02</div>
<div>
<div class="q-title">Coding Agent Sandboxes vs. Cloud Sandboxes <span class="tag active">Active</span></div>
<div class="q-body">Local sandboxes (Dash Runtime) under Container Platform. Cloud Sandboxes (Cloud Group) under Agentic Platform. This split maps to the org but may be confusing to users. Worth a shared entry point or consistent naming.</div>
</div>
</div>
<div class="q">
<div class="q-num">03</div>
<div>
<div class="q-title">Admin: one workflow or three? <span class="tag active">Active</span></div>
<div class="q-body">Admin serves procurement, IT admins, and security leads with different goals. The navigation probably needs three distinct entry points, not one flat list.</div>
</div>
</div>
<div class="q">
<div class="q-num">04</div>
<div>
<div class="q-title">MCP placement <span class="tag active">Active</span></div>
<div class="q-body">MCP is owned by AI Tools & Security (Agents group) and listed under Agentic Platform. But MCP Toolkit in Desktop has historically lived in Container Platform. Primary home: Agentic Platform. Secondary surface: Desktop.</div>
</div>
</div>
<div class="q">
<div class="q-num">08</div>
<div>
<div class="q-title">Governance Platform as infrastructure <span class="tag blocked">Blocked</span></div>
<div class="q-body">Governance is the substrate, not a sibling product. Full implications — what "plugging in" means per product, what's hosted on app.docker.com — still being defined by Steven/Brian.</div>
</div>
</div>

---

<!-- _class: full -->

## Open questions — parked

<style scoped>
.q { display: flex; gap: 20px; padding: 16px 0; border-bottom: 1px solid #f3f4f6; align-items: flex-start; }
.q:last-child { border-bottom: none; }
.q-num { font-size: 13px; font-weight: 600; color: #9ca3af; width: 28px; flex-shrink: 0; padding-top: 2px; }
.q-title { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px; }
.q-body { font-size: 13px; color: #6b7280; line-height: 1.5; }
.tag { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 3px; border: 1px solid; margin-left: 8px; vertical-align: middle; }
.parked { color: #9ca3af; border-color: #d1d5db; background: transparent; }
</style>

<div class="q">
<div class="q-num">05</div>
<div>
<div class="q-title">Docs panels ownership <span class="tag parked">Parked</span></div>
<div class="q-body">A platform team owns the component. Docs team owns the content. Which team decides where panels appear and what content they surface? Needs an owner before this scales.</div>
</div>
</div>
<div class="q">
<div class="q-num">06</div>
<div>
<div class="q-title">Hub org ownership <span class="tag parked">Parked</span></div>
<div class="q-body">Hub is owned by the Container Platform group but kept as a standalone area. Revisit once product surface boundaries are clearer.</div>
</div>
</div>
<div class="q">
<div class="q-num">07</div>
<div>
<div class="q-title">CLI placement <span class="tag parked">Parked</span></div>
<div class="q-body">Listed as secondary under both Container Platform and Agentic Platform. Is that the right model or does it need a clearer primary home?</div>
</div>
</div>
<div class="q">
<div class="q-num">09</div>
<div>
<div class="q-title">DVP insights — missing journey <span class="tag parked">Parked</span></div>
<div class="q-body">Docker Verified Publishers get access to pull data on their images — a distinct role from the Hub Publisher journey. Worth a dedicated journey if DVP is a meaningful segment.</div>
</div>
</div>
<div class="q">
<div class="q-num">10</div>
<div>
<div class="q-title">Churn & contraction — missing from Billing journey <span class="tag parked">Parked</span></div>
<div class="q-body">The downgrade-to-free and seat removal path isn't covered in the current Billing journey. Low priority but worth adding on the next pass.</div>
</div>
</div>

---

<!-- _class: accent-wave -->
<!-- _paginate: false -->

<img src="/Users/earl/Documents/GitHub/loupe/themes/logos/brand/docker-mark.png" style="height: 24px; margin-bottom: 48px;">

# 

<!--
Closing slide — add the ask here.
-->
