/**
 * Convert a session.json into React Flow nodes and edges.
 */

// Edge style config by type
const EDGE_STYLES = {
  navigate: {
    stroke: '#354E80',
    strokeWidth: 2,
    animated: false,
  },
  'child-of': {
    stroke: '#3A3A52',
    strokeWidth: 1.5,
    strokeDasharray: '6 3',
    animated: false,
  },
  'modal-open': {
    stroke: '#0E7A8F',
    strokeWidth: 2,
    animated: true,
  },
  'modal-step': {
    stroke: '#0E7A8F',
    strokeWidth: 1.5,
    strokeDasharray: '4 4',
    animated: false,
  },
  'modal-dismiss': {
    stroke: '#8F3060',
    strokeWidth: 1,
    strokeDasharray: '3 3',
    animated: false,
    opacity: 0.5,
  },
};

/**
 * Determine the domain cluster for a node URL.
 */
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Convert session JSON to { nodes, edges } for React Flow.
 *
 * @param {Object} session - The session.json data
 * @param {Object} options - { viewMode, flagFilter, showStubs, activeWorkflow, platformFilter }
 */
export function sessionToGraph(session, options = {}) {
  const {
    viewMode = 'hierarchy',
    flagFilter = [],
    showStubs = true,
    activeWorkflow = null,
    platformFilter = null,
  } = options;

  if (!session || !session.nodes) return { nodes: [], edges: [] };

  // Build the set of node IDs on the active workflow path
  const workflowPathIds = activeWorkflow
    ? new Set(activeWorkflow.path || [])
    : null;

  const rfNodes = [];
  const rfEdges = [];

  // Build nodes
  for (const [id, node] of Object.entries(session.nodes)) {
    // Skip stubs if not showing them (unless they're on the active workflow path)
    if (node.stub && !showStubs && !(workflowPathIds && workflowPathIds.has(id))) {
      continue;
    }

    // Platform filtering
    if (platformFilter && platformFilter.length > 0) {
      const nodePlatform = node.platform || 'web';
      if (!platformFilter.includes(nodePlatform)) continue;
    }

    // Flag filtering: if filters active, only show nodes that have at least one matching flag
    // (but always show nodes connected to flagged nodes, and workflow path nodes)
    if (flagFilter.length > 0) {
      const hasFlag = node.flags && node.flags.some((f) => flagFilter.includes(f));
      const onWorkflowPath = workflowPathIds && workflowPathIds.has(id);
      if (!hasFlag && !node.stub && !onWorkflowPath) {
        // Check if this node is a parent of a flagged node
        const isFlaggedParent = Object.values(session.nodes).some(
          (n) => n.inferredParent === id && n.flags?.some((f) => flagFilter.includes(f))
        );
        if (!isFlaggedParent) continue;
      }
    }

    const domain = getDomain(node.url);
    const isModal = node.isModal || id.includes(':modal:');

    // Determine if this node is dimmed (workflow active but node not on path)
    const dimmed = workflowPathIds ? !workflowPathIds.has(id) : false;

    rfNodes.push({
      id,
      type: isModal ? 'modalNode' : node.stub ? 'stubNode' : 'pageNode',
      position: { x: 0, y: 0 }, // Will be set by layout
      data: {
        ...node,
        nodeId: id,
        domain,
        isModal,
        isStub: !!node.stub,
        platform: node.platform || 'web',
        dimmed,
      },
    });
  }

  // Build edge set for visibility
  const visibleNodeIds = new Set(rfNodes.map((n) => n.id));

  // Build workflow path edges set for highlighting
  const workflowEdgeKeys = new Set();
  if (activeWorkflow) {
    const path = activeWorkflow.path || [];
    for (let i = 0; i < path.length - 1; i++) {
      // Mark navigate edges along the workflow path
      workflowEdgeKeys.add(`${path[i]}->${path[i + 1]}`);
    }
  }

  // Build edges
  for (const edge of session.edges) {
    // Only include edges where both endpoints are visible
    if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) continue;

    const type = edge.type || 'navigate';
    const style = EDGE_STYLES[type] || EDGE_STYLES.navigate;

    // Check if this edge is on the workflow path
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
        opacity: dimmedEdge ? 0.15 : style.opacity,
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

  return { nodes: rfNodes, edges: rfEdges };
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
