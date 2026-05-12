/**
 * Convert a session.json into React Flow nodes and edges.
 */

// Edge style config by type
const EDGE_STYLES = {
  navigate: {
    stroke: '#6366f1',
    strokeWidth: 2,
    animated: false,
  },
  'child-of': {
    stroke: '#555570',
    strokeWidth: 1.5,
    strokeDasharray: '6 3',
    animated: false,
  },
  'modal-open': {
    stroke: '#06b6d4',
    strokeWidth: 2,
    animated: true,
  },
  'modal-step': {
    stroke: '#06b6d4',
    strokeWidth: 1.5,
    strokeDasharray: '4 4',
    animated: false,
  },
  'modal-dismiss': {
    stroke: '#ec4899',
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
 * @param {Object} options - { viewMode, flagFilter, showStubs }
 */
export function sessionToGraph(session, options = {}) {
  const {
    viewMode = 'hierarchy',
    flagFilter = [],
    showStubs = true,
  } = options;

  if (!session || !session.nodes) return { nodes: [], edges: [] };

  const rfNodes = [];
  const rfEdges = [];

  // Build nodes
  for (const [id, node] of Object.entries(session.nodes)) {
    // Skip stubs if not showing them
    if (node.stub && !showStubs) continue;

    // Flag filtering: if filters active, only show nodes that have at least one matching flag
    // (but always show nodes connected to flagged nodes)
    if (flagFilter.length > 0) {
      const hasFlag = node.flags && node.flags.some((f) => flagFilter.includes(f));
      if (!hasFlag && !node.stub) {
        // Check if this node is a parent of a flagged node
        const isFlaggedParent = Object.values(session.nodes).some(
          (n) => n.inferredParent === id && n.flags?.some((f) => flagFilter.includes(f))
        );
        if (!isFlaggedParent) continue;
      }
    }

    const domain = getDomain(node.url);
    const isModal = node.isModal || id.includes(':modal:');

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
      },
    });
  }

  // Build edge set for visibility
  const visibleNodeIds = new Set(rfNodes.map((n) => n.id));

  // Build edges
  for (const edge of session.edges) {
    // Only include edges where both endpoints are visible
    if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) continue;

    const type = edge.type || 'navigate';
    const style = EDGE_STYLES[type] || EDGE_STYLES.navigate;

    rfEdges.push({
      id: `${edge.from}-${edge.to}-${type}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: style.animated,
      style: {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDasharray: style.strokeDasharray,
        opacity: style.opacity,
      },
      data: {
        type,
        count: edge.count,
        navClass: edge.navClass,
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
    return { nodes: 0, edges: 0, stubs: 0, modals: 0, domains: 0 };
  }

  const nodes = Object.values(session.nodes);
  const pageNodes = nodes.filter((n) => !n.stub && !n.isModal);
  const stubs = nodes.filter((n) => n.stub);
  const modals = nodes.filter((n) => n.isModal);
  const domains = new Set(nodes.map((n) => getDomain(n.url)));

  return {
    nodes: pageNodes.length,
    edges: session.edges.filter((e) => e.type === 'navigate').length,
    stubs: stubs.length,
    modals: modals.length,
    domains: domains.size,
  };
}
