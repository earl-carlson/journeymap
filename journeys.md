Docker Model Runner
User Persona
"Alex, the AI-Curious Backend Developer"
Role: Software engineer (backend/full-stack) at a tech company building or integrating AI-powered features into their product.
Experience level: Comfortable with Docker, containers, and CLI tooling. Has some familiarity with LLMs through APIs (OpenAI, etc.) but hasn't run models locally before.
Goals: Wants to prototype AI features quickly, avoid paying cloud inference costs during development, and keep sensitive data off third-party servers. Also wants to avoid learning an entirely new toolchain just to work with models.
Frustrations: Setting up local model environments has felt fragmented, with juggling llama.cpp, Ollama, or Hugging Face tools separately from their container workflow. Hardware compatibility is a constant headache. There's no standard way to store or version models alongside the rest of their stack..
Customer Journey
Awareness: "I need a better way to run models locally" Alex is experimenting with LLMs but hitting friction: cloud costs are adding up, setup is messy, and every model has a different download process. They see a Docker blog post or a colleague mentions Docker Model Runner. The pitch ("run models like containers") immediately resonates because Docker is already central to their workflow.
Consideration: "Can this actually fit into how I work?" Alex reads the docs and sees that DMR uses the OpenAI-compatible API, meaning they won't have to rewrite their app code. They notice it integrates with tools they already use (Cursor, Continue, Cline) and that models are distributed as OCI artifacts on Docker Hub, the same registry they already use for images. The mental leap is small.
Activation: "Let me try it" Alex updates Docker Desktop, enables Model Runner in settings, and runs a model with a single docker model pull command. They hit the local API endpoint and get a response in seconds using GPU acceleration on their Apple Silicon Mac. The moment it "just works" without separate installs is the key aha moment.
Engagement: "I'm building with this" Alex starts running models as part of their local dev loop, testing prompts, iterating on system instructions, and integrating responses into their app. They use Docker Compose to wire up the model alongside their other services. They start treating models like any other dependency.
Expansion: "My team should use this too" Alex shares the workflow with their team. The platform engineer sees the value of OCI-based model distribution for standardizing model versions across environments. The team starts pulling models from Docker Hub as part of their CI pipeline, and potentially publishes their own fine-tuned model as an OCI artifact.

Gordon
User Persona
"Sam, the Pragmatic Developer Who Googles Too Much"
Role: Software engineer who uses Docker Desktop daily, working across containerized apps, Dockerfiles, Compose setups, and CI pipelines.
Experience level: Competent with Docker but not an expert. Knows enough to get things running but frequently hits walls: cryptic build errors, containers that fail to start, forget about specific run parameters. Not enough time or knowledge to optimize the images.
Goals: Wants to unblock themselves quickly without leaving their current workflow to search docs, Google things, Stack Overflow, or paste errors into ChatGPT. Also wants to get better at Docker over time without having to read the entire manual.
Frustrations: Context switching is expensive. When something breaks, opening a browser, searching, reading a doc, and translating the advice back to their specific situation takes too long. Generic AI chatbots give plausible but subtly wrong Docker answers because they lack context about the actual environment.
Customer Journey
Awareness: "Something broke and I need help" Sam's container fails to start. They decide to explore the new feature of Gordon in Docker Desktop right next to the container actions. Or a colleague mentions they just asked Gordon to optimize their Dockerfile. The entry point is frictionless because Gordon is integrated in the product desktop or CLI, not as a separate product to go find. It’s just in front of him.
Consideration: "Is this actually useful or just another chatbot?" Sam's skepticism is high because they've been burned by generic AI answers that hallucinate Docker flags or suggest outdated syntax. They notice Gordon is integrated directly into Desktop and the CLI, and has access to their actual environment: running containers, logs, local files, Docker Scout findings. That context-awareness is the differentiator.
Activation: "Let me try it on this error" Sam opens the "Ask Gordon" panel on a failed container and asks what went wrong. Gordon reads the logs, identifies the issue, and suggests a fix with an explanation. Sam doesn't have to copy-paste anything into another tool, the agent offer him a solution and runs the commands for him. One answer, one solution. Just some permissions during the execution. The answer is specific to their container, not a generic response. That first successful interaction is the aha moment.
Engagement: "I use this daily now" Sam starts asking Gordon proactively: "Rate my Dockerfile," "How do I run MongoDB?", "What does this Scout policy violation mean and how do I fix it?" They use it both in the Desktop UI and the CLI depending on where they're working. Gordon becomes the first stop instead of the browser. No more copy pasting, when I have a problem the tool is there next to me for help.
Expansion: "The team should have this" The team lead notices Sam is shipping cleaner Dockerfiles and debugging faster. They enable Gordon for the team. As Docker AI Governance gets adopted, the platform engineer configures what Gordon can access and execute on behalf of developers, making it safe to roll out broadly with appropriate controls.
Agentic Platform
User Persona
"Maya, the Developer Who Wants to Scale Herself"

Role: Senior software engineer or tech lead at a product company, working on a codebase with a backlog that always grows faster than the team can ship. She manages multiple repositories and regularly reviews PRs, handles open issues, writes tests, and keeps docs up to date, all while also writing new features.
Experience level: Medium technical. Comfortable with GitHub, cron jobs, Docker, and AI coding tools. She has used GitHub Copilot and possibly Claude Code or ChatGPT inside VSCode for, but finds that those tools require too much babysitting to handle end-to-end work, and she doesn't trust enough in the AI agents to run them in YOLO mode.
Goals: Wants to offload repetitive, well-defined coding work to autonomous agents (fixing issues, reviewing PRs, updating docs) without losing visibility or control. She wants agents to behave like specialists on her team, not general-purpose chat tools. She also cares about cost and data control, so she wants to bring her own API keys rather than pay through a black box.
Frustrations: Existing AI tools are great at suggestions but require her to stay in the loop for every step. She has no way to run agents on a schedule or tie them directly to her GitHub workflow, in a simple way. Of course she can deploy a complex infra just for this, but the value is still blurry and the effort is high, managing multiple tools (AI chat, CI, GitHub, Slack) separately creates friction.




Customer Journey
	
Awareness: "I need agents that actually do the work, not just suggest it" Maya hears about the platform through Docker's blog, a colleague, or a conference talk. The tagline ("Build, run, and share AI agent sessions in secure cloud sandboxes") resonates because it promises something different from chat-based AI: agents that take action on a real codebas, in a secure way, and surface results as pull requests, interacting with my tools and it just works out-of-the-box.
Sign-in and first impression Maya signs in with her Docker ID, which she already has. No new account to create. The onboarding immediately orients her around the core model: a project ties together a repository, a team of agents, and a session history. The framing is familiar enough that she doesn't need to learn a new paradigm.
Onboarding: Project setup She names her first project, connects her GitHub repo (with clearly scoped permissions: read, create PRs, read issues). The onboarding ends by offering two immediate next actions: start a session now, or set up a recurring schedule.
First session: "Let me see what it can do" Maya describes a task in plain language ("Fix the failing tests in src/parser.rs and open a PR"). She picks the orchestrator agent (which routes the work to the right specialist) or selects an implementer directly. She sees the agent run in a secure cloud sandbox and produce a PR. The moment she reviews that PR and finds it credible is the aha moment.
Deeper engagement: Customizing agents Maya realizes the default agents are close but not quite what she needs. She creates a custom reviewer agent with specific instructions for her Go codebase, enables the GitHub capability, and connects Slack so the agent can post updates. She uses the BYOK (bring your own key) flow to connect her Anthropic API key, keeping billing and usage under her control.
Automation: Scheduling recurring runs Maya sets up a daily schedule that runs the reviewer agent on any open PRs every morning at 9am. She sets up a weekly documentalist run to keep the CHANGELOG in sync. The platform becomes part of her team's routine, not a tool she has to remember to use. Also, the agents act on her behalf providing valuable comments and suggestions.
Team expansion: Sharing the platform The engineering manager realizes the productivity boost and the session history and artifact. Amazed decides to roll it out to the broader team. Each engineer connects their own projects and agents. The platform shifts from "Maya's personal productivity tool" to "the team's autonomous dev layer."
Retention: Agents as teammates The platform is no longer a novelty. It's how the team handles PR reviews, issue triaging, test writing, and doc maintenance. Maya monitors sessions the way she would monitor CI: she checks in when something fails or needs her approval, and mostly trusts the agents to handle the rest.



Billing
Subscribe to docker pro / team / business
Subscribe to Gordon and DHI now
Enabling/disabling PAYG
Managing costs and usage
Updating quantities

Pro / Gordon is just individual devs
Team / Business / DHI could be like an engineering manager for a smaller team or a procurement person / it admin for larger teams
Cost/usage management might be a finance team or budget owner

DHI / Hardened Catalog - Sam, Patrick, Kevin. This is a wider net too
DHI / Mirroring - Kevin, Patrick, maybe Sam
DHI / Customizations - Kevin, Patrick, maybe Sam

MCP in Docker Desktop (Toolkit) Primary persona: Developer setting up AI tooling for their workflow Journey: Browses the catalog → selects servers → adds to a new or existing profile → completes OAuth or config where required → connects an AI client (Claude Desktop, Cursor, etc.) from the Clients tab → Gateway routes requests to the right server → optionally exports or shares the profile with their team





Admin Settings Management Primary persona: IT Admin / Platform Engineer at a Business org Journey: Receives a policy requirement (e.g. restrict registry access) → finds the setting in Admin Console → configures and deploys → verifies enforcement via Compliance Reporting → monitors adoption / resolve compliance issues.





Compose GUI (Compose File Viewer + Compose Bridge) Primary persona: Developer moving from local Compose development toward Kubernetes Journey: Runs a multi-container app locally with docker compose up → opens Docker Desktop to inspect the running stack via the Compose File Viewer (read-only view of config sections, service logs, lifecycle controls) → decides to test a Kubernetes deployment → navigates to "View configurations" → selects "Convert and Deploy to Kubernetes" via Compose Bridge → Compose Bridge generates Kubernetes manifests (Deployments, Services, ConfigMaps, Network Policies) → deploys to the local DD Kubernetes cluster → validates pods and service behavior



Build UI in Docker Desktop
Backend and DevOps Engineers
A user is trying to build a new image and it keeps failing. They visit the Build UI, understand what happened with the build, and can troubleshoot solutions.
A user is focused on improving CI build times, with the Build UI they can compare different builds to understand performance impacts to make informed decisions.


Docker Build Cloud
DevOps Engineer
A user who is trying to speed up product execution by lowering CI pipeline completion times by radically accelerating builds with a shared cache.
A user wants to understand build performance across a time period, user group, or organization to make informed decisions.
A user wants to debug a complex CI pipeline containing many builds can access metadata and troubleshooting analytics across their entire CI pipeline to understand issues more directly.


Docker Offload
Engineer (local usage) and DevOps (cloud management)
An engineer with an outdated hardware setup can offload their entire docker-related workload and server management to a cloud instance.
A devops engineer can enable a team of remote-works on secure VDI instances without hindering development timing and local build testing through the seamless offload local/cloud experience.
An agentic developer can select a GPU-focused cloud engine to run all their AI workload regardless of local GPU support.


Docker Sandboxes (SBX)
Engineers, DevOps, and Admin (though the latter my focus is on the local outcome of the AI governance)
A developer can easily isolate a coding agent to safely run YOLO-mode to accomplish a task without risking their local file system or the agent making rougue network calls.
A devops manager can use sandbox --cloud to enable similar agentic isolation and governance across local, ci, and public views.
An administrator of an organization can decide and roll out a variety of levels of agentic controls and guardrails that either force or enable their development team to use agents safely, securely, and predictably.
An engineer can run multiple threads on the same working directory without worry of local file conflicts by enabling sandboxes with --branch to maintain their isolation while at the same time sharing the same codebase.

Insides sales enablement and organization provisioning. For Procurement (Paola) and IT admin personas (Alex)
Organization onboarding and management for IT admins
Authentication management and automating provisioning for IT admins
License management for IT admins
Managing network and filesystem policies for AI tools for IT Admins and Security Lead (Steph)

I'll add them here, let me know what we intend to use the mapping for? I can add more detail as required:

Docker Desktop / CLI  (App Developer Persona)
Typical work flow - Start work on something, run it in a container to verify behavior matches remote and avoid managing dependencies locally
Set up new service - use templates or AI to pick the right base image, wire up compose, and get to a runnable + verifiable local setup quickly

DHI (Security Engineer)
Audit services across the org, swap in hardened base images, reduce overall vulnerability surface.

Hub (Publisher)
Share software / images for the community to use. Make it easy to pull, setup and run.

SBX / Governance (IT Admin)
I want to secure my team's AI use. I want to be able to monitor what the AI tools are doing, and intercept / block accordingly.