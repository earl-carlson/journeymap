import Dagre from '@dagrejs/dagre';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 64;
const MODAL_WIDTH = 180;
const MODAL_HEIGHT = 50;
const STUB_WIDTH = 180;
const STUB_HEIGHT = 52;

function getNodeDimensions(node) {
  if (node.data?.isModal) return { width: MODAL_WIDTH, height: MODAL_HEIGHT };
  if (node.data?.isStub) return { width: STUB_WIDTH, height: STUB_HEIGHT };
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

/**
 * Layout modes:
 *   'hierarchy' — uses child-of edges, top-down tree per domain cluster
 *   'navigation' — uses navigate edges, left-to-right flow
 *   'all' — uses all edges
 */
export function layoutGraph(rfNodes, rfEdges, mode = 'hierarchy') {
  if (rfNodes.length === 0) return rfNodes;

  if (mode === 'hierarchy') {
    return layoutHierarchy(rfNodes, rfEdges);
  }

  // Navigation and All modes: single Dagre LR graph
  return layoutFlat(rfNodes, rfEdges, mode, 'LR');
}

/**
 * Hierarchy layout: group nodes by domain, layout each domain as a
 * top-down tree, then arrange domain clusters left-to-right.
 */
function layoutHierarchy(rfNodes, rfEdges) {
  // Group nodes by domain
  const domainMap = new Map(); // domain → node[]
  for (const node of rfNodes) {
    const domain = node.data?.domain || 'unknown';
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain).push(node);
  }

  // Get only child-of edges
  const hierarchyEdges = rfEdges.filter((e) => e.data?.type === 'child-of');

  // Layout each domain cluster independently
  const clusterPositions = new Map(); // nodeId → { x, y }
  const clusterSizes = []; // { domain, width, height }

  // Sort domains: prioritize known primary domains
  const DOMAIN_ORDER = [
    'www.docker.com',
    'app.docker.com',
    'hub.docker.com',
    'docs.docker.com',
    'admin.docker.com',
    'scout.docker.com',
    'build.docker.com',
  ];

  const sortedDomains = [...domainMap.keys()].sort((a, b) => {
    const ai = DOMAIN_ORDER.indexOf(a);
    const bi = DOMAIN_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  for (const domain of sortedDomains) {
    const domainNodes = domainMap.get(domain);
    const domainNodeIds = new Set(domainNodes.map((n) => n.id));

    // Filter edges to only those within this domain
    const domainEdges = hierarchyEdges.filter(
      (e) => domainNodeIds.has(e.source) && domainNodeIds.has(e.target)
    );

    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'TB',
      nodesep: 30,
      ranksep: 60,
      edgesep: 15,
      marginx: 30,
      marginy: 30,
    });

    for (const node of domainNodes) {
      const { width, height } = getNodeDimensions(node);
      g.setNode(node.id, { width, height });
    }

    for (const edge of domainEdges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    }

    Dagre.layout(g);

    // Collect positions and compute cluster bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of domainNodes) {
      const pos = g.node(node.id);
      if (pos) {
        const { width, height } = getNodeDimensions(node);
        clusterPositions.set(node.id, { x: pos.x, y: pos.y });
        minX = Math.min(minX, pos.x - width / 2);
        minY = Math.min(minY, pos.y - height / 2);
        maxX = Math.max(maxX, pos.x + width / 2);
        maxY = Math.max(maxY, pos.y + height / 2);
      }
    }

    const clusterWidth = maxX - minX;
    const clusterHeight = maxY - minY;

    // Normalize positions within cluster to start at 0,0
    for (const node of domainNodes) {
      const pos = clusterPositions.get(node.id);
      if (pos) {
        clusterPositions.set(node.id, {
          x: pos.x - minX,
          y: pos.y - minY,
        });
      }
    }

    clusterSizes.push({ domain, width: clusterWidth, height: clusterHeight });
  }

  // Arrange clusters left-to-right with gaps
  const CLUSTER_GAP = 80;
  let xOffset = 0;

  const clusterOffsets = new Map(); // domain → xOffset
  for (const { domain, width } of clusterSizes) {
    clusterOffsets.set(domain, xOffset);
    xOffset += width + CLUSTER_GAP;
  }

  // Apply final positions
  const positioned = rfNodes.map((node) => {
    const domain = node.data?.domain || 'unknown';
    const localPos = clusterPositions.get(node.id);
    const domainOffset = clusterOffsets.get(domain) || 0;

    if (localPos) {
      const { width, height } = getNodeDimensions(node);
      return {
        ...node,
        position: {
          x: localPos.x + domainOffset,
          y: localPos.y,
        },
      };
    }
    return node;
  });

  return positioned;
}

/**
 * Flat layout: single Dagre graph for navigation/all modes.
 */
function layoutFlat(rfNodes, rfEdges, mode, direction) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 100,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  const layoutEdges = rfEdges.filter((e) => {
    if (mode === 'navigation') return e.data?.type === 'navigate';
    return true;
  });

  for (const node of rfNodes) {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  }

  for (const edge of layoutEdges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  Dagre.layout(g);

  return rfNodes.map((node) => {
    const pos = g.node(node.id);
    if (pos) {
      const { width, height } = getNodeDimensions(node);
      return {
        ...node,
        position: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
        },
      };
    }
    return node;
  });
}
