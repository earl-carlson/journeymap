/**
 * Convert a session.json into React Flow nodes and edges.
 */

// Edge style config by type
const EDGE_STYLES = {
  navigate: {
    stroke: '#354E80',
    strokeWidth: 1.5,
    animated: false,
    opacity: 0.1,
  },
  'child-of': {
    stroke: '#3A3A52',
    strokeWidth: 1,
    strokeDasharray: '6 3',
    animated: false,
    opacity: 0.1,
  },
  'modal-open': {
    stroke: '#0E7A8F',
    strokeWidth: 1.5,
    animated: true,
    opacity: 0.15,
  },
  'modal-step': {
    stroke: '#0E7A8F',
    strokeWidth: 1,
    strokeDasharray: '4 4',
    animated: false,
    opacity: 0.1,
  },
  'modal-dismiss': {
    stroke: '#8F3060',
    strokeWidth: 1,
    strokeDasharray: '3 3',
    animated: false,
    opacity: 0.1,
  },
};

/**
 * Determine the domain cluster for a node URL.
 */
function getDomain(url) {
  try {
    const parsed = new URL(url);
    // desktop:// URLs use the host as the app name (e.g. "docker-desktop")
    return parsed.hostname || parsed.host || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get all descendant node IDs of a given node via inferredParent chains.
 */
function getDescendants(nodeId, session) {
  const descendants = new Set();
  const queue = [nodeId];
  while (queue.length > 0) {
    const parentId = queue.shift();
    for (const [id, node] of Object.entries(session.nodes)) {
      if (node.inferredParent === parentId && !descendants.has(id)) {
        descendants.add(id);
        queue.push(id);
      }
    }
  }
  return descendants;
}

/**
 * Convert session JSON to { nodes, edges } for React Flow.
 *
 * @param {Object} session - The session.json data
 * @param {Object} options
 */
export function sessionToGraph(session, options = {}) {
  const {
    viewMode = 'hierarchy',
    flagFilter = [],
    showStubs = true,
    showModals = false,
    activeWorkflow = null,
    platformFilter = null,
    collapsedDomains = new Set(),
    collapsedNodes = new Set(),
    hiddenDomains = new Set(),
  } = options;

  if (!session || !session.nodes) return { nodes: [], edges: [] };

  // Build the set of node IDs on the active workflow path + step index map
  // Filter out stub nodes — they were never directly visited and add noise
  const workflowPath = activeWorkflow
    ? (activeWorkflow.path || []).filter((id) => {
        const n = session.nodes[id];
        return n && !n.stub;
      })
    : [];
  const workflowPathIds = activeWorkflow ? new Set(workflowPath) : null;
  const workflowStepIndex = new Map(); // nodeId -> 1-based step number
  workflowPath.forEach((id, i) => workflowStepIndex.set(id, i + 1));

  // Pre-compute: which nodes are hidden because a parent is collapsed
  const hiddenByCollapse = new Set();
  for (const collapsedId of collapsedNodes) {
    const descendants = getDescendants(collapsedId, session);
    for (const d of descendants) hiddenByCollapse.add(d);
  }

  // Pre-compute: count of hidden children per collapsed node
  const hiddenChildCounts = new Map();
  for (const collapsedId of collapsedNodes) {
    const descendants = getDescendants(collapsedId, session);
    hiddenChildCounts.set(collapsedId, descendants.size);
  }

  // Pre-compute: direct child count per node (via inferredParent)
  const directChildCounts = new Map();
  for (const node of Object.values(session.nodes)) {
    if (node.inferredParent) {
      directChildCounts.set(node.inferredParent, (directChildCounts.get(node.inferredParent) || 0) + 1);
    }
  }

  // Pre-compute: count of nodes per domain (for collapsed domain badges)
  const domainCounts = new Map();
  for (const [id, node] of Object.entries(session.nodes)) {
    const domain = getDomain(node.url);
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  const rfNodes = [];
  const rfEdges = [];

  // Build nodes
  for (const [id, node] of Object.entries(session.nodes)) {
    const domain = getDomain(node.url);

    // Skip if this domain is fully hidden (filter tray)
    if (hiddenDomains.has(domain)) continue;

    // Skip if this domain is collapsed
    if (collapsedDomains.has(domain)) continue;

    // Skip if hidden by a collapsed parent
    if (hiddenByCollapse.has(id)) continue;

    // Modal filtering
    const isModalNode = node.isModal || id.includes(':modal:');
    if (isModalNode) {
      // Always skip orphaned modals (no parent or parent missing from session)
      const parent = node.inferredParent && session.nodes[node.inferredParent];
      if (!parent) continue;
      // When modals are hidden (default), skip all of them
      if (!showModals) continue;
    }

    // Skip tracking-parameter duplicate roots: nodes with no inferredParent, no children,
    // and a URL containing common tracking params (_gl=, _ga=, utm_)
    if (!node.inferredParent && !(directChildCounts.get(id) > 0)) {
      try {
        const u = new URL(node.url);
        if (u.search && (u.search.includes('_gl=') || u.search.includes('_ga=') || u.search.includes('utm_'))) {
          continue;
        }
      } catch {}
    }

    // Skip stubs if not showing them (unless they're on the active workflow path)
    if (node.stub && !showStubs && !(workflowPathIds && workflowPathIds.has(id))) {
      continue;
    }

    // Platform filtering
    if (platformFilter && platformFilter.length > 0) {
      const nodePlatform = node.platform || 'web';
      if (!platformFilter.includes(nodePlatform)) continue;
    }

    // Flag filtering
    if (flagFilter.length > 0) {
      const hasFlag = node.flags && node.flags.some((f) => flagFilter.includes(f));
      const onWorkflowPath = workflowPathIds && workflowPathIds.has(id);
      if (!hasFlag && !node.stub && !onWorkflowPath) {
        const isFlaggedParent = Object.values(session.nodes).some(
          (n) => n.inferredParent === id && n.flags?.some((f) => flagFilter.includes(f))
        );
        if (!isFlaggedParent) continue;
      }
    }

    const isModal = node.isModal || id.includes(':modal:');
    const dimmed = workflowPathIds ? !workflowPathIds.has(id) : false;
    const hiddenChildren = hiddenChildCounts.get(id) || 0;
    const workflowStep = workflowStepIndex.get(id) || null;

    rfNodes.push({
      id,
      type: isModal ? 'modalNode' : node.stub ? 'stubNode' : 'pageNode',
      position: { x: 0, y: 0 },
      data: {
        ...node,
        nodeId: id,
        domain,
        isModal,
        isStub: !!node.stub,
        platform: node.platform || 'web',
        dimmed,
        workflowStep,
        hiddenChildren,
        isCollapsed: collapsedNodes.has(id),
        directChildCount: directChildCounts.get(id) || 0,
      },
    });
  }

  // Build edge set for visibility
  const visibleNodeIds = new Set(rfNodes.map((n) => n.id));

  // Build workflow path edges set for highlighting
  const workflowEdgeKeys = new Set();
  for (let i = 0; i < workflowPath.length - 1; i++) {
    workflowEdgeKeys.add(`${workflowPath[i]}->${workflowPath[i + 1]}`);
  }

  // Build edges
  for (const edge of session.edges) {
    if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) continue;

    const type = edge.type || 'navigate';
    const style = EDGE_STYLES[type] || EDGE_STYLES.navigate;

    const onWorkflowPath = workflowEdgeKeys.has(`${edge.from}->${edge.to}`);
    const dimmedEdge = workflowPathIds ? !onWorkflowPath : false;

    rfEdges.push({
      id: `${edge.from}-${edge.to}-${type}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: onWorkflowPath ? true : style.animated,
      style: {
        stroke: onWorkflowPath ? '#1A7A3A' : style.stroke,
        strokeWidth: onWorkflowPath ? 3 : style.strokeWidth,
        strokeDasharray: onWorkflowPath ? undefined : style.strokeDasharray,
        opacity: dimmedEdge ? 0.05 : style.opacity,
      },
      data: {
        type,
        count: edge.count,
        navClass: edge.navClass,
        onWorkflowPath,
      },
      label: type === 'navigate' && edge.count > 1 ? `${edge.count}x` : undefined,
      labelStyle: { fill: '#777799', fontSize: 10 },
      labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.8 },
    });
  }

  // Add sequential workflow step edges (numbered arrows on top of existing edges)
  if (activeWorkflow && workflowPath.length > 0) {
    for (let i = 0; i < workflowPath.length - 1; i++) {
      const from = workflowPath[i];
      const to   = workflowPath[i + 1];
      if (!visibleNodeIds.has(from) || !visibleNodeIds.has(to)) continue;
      if (from === to) continue;
      rfEdges.push({
        id: `wf-step-${i}-${from}-${to}`,
        source: from,
        target: to,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: '#22c55e',
          strokeWidth: 2.5,
          opacity: 1,
        },
        label: `${i + 1} → ${i + 2}`,
        labelStyle: { fill: '#22c55e', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#0d1a0d', fillOpacity: 0.9, borderRadius: 4 },
        zIndex: 10,
        data: { isWorkflowStep: true },
        markerEnd: {
          type: 'arrowclosed',
          color: '#22c55e',
          width: 16,
          height: 16,
        },
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges, domainCounts };
}

/**
 * Get summary stats for a session.
 */
export function getSessionStats(session) {
  if (!session || !session.nodes) {
    return { nodes: 0, edges: 0, stubs: 0, modals: 0, domains: 0, workflows: 0, platforms: [] };
  }

  const nodes = Object.values(session.nodes);
  const pageNodes = nodes.filter((n) => !n.stub && !n.isModal);
  const stubs = nodes.filter((n) => n.stub);
  const modals = nodes.filter((n) => n.isModal);
  const domains = new Set(nodes.map((n) => getDomain(n.url)));
  const platforms = [...new Set(nodes.map((n) => n.platform || 'web'))];

  return {
    nodes: pageNodes.length,
    edges: session.edges.filter((e) => e.type === 'navigate').length,
    stubs: stubs.length,
    modals: modals.length,
    domains: domains.size,
    workflows: (session.workflows || []).length,
    platforms,
  };
}
