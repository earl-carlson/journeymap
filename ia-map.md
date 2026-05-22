# Docker IA Map
*Working draft — May 2026*

---

## Principles

**Everything has a home.** Every feature, setting, and workflow has one primary home. If you're building something new and asking "where does this go," there is a clear answer. No squatting in the wrong space because it's convenient.

**Each space is made for someone.** A developer working only on agentic tools only needs the Agentic Platform. An IT admin only needs Admin. The spaces are distinct enough that you know which one is yours without having to search. If someone has to look in three places to find their thing, the IA is wrong.

**The system is modular, not duplicated.** Any surface can expose a contextual window into another — a billing widget, a doc panel, a usage summary. That window is a peek, not a copy. The full experience lives in one place. The widget is a convenience, not a second home.

---

## Kill list

Things that should not exist or should be radically cut before being rebuilt:

- Notification systems as currently implemented. No new notification surface gets built until there is a clear answer to: what action does this enable that the user couldn't take without it?

---

## The Six Areas

| Area | Who it's for | What it owns |
|---|---|---|
| **www** | Execs, senior leaders evaluating Docker | Marketing, product pages, pricing, conversion |
| **Docs** | Anyone using the tools | Full documentation, guides, reference |
| **Hub** | Developers publishing and pulling images | Image registry, marketplace, search, org namespaces |
| **Container Platform** | Developers working with containers | Docker Desktop, Build, Compose, Secure Artifacts, CLI (secondary) |
| **Admin** | IT admins, security leads, procurement | Org management, billing, governance config, provisioning |
| **Agentic Platform** | Developers working with AI agents | Agent sessions, MCP, Gordon, Cloud Sandboxes, CLI (secondary) |

*Note: Hub is kept as a standalone area for now even though the Container Platform org owns it. Worth revisiting.*

---

## www

**Primary users:** Execs and senior leaders evaluating whether Docker is worth it for their org.

**What lives here:**
- Product pages, use cases, customer stories
- Pricing and plan comparison
- Conversion flows (sign up, start trial, talk to sales)
- Blog, press, company

**What does not live here:**
- Any authenticated product experience
- Settings of any kind
- Billing (link to Admin)
- Documentation (link to Docs)

---

## Docs

**Primary users:** Anyone actively using Docker tools — developers, DevOps, admins.

**What lives here:**
- Full documentation site
- Guides, tutorials, reference, API docs
- Changelog and release notes

**What does not live here:**
- Marketing copy (www)
- Product UI (each platform)
- Settings of any kind

**Note:** Any product surface can embed a contextual doc panel. That panel is a peek into Docs, not a copy of it. A platform team owns the panel component. The Docs team owns the content inside it.

---

## Hub

**Primary users:** Developers publishing images, developers pulling images, security teams auditing image provenance.

**What lives here:**
- Image registry (push, pull, search, browse)
- Org namespaces and repository management
- Marketplace
- Webhooks and access tokens for registry automation

**Key workflows:**

*Publishing*
Developer builds an image locally → tags it → pushes to Hub → sets visibility (public/private) → team pulls it as a dependency.

*Discovery*
Developer searches Hub for a base image or tool → browses the Marketplace → pulls and integrates.

**What does not live here:**
- Hardened Images catalog and mirroring (Container Platform — Secure Artifacts)
- Full billing (billing widget: yes — shows pull/storage usage; full plan management: Admin)
- Org-level auth (Admin)
- Container runtime (Desktop)

---

## Container Platform

**Org owner:** Container Platform group (Desktop Runtime, Desktop Platform, Desktop Delivery, Developer Productivity, Offload, Hub, Secure Artifacts, Secure Build)

**Primary users:** Backend engineers, DevOps engineers, platform engineers working with containers day-to-day.

**What lives here:**
- Docker Desktop (the primary surface)
  - Container and image management UI
  - Compose File Viewer
  - Compose Bridge (local → Kubernetes)
  - Build UI (build history, troubleshooting, performance comparison)
  - Gordon (AI assistant, context-aware to local environment — see note)
  - Docker Offload (local/cloud engine switching)
  - Coding Agent Sandboxes (local isolation for agentic work — see note)
  - User-level settings for all of the above
- Docker Build Cloud
  - Shared cache, accelerated CI builds
  - Build performance analytics (org, user, time period)
  - CI pipeline debugging and metadata
  - Billing widget (shows build minutes used; full plan in Admin)
- Secure Artifacts
  - Docker Hardened Images (DHI) catalog
  - DHI mirroring and org-specific customizations
  - Helm Charts
  - Developer Experience tooling
  - DOI (Docker Official Images)
- Secure Build
- CLI (secondary surface — commands map to Desktop and Build Cloud capabilities)

**Key workflows:**

*Debugging a failed build*
Engineer triggers a build → it fails → opens Build UI → reads the build trace → identifies the failing layer → fixes the Dockerfile → rebuilds. Gordon is available inline to explain errors or suggest fixes without leaving Desktop.

*Local model inference (Model Runner)*
Developer enables Model Runner in Desktop settings → pulls a model with `docker model pull` → hits the local OpenAI-compatible API endpoint → integrates into their app using the same API client they already use for cloud inference. Model is distributed as an OCI artifact from Hub.

*Compose to Kubernetes*
Developer runs a multi-container app locally with `docker compose up` → inspects the running stack in the Compose File Viewer → navigates to "Convert and Deploy to Kubernetes" → Compose Bridge generates Kubernetes manifests → deploys to the local Desktop Kubernetes cluster → validates pod and service behavior.

*Offload*
Engineer on underpowered hardware selects a cloud engine in Desktop → all Docker workloads run remotely → local experience is unchanged. DevOps manager enables offload for a team of remote workers on VDI instances.

*Hardened Images*
Security or platform engineer browses the DHI catalog → selects a base image → configures mirroring to internal registry → applies org-specific customizations → developers pull from internal mirror without touching the public catalog directly.

*Local coding agent sandbox*
Developer isolates a coding agent in a local sandbox → agent runs without risk to local filesystem or network. Engineer runs multiple agent threads on the same working directory using `--branch` for isolation without file conflicts.

**User settings that live here:**
- Model Runner configuration
- Build Cloud preferences
- Offload engine selection
- Gordon access and behavior (user level — org-level governance is in Admin)
- Desktop resource limits (CPU, memory, disk)

**What does not live here:**
- Org-level policy enforcement (Admin / Governance Platform)
- Full billing (billing widget: yes; plan management: Admin)
- Agent session history, scheduling, cloud sandboxes (Agentic Platform)
- MCP Toolkit (Agentic Platform — owned by AI Tools & Security)

---

## Agentic Platform

**Org owner:** Agents group (Gordon, Agent Builder, Cloud Group, AI Tools & Security, AI Models & Infra)

**Primary users:** Senior engineers and tech leads who want to delegate well-defined coding work to autonomous agents.

**What lives here:**
- Agent session management (create, run, monitor, review)
- Agent team configuration (orchestrator, implementer, reviewer, documentalist, custom)
- Project setup (repository connection, GitHub permissions, session history)
- Scheduling (daily/weekly agent runs tied to GitHub events or cron)
- BYOK (bring your own API key — Anthropic, OpenAI, etc.)
- Slack and GitHub integrations
- Session artifacts (PRs opened, diffs, logs)
- MCP Toolkit (browse, configure, share MCP server profiles — owned by AI Tools & Security)
- Cloud Sandboxes (`sbx --cloud` — owned by Cloud Group)
- User-level settings for all of the above
- CLI (secondary surface — `docker agent run`, session status, log tailing)

**Key workflows:**

*First agent run*
Tech lead signs in with Docker ID → creates a project → connects a GitHub repo (read + create PRs + read issues) → describes a task in plain language → selects an agent → agent runs in a secure cloud sandbox → produces a PR → tech lead reviews the PR. The PR being credible is the aha moment.

*Custom agent setup*
Developer creates a custom reviewer agent with specific instructions for their codebase → enables GitHub capability → connects Slack for status updates → connects Anthropic API key via BYOK → runs the agent on an open PR.

*Scheduled automation*
Tech lead sets up a daily schedule: reviewer agent runs on all open PRs at 9am. Weekly: documentalist agent updates the CHANGELOG. Engineering manager monitors session history the way they'd monitor CI.

*MCP server setup*
Developer browses the MCP catalog → selects servers → completes OAuth or config → connects AI client (Claude Desktop, Cursor) → Gateway routes requests automatically → exports profile for team reuse.

**User settings that live here:**
- API key management (BYOK)
- GitHub and Slack integration credentials
- Agent default behavior and instructions
- MCP server profiles and client connections

**What does not live here:**
- Org-level agent governance (Admin / Governance Platform)
- Container runtime (Desktop)
- Local coding agent sandboxes (Container Platform)
- Full billing (billing widget: yes — shows agent minutes/API spend; plan management: Admin)

---

## Admin

**Org owner:** Bridge group (Governance/Accounts/IAM, Billing, Operations, Data & Growth)

**Primary users:** IT admins, security leads, procurement, engineering managers at Business-tier orgs.

**Important distinction:** Admin is the UI where org admins configure governance. The Governance Platform is the underlying substrate (owned by Bridge) that Container Platform, Agentic Platform, and other products plug into. Admin exposes the controls; the platform enforces them.

**What lives here:**
- **Billing and subscriptions**
  - Plan management (Pro, Team, Business) and add-ons (Gordon, DHI)
  - PAYG enable/disable and spend controls
  - License quantity management
  - Usage dashboards (org-wide, by product)
  - Invoices and payment methods
- **Org onboarding and management**
  - Organization creation and settings
  - SSO configuration
  - Automated user provisioning (SCIM)
  - License assignment
- **Authentication**
  - SSO provider management
  - Session and token policies
- **Governance configuration** *(UI into the Governance Platform substrate)*
  - Registry access restrictions
  - Network and filesystem policies for AI tools
  - Gordon governance: what Gordon can access and execute on behalf of developers
  - Agentic Platform governance: sandbox controls, agent permission levels, blast radius limits
  - Cross-product policy enforcement
- **Compliance and monitoring**
  - Compliance Reporting
  - Adoption monitoring across the org
  - Audit logs
- **Inside sales and provisioning** *(internal tooling, not customer-facing)*
  - Org provisioning for sales-assisted deals
  - License management for enterprise accounts

**Key workflows:**

*New org setup*
IT admin creates the org → configures SSO → sets up SCIM for automated provisioning → assigns licenses → verifies enforcement via Compliance Reporting.

*Policy deployment*
Admin receives a policy requirement (e.g. restrict registry access to approved namespaces) → finds the setting in Admin Console → configures and deploys → verifies enforcement → monitors adoption.

*AI governance rollout*
Security lead configures what Gordon can read and execute on developer machines → sets sandbox requirements for agentic work → defines approval gates for agent-opened PRs → monitors agent activity logs.

*Billing management*
Procurement subscribes to Team plan + Gordon add-on → enables PAYG for Build Cloud → sets a spend alert → reviews usage at end of month → adjusts seat count.

**What does not live here:**
- User-level settings for any product (those live in the product)
- The Governance Platform substrate itself (Bridge-owned infrastructure, not a product surface)
- The actual product experiences (Gordon, agents, builds) — Admin governs them, doesn't host them

---

## Open questions

1. **Gordon placement.** Gordon is owned by the Agents group but lives in Docker Desktop (Container Platform). The ia-map has it under Container Platform. The org has it under Agents. This tension needs a resolution — does Gordon have a presence in both, or does it move fully to Agentic Platform?

2. **Coding Agent Sandboxes vs. Cloud Sandboxes.** Coding Agent Sandboxes (local, Dash Runtime group) is under Container Platform here. Cloud Sandboxes (Cloud Group) is under Agentic Platform. This split maps to the org but may be confusing to users who just think of "sandboxes." Worth a shared entry point or at least consistent naming.

3. **Admin: one workflow or three?** Admin serves procurement (billing), IT admins (provisioning), and security leads (governance) with pretty different goals. The navigation inside Admin probably needs three distinct entry points, not one flat list.

4. **MCP placement.** MCP is owned by AI Tools & Security (Agents group) and listed under Agentic Platform here. But MCP Toolkit in Desktop has historically lived in Container Platform. Primary home: Agentic Platform. Secondary surface: Desktop. Needs to be explicit in both places.

5. **Docs panels ownership.** A platform team owns the component. Docs team owns the content. Which team decides where panels appear and what content they surface? Needs an owner before this scales.

6. **Hub org ownership.** Hub (Registry + Marketplace) is owned by the Container Platform group but kept as a standalone area in this map. Revisit once the product surface boundaries are clearer.

7. **CLI placement.** Listed as secondary under both Container Platform and Agentic Platform. Is that the right model or does it need a clearer primary home?

8. **Governance Platform as infrastructure.** The Code Red doc is explicit that Governance is the substrate, not a sibling product. The ia-map reflects this in the Admin section but the full implications (what "plugging in" means for each product, what's hosted on app.docker.com) are still being defined by Steven/Brian.
