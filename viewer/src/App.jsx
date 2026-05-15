import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PageNode from './nodes/PageNode';
import StubNode from './nodes/StubNode';
import ModalNode from './nodes/ModalNode';
import DomainGroup from './nodes/DomainGroup';
import DetailPanel from './DetailPanel';
import WorkflowPanel from './WorkflowPanel';
import { sessionToGraph, getSessionStats } from './sessionToGraph';
import { layoutGraph } from './layout';
import { mergeSessions } from './merge';

const nodeTypes = {
  pageNode: PageNode,
  stubNode: StubNode,
  modalNode: ModalNode,
  domainGroup: DomainGroup,
};

// ---------------------------------------------------------------------------
// IndexedDB for persisting the directory handle
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ia_mapper_viewer', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'exportDir');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('exportDir');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scan a directory recursively for session.json files + screenshots
// ---------------------------------------------------------------------------

async function scanDirectory(dirHandle) {
  const sessions = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory') {
      // Check if this subdirectory contains a session.json
      try {
        const sessionFile = await entry.getFileHandle('session.json');
        const file = await sessionFile.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.nodes && data.edges !== undefined) {
          // Remember the directory handle for write-back
          data._dirHandle = entry;

          // Load screenshots from screenshots/ subfolder
          try {
            const screenshotDir = await entry.getDirectoryHandle('screenshots');
            for (const [nodeId, node] of Object.entries(data.nodes)) {
              if (node.screenshot) {
                try {
                  const filename = node.screenshot.split('/').pop();
                  const imgFile = await screenshotDir.getFileHandle(filename);
                  const imgBlob = await (await imgFile.getFile());
                  const dataUrl = await blobToDataUrl(imgBlob);
                  node.screenshotDataUrl = dataUrl;
                } catch {
                  // Screenshot file not found, skip
                }
              }
            }
          } catch {
            // No screenshots directory, that's fine
          }

          sessions.push(data);
        }
      } catch {
        // No session.json in this directory, recurse deeper
        const nested = await scanDirectory(entry);
        sessions.push(...nested);
      }
    } else if (entry.kind === 'file' && entry.name.endsWith('.json')) {
      // Also handle loose JSON files at the top level (legacy format)
      try {
        const file = await entry.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && data.edges !== undefined) {
          sessions.push(data);
        }
      } catch {
        // Not a valid session JSON
      }
    }
  }

  return sessions;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// Write-back: save session.json to the directory
// ---------------------------------------------------------------------------

/**
 * Write viewer-originated changes to a dedicated session-viewer/ directory.
 * This keeps original capture sessions untouched — viewer contributions
 * (workflows, notes, flags) live in their own mergeable session file.
 */
async function writeBackSession(dirHandle, session) {
  if (!dirHandle) return false;

  try {
    const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const req = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (req !== 'granted') return false;
    }

    // Prepare clean data (strip screenshotDataUrl and internal fields)
    const clean = structuredClone(session);
    delete clean._dirHandle;
    for (const node of Object.values(clean.nodes)) {
      delete node.screenshotDataUrl;
    }

    // Always write to session-viewer/ — a stable, dedicated directory
    const viewerDir = await dirHandle.getDirectoryHandle('session-viewer', { create: true });
    const file = await viewerDir.getFileHandle('session.json', { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(clean, null, 2));
    await writable.close();
    console.log('[viewer] Wrote session.json to session-viewer/');
    return true;
  } catch (err) {
    console.error('[viewer] Write-back failed:', err);
    return false;
  }
}

// ===========================================================================
// App
// ===========================================================================

export default function App() {
  const [session, setSession] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('hierarchy');
  const [flagFilter, setFlagFilter] = useState([]);
  const [showStubs, setShowStubs] = useState(true);
  const [showModals, setShowModals] = useState(false);
  const [stats, setStats] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [dirHandle, setDirHandle] = useState(null);
  const [dirName, setDirName] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const reactFlowRef = useRef(null);
  const shouldFitView = useRef(false);
  const anchorPositions = useRef(null); // snapshot of node positions before a collapse/expand

  // Filter tray
  const [showFilterTray, setShowFilterTray] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const undoStack = useRef([]); // array of session snapshots (most recent last)
  const [dragOverNodeId, setDragOverNodeId] = useState(null); // node being hovered during drag-to-reparent
  const [unsavedChanges, setUnsavedChanges] = useState(0);

  // Workflow state
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [definingWorkflow, setDefiningWorkflow] = useState(false);
  const [defineSteps, setDefineSteps] = useState([]);

  // Platform filter
   const [platformFilter, setPlatformFilter] = useState(null);
  const [domainList, setDomainList] = useState([]); // ordered list of domains in current session

  // Collapse state
  const [collapsedDomains, setCollapsedDomains] = useState(new Set());
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const workflows = useMemo(
    () => (session?.workflows || []),
    [session]
  );

  // -----------------------------------------------------------------------
  // Build graph from session data
  // -----------------------------------------------------------------------

  // Compute the set of all node IDs that have at least one child
  const getAllParentIds = useCallback((sessionData) => {
    const parents = new Set();
    for (const node of Object.values(sessionData.nodes || {})) {
      if (node.inferredParent) parents.add(node.inferredParent);
    }
    return parents;
  }, []);

  // Collapse all nodes that have children, then refit the view
  const collapseAll = useCallback(() => {
    if (session) {
      shouldFitView.current = true;
      setCollapsedNodes(getAllParentIds(session));
    }
  }, [session, getAllParentIds]);

  // Expand all nodes
  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  // Toggle domain collapse
  const toggleDomain = useCallback((domain) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  // Toggle node collapse (subtree)
  const toggleNodeCollapse = useCallback((nodeId) => {
    // Snapshot current positions before the layout rebuilds
    const currentNodes = reactFlowRef.current?.getNodes?.() || [];
    anchorPositions.current = new Map(currentNodes.map((n) => [n.id, { ...n.position }]));
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const buildGraph = useCallback(
    (sessionData, mode, flags, stubs, modals, workflow, platFilter, collapsed, collapsedN) => {
      const { nodes: rfNodes, edges: rfEdges, domainCounts } = sessionToGraph(sessionData, {
        viewMode: mode,
        flagFilter: flags,
        showStubs: stubs,
        showModals: modals,
        activeWorkflow: workflow,
        platformFilter: platFilter,
        collapsedDomains: collapsed,
        collapsedNodes: collapsedN,
      });

      // Keep domain list in sync (all domains, regardless of collapsed state)
      const allDomains = sessionToGraph(sessionData, {
        viewMode: mode,
        flagFilter: [],
        showStubs: stubs,
        showModals: false,
        collapsedDomains: new Set(),
        collapsedNodes: new Set(),
      }).domainCounts;
      setDomainList(
        [...(allDomains?.keys() || [])]
          .filter(Boolean)
          .sort((a, b) => {
            // Sort: docker.com properties first, then others
            const aD = a.replace('www.', '').replace('.docker.com', '');
            const bD = b.replace('www.', '').replace('.docker.com', '');
            return aD.localeCompare(bD);
          })
      );

      const { nodes: positioned, groups } = layoutGraph(rfNodes, rfEdges, mode);

      // Anchor layout: find one node that existed before and shift the ENTIRE
      // layout (all nodes + all groups) uniformly so that node stays in place.
      // This keeps the clicked node stationary while everything else reflows around it.
      const prevPositions = anchorPositions.current;
      anchorPositions.current = null;

      if (prevPositions && prevPositions.size > 0 && !shouldFitView.current) {
        // Find the first node in the new layout that has a known previous position
        const anchor = positioned.find((n) => prevPositions.has(n.id));
        if (anchor) {
          const prev = prevPositions.get(anchor.id);
          const dx = prev.x - anchor.position.x;
          const dy = prev.y - anchor.position.y;

          if (dx !== 0 || dy !== 0) {
            for (const n of positioned) {
              n.position = { x: n.position.x + dx, y: n.position.y + dy };
            }
            for (const g of groups) {
              g.position = { x: g.position.x + dx, y: g.position.y + dy };
            }
          }
        }
      }

      // Inject onToggle callbacks and counts into group data
      const enrichedGroups = groups.map((g) => ({
        ...g,
        data: {
          ...g.data,
          nodeCount: domainCounts?.get(g.data.domain) || 0,
          collapsed: collapsed.has(g.data.domain),
          onToggle: () => toggleDomain(g.data.domain),
        },
      }));

      // Add collapsed domain placeholders (they won't have layout groups)
      for (const domain of collapsed) {
        const count = domainCounts?.get(domain) || 0;
        if (count === 0) continue;
        // Check if this domain already has a group
        if (enrichedGroups.some((g) => g.data.domain === domain)) continue;
        enrichedGroups.push({
          id: `group-${domain}`,
          type: 'domainGroup',
          position: { x: enrichedGroups.length * 220, y: 0 },
          data: {
            domain,
            width: 200,
            height: 48,
            nodeCount: count,
            collapsed: true,
            onToggle: () => toggleDomain(domain),
          },
          selectable: false,
          draggable: false,
          style: { zIndex: -1 },
        });
      }

      // Inject collapse callback into node data
      const nodesWithCallbacks = positioned.map((n) => ({
        ...n,
        data: { ...n.data, onToggleCollapse: toggleNodeCollapse },
      }));

      setNodes([...enrichedGroups, ...nodesWithCallbacks]);
      setEdges(rfEdges);
      setStats(getSessionStats(sessionData));
    },
    [setNodes, setEdges, toggleDomain]
  );

  // Rebuild when any filter/state changes
  useEffect(() => {
    if (session) {
      buildGraph(session, viewMode, flagFilter, showStubs, showModals, activeWorkflow, platformFilter, collapsedDomains, collapsedNodes);
    }
  }, [session, viewMode, flagFilter, showStubs, showModals, activeWorkflow, platformFilter, collapsedDomains, collapsedNodes, buildGraph]);

  // Inject dropTarget flag into node data during drag-to-reparent
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isDropTarget: n.id === dragOverNodeId },
      }))
    );
  }, [dragOverNodeId, setNodes]);

  // Fit view when session loads
  useEffect(() => {
    if (session) {
      shouldFitView.current = true;
    }
  }, [session]);

  // Fit view only when data changes
  useEffect(() => {
    if (shouldFitView.current && reactFlowRef.current && nodes.length > 0) {
      shouldFitView.current = false;
      setTimeout(() => {
        reactFlowRef.current.fitView({ padding: 0.12, duration: 300 });
      }, 50);
    }
  }, [nodes]);

  // -----------------------------------------------------------------------
  // Session mutation helper (updates state + writes back to disk)
  // -----------------------------------------------------------------------

  const mutateSession = useCallback(
    (mutator, { undoable = false } = {}) => {
      setSession((prev) => {
        if (!prev) return prev;
        // Push snapshot to undo stack if this is an undoable edit
        if (undoable) {
          undoStack.current = [...undoStack.current, structuredClone(prev)].slice(-50);
          setUnsavedChanges((c) => c + 1);
        }
        const next = structuredClone(prev);
        mutator(next);
        // Write back asynchronously
        if (dirHandle) {
          writeBackSession(dirHandle, next).catch(() => {});
        }
        return next;
      });
    },
    [dirHandle]
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    setUnsavedChanges((c) => Math.max(0, c - 1));
    setSession(prev);
    if (dirHandle) {
      writeBackSession(dirHandle, prev).catch(() => {});
    }
  }, [dirHandle]);

  const saveNow = useCallback(async () => {
    if (!dirHandle || !session) return;
    try {
      await writeBackSession(dirHandle, session);
      setUnsavedChanges(0);
    } catch (err) {
      console.error('[save] Failed:', err);
    }
  }, [dirHandle, session]);

  // -----------------------------------------------------------------------
  // Directory-based loading (read-write)
  // -----------------------------------------------------------------------

  const loadFromDirectory = useCallback(
    async (handle) => {
      setLoading(true);
      try {
        const sessions = await scanDirectory(handle);
        if (sessions.length === 0) {
          setLoading(false);
          return;
        }

        const merged = mergeSessions(null, ...sessions);
        setCollapsedNodes(getAllParentIds(merged));
        setSession(merged);
        setSessionCount(sessions.length);
        setSelectedNode(null);
        setActiveWorkflow(null);
      } catch (err) {
        console.error('Failed to scan directory:', err);
      }
      setLoading(false);
    },
    [getAllParentIds]
  );

  const pickDirectory = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setDirHandle(handle);
      setDirName(handle.name);
      await saveDirHandle(handle);
      await loadFromDirectory(handle);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Directory picker error:', err);
      }
    }
  }, [loadFromDirectory]);

  const refreshDirectory = useCallback(async () => {
    if (!dirHandle) return;

    try {
      const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') return;
      }
    } catch {
      return;
    }

    await loadFromDirectory(dirHandle);
  }, [dirHandle, loadFromDirectory]);

  // Auto-load bundled sessions (GitHub Pages build)
  useEffect(() => {
    const bundled = window.__BUNDLED_SESSIONS__;
    if (bundled && bundled.length > 0) {
      setLoading(true);
      try {
        const merged = mergeSessions(null, ...bundled);
        setCollapsedNodes(getAllParentIds(merged));
        setSession(merged);
        setSessionCount(bundled.length);
        setSelectedNode(null);
      } catch (err) {
        console.error('[bundled] Failed to load bundled sessions:', err);
      }
      setLoading(false);
      return; // skip IndexedDB restore — not needed in Pages mode
    }

    // Try to restore saved directory handle on mount (local mode)
    (async () => {
      const handle = await loadDirHandle();
      if (handle) {
        setDirHandle(handle);
        setDirName(handle.name);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // File loading (drag-and-drop / file picker fallback)
  // -----------------------------------------------------------------------

  const loadSessionFile = useCallback(async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.nodes || data.edges === undefined) return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  const handleFiles = useCallback(
    async (files) => {
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
      if (jsonFiles.length === 0) return;

      const sessions = (
        await Promise.all(jsonFiles.map(loadSessionFile))
      ).filter(Boolean);

      if (sessions.length === 0) return;

      const merged = mergeSessions(session, ...sessions);
      setCollapsedNodes(getAllParentIds(merged));
      setSession(merged);
      setSessionCount((c) => c + sessions.length);
      setSelectedNode(null);
    },
    [session, loadSessionFile]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e) => {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    },
    [handleFiles]
  );

  // -----------------------------------------------------------------------
  // Node selection + workflow define click
  // -----------------------------------------------------------------------

  const onNodeClick = useCallback(
    (event, node) => {
      // Ignore clicks on domain group nodes
      if (node.type === 'domainGroup') return;

      if (definingWorkflow) {
        const n = session?.nodes[node.id];
        if (n) {
          setDefineSteps((prev) => [
            ...prev,
            { id: node.id, title: n.title, url: n.url },
          ]);
        }
        return;
      }

      // Auto expand/collapse if the node has children
      if (node.data?.directChildCount > 0) {
        toggleNodeCollapse(node.id);
      }

      setSelectedNode(node);
    },
    [definingWorkflow, session, toggleNodeCollapse]
  );

  const onPaneClick = useCallback(() => {
    if (!definingWorkflow) {
      setSelectedNode(null);
    }
  }, [definingWorkflow]);

  // -----------------------------------------------------------------------
  // Filter toggles
  // -----------------------------------------------------------------------

  const toggleFlag = useCallback((flag) => {
    setFlagFilter((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  }, []);

  const togglePlatform = useCallback((platform) => {
    setPlatformFilter((prev) => {
      if (!prev) return [platform];
      if (prev.includes(platform)) {
        const next = prev.filter((p) => p !== platform);
        return next.length === 0 ? null : next;
      }
      return [...prev, platform];
    });
  }, []);

  const onInit = useCallback((instance) => {
    reactFlowRef.current = instance;
  }, []);

  const handleReset = useCallback(() => {
    setSession(null);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setStats(null);
    setSessionCount(0);
    setActiveWorkflow(null);
    setShowWorkflows(false);
    setDefiningWorkflow(false);
    setDefineSteps([]);
    setPlatformFilter(null);
    setCollapsedDomains(new Set());
    setCollapsedNodes(new Set());
  }, [setNodes, setEdges]);

  // -----------------------------------------------------------------------
  // Edit actions
  // -----------------------------------------------------------------------

  const renameNode = useCallback((nodeId, newTitle) => {
    mutateSession((s) => {
      if (s.nodes[nodeId]) s.nodes[nodeId].title = newTitle;
    }, { undoable: true });
    // Keep selectedNode data in sync
    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return { ...prev, data: { ...prev.data, title: newTitle } };
    });
  }, [mutateSession]);

  const deleteNode = useCallback((nodeId) => {
    mutateSession((s) => {
      const node = s.nodes[nodeId];
      if (!node) return;
      const parentId = node.inferredParent || null;
      // Re-parent all direct children to this node's parent
      for (const [id, n] of Object.entries(s.nodes)) {
        if (n.inferredParent === nodeId) {
          n.inferredParent = parentId;
        }
      }
      // Remove all edges touching this node
      s.edges = s.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
      // Remove the node
      delete s.nodes[nodeId];
    }, { undoable: true });
    setSelectedNode(null);
  }, [mutateSession]);

  const changeParent = useCallback((nodeId, newParentId) => {
    mutateSession((s) => {
      const node = s.nodes[nodeId];
      if (!node) return;
      const oldParentId = node.inferredParent;
      // Update inferredParent
      node.inferredParent = newParentId || null;
      // Remove old child-of edge
      s.edges = s.edges.filter(
        (e) => !(e.from === oldParentId && e.to === nodeId && e.type === 'child-of')
      );
      // Add new child-of edge
      if (newParentId) {
        const exists = s.edges.some(
          (e) => e.from === newParentId && e.to === nodeId && e.type === 'child-of'
        );
        if (!exists) {
          s.edges.push({ from: newParentId, to: nodeId, type: 'child-of', count: 1 });
        }
      }
    }, { undoable: true });
  }, [mutateSession]);

  // Keyboard shortcut: Cmd+Z to undo in edit mode
  React.useEffect(() => {
    if (!editMode) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, undo]);

  // -----------------------------------------------------------------------
  // Drag-to-reparent handlers (edit mode only)
  // -----------------------------------------------------------------------

  const onNodeDrag = useCallback((_event, draggedNode) => {
    if (!editMode) return;
    const rf = reactFlowRef.current;
    if (!rf) return;

    // Find which node the dragged node's center is overlapping
    const allNodes = rf.getNodes();
    const dx = draggedNode.position.x + (draggedNode.measured?.width ?? 220) / 2;
    const dy = draggedNode.position.y + (draggedNode.measured?.height ?? 60) / 2;

    const hit = allNodes.find((n) => {
      if (n.id === draggedNode.id) return false;
      if (n.type === 'domainGroup') return false;
      const w = n.measured?.width ?? 220;
      const h = n.measured?.height ?? 60;
      return dx >= n.position.x && dx <= n.position.x + w &&
             dy >= n.position.y && dy <= n.position.y + h;
    });

    setDragOverNodeId(hit ? hit.id : null);
  }, [editMode]);

  const onNodeDragStop = useCallback((_event, draggedNode) => {
    if (!editMode) return;
    if (dragOverNodeId && dragOverNodeId !== draggedNode.id) {
      changeParent(draggedNode.id, dragOverNodeId);
    }
    setDragOverNodeId(null);
  }, [editMode, dragOverNodeId, changeParent]);

  // -----------------------------------------------------------------------
  // Workflow actions
  // -----------------------------------------------------------------------

  const handleSelectWorkflow = useCallback((wf) => {
    setActiveWorkflow(wf);
    setSelectedNode(null);
  }, []);

  const handleDeselectWorkflow = useCallback(() => {
    setActiveWorkflow(null);
  }, []);

  const handleStartDefine = useCallback(() => {
    setDefiningWorkflow(true);
    setDefineSteps([]);
    setActiveWorkflow(null);
    setSelectedNode(null);
  }, []);

  const handleCancelDefine = useCallback(() => {
    setDefiningWorkflow(false);
    setDefineSteps([]);
  }, []);

  const handleSaveDefine = useCallback(
    (name, persona, notes) => {
      if (!name || defineSteps.length < 2) return;

      // Separate custom steps from graph node steps
      const customSteps = {};
      for (const step of defineSteps) {
        if (step.custom) {
          customSteps[step.id] = {
            title: step.title,
            notes: step.notes || null,
            screenshotDataUrl: step.screenshotDataUrl || null,
          };
        }
      }

      const workflow = {
        name,
        path: defineSteps.map((s) => s.id),
        contributor: 'viewer',
        ...(persona ? { persona } : {}),
        ...(notes ? { notes } : {}),
        ...(Object.keys(customSteps).length > 0 ? { customSteps } : {}),
      };

      mutateSession((s) => {
        if (!s.workflows) s.workflows = [];
        // Replace if same name exists
        const idx = s.workflows.findIndex((w) => w.name === name);
        if (idx >= 0) {
          s.workflows[idx] = workflow;
        } else {
          s.workflows.push(workflow);
        }
      });

      setDefiningWorkflow(false);
      setDefineSteps([]);
      setActiveWorkflow(workflow);
    },
    [defineSteps, mutateSession]
  );

  const handleAddDefineStep = useCallback(
    (nodeIdOrStep) => {
      // Accept either a node ID string or a custom step object
      if (typeof nodeIdOrStep === 'object' && nodeIdOrStep.custom) {
        setDefineSteps((prev) => [...prev, nodeIdOrStep]);
        return;
      }
      const nodeId = nodeIdOrStep;
      const n = session?.nodes[nodeId];
      if (n) {
        setDefineSteps((prev) => [
          ...prev,
          { id: nodeId, title: n.title, url: n.url },
        ]);
      }
    },
    [session]
  );

  const handleRemoveDefineStep = useCallback((index) => {
    setDefineSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteWorkflow = useCallback(
    (name) => {
      mutateSession((s) => {
        s.workflows = (s.workflows || []).filter((w) => w.name !== name);
      });
      setActiveWorkflow(null);
    },
    [mutateSession]
  );

  const handleAddStub = useCallback(
    (fromId, toId) => {
      // Create a stub node between two workflow steps
      const fromNode = session?.nodes[fromId];
      const toNode = session?.nodes[toId];
      if (!fromNode || !toNode) return;

      // Infer a URL midpoint (use the toNode's parent path)
      try {
        const toUrl = new URL(toNode.url);
        const segments = toUrl.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        if (segments.length > 1) {
          segments.pop();
          toUrl.pathname = '/' + segments.join('/');
          const stubUrl = toUrl.toString().replace(/\/+$/, '');

          // Simple hash for the stub
          let hash = 5381;
          for (let i = 0; i < stubUrl.length; i++) {
            hash = ((hash << 5) + hash + stubUrl.charCodeAt(i)) >>> 0;
          }
          const stubId = hash.toString(16).padStart(8, '0');

          mutateSession((s) => {
            if (!s.nodes[stubId]) {
              const lastSeg = segments[segments.length - 1] || 'page';
              s.nodes[stubId] = {
                url: stubUrl,
                title: lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1).replace(/-/g, ' ') + ' (' + toUrl.hostname + ')',
                screenshot: null,
                notes: [],
                flags: [],
                stub: true,
                inferredParent: null,
                platform: fromNode.platform || 'web',
              };
            }
            // Add child-of edge
            s.edges.push({ from: stubId, to: toId, type: 'child-of', count: 1 });
          });
        }
      } catch {
        // URL parsing failed, skip
      }
    },
    [session, mutateSession]
  );

  const handleExportCaptureQueue = useCallback(() => {
    if (!activeWorkflow || !session) return;

    const queue = (activeWorkflow.path || [])
      .map((id) => {
        const n = session.nodes[id];
        if (!n || !n.stub) return null;
        return { url: n.url, title: n.title, nodeId: id };
      })
      .filter(Boolean);

    const blob = new Blob([JSON.stringify({ captureQueue: queue }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capture-queue-${activeWorkflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeWorkflow, session]);

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  if (!session) {
    return (
      <div className="empty-state">
        <h2>IA Mapper</h2>
        {loading ? (
          <p>Loading sessions...</p>
        ) : dirHandle ? (
          <>
            <button
              className="empty-state-btn"
              onClick={refreshDirectory}
            >
              Load from {dirName}
            </button>
            <button
              className="toolbar-btn"
              style={{ padding: '8px 16px', fontSize: 12, marginTop: 8 }}
              onClick={pickDirectory}
            >
              Change folder
            </button>
          </>
        ) : (
          <>
            <p>
              Open the <code>exports</code> folder from the repo to load all captured sessions.
            </p>
            <button
              className="empty-state-btn"
              onClick={pickDirectory}
            >
              Open Exports Folder
            </button>
          </>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Graph view
  // -----------------------------------------------------------------------

  return (
    <div className="app-container" onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Workflow panel (left sidebar) */}
      {showWorkflows && (
        <WorkflowPanel
          session={session}
          workflows={workflows}
          activeWorkflow={activeWorkflow}
          onSelectWorkflow={handleSelectWorkflow}
          onDeselectWorkflow={handleDeselectWorkflow}
          onCreateWorkflow={handleAddDefineStep}
          onDeleteWorkflow={handleDeleteWorkflow}
          onAddStub={handleAddStub}
          onExportCaptureQueue={handleExportCaptureQueue}
          definingWorkflow={definingWorkflow}
          onStartDefine={handleStartDefine}
          onCancelDefine={handleCancelDefine}
          onSaveDefine={handleSaveDefine}
          defineSteps={defineSteps}
          onRemoveDefineStep={handleRemoveDefineStep}
          onClose={() => {
            setShowWorkflows(false);
            setDefiningWorkflow(false);
            setDefineSteps([]);
          }}
        />
      )}

      <div className="graph-container">
        {/* Toolbar */}
        <div className="toolbar">
          <span className="toolbar-title">IA Mapper</span>

          {/* View / filter tray toggle */}
          <button
            className={`toolbar-btn ${showFilterTray ? 'active' : ''}`}
            onClick={() => setShowFilterTray((v) => !v)}
          >
            ⚙ View
          </button>

          <button
            className={`toolbar-btn ${showWorkflows ? 'active' : ''}`}
            onClick={() => setShowWorkflows(!showWorkflows)}
          >
            Workflows{workflows.length > 0 ? ` (${workflows.length})` : ''}
          </button>

          {dirHandle && (
            <>
              <button className="toolbar-btn" onClick={refreshDirectory}>
                Refresh
              </button>
              <button
                className={`toolbar-btn ${editMode ? 'active' : ''}`}
                onClick={() => setEditMode((m) => !m)}
                style={editMode ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}
              >
                {editMode ? '✎ Editing' : '✎ Edit'}
              </button>
              {editMode && undoStack.current.length > 0 && (
                <button className="toolbar-btn" onClick={undo} title="Undo (⌘Z)">
                  ↩ Undo
                </button>
              )}
              {unsavedChanges > 0 && (
                <button
                  className="toolbar-btn"
                  onClick={saveNow}
                  style={{ borderColor: '#22c55e', color: '#22c55e' }}
                  title="Save changes to disk"
                >
                  ↓ Save{unsavedChanges > 1 ? ` (${unsavedChanges})` : ''}
                </button>
              )}
            </>
          )}

          <button
            className="toolbar-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            + Add Files
          </button>
          <button className="toolbar-btn" onClick={handleReset}>
            Reset
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {/* Filter tray */}
        {showFilterTray && (
          <div className="filter-tray">
            {/* Collapse / expand */}
            <div className="filter-tray-section">
              <button className="tray-btn" onClick={collapseAll}>Collapse All</button>
              <button className="tray-btn" onClick={expandAll}>Expand All</button>
            </div>

            <div className="filter-tray-divider" />

            {/* Toggles */}
            <div className="filter-tray-section">
              <button
                className={`tray-btn ${showStubs ? 'active' : ''}`}
                onClick={() => setShowStubs((v) => !v)}
              >
                {showStubs ? 'Hide' : 'Show'} Stubs
              </button>
              <button
                className={`tray-btn ${showModals ? 'active' : ''}`}
                onClick={() => setShowModals((v) => !v)}
              >
                {showModals ? 'Hide' : 'Show'} Modals
              </button>
            </div>

            {/* Domain pills */}
            {domainList.length > 0 && (
              <>
                <div className="filter-tray-divider" />
                <div className="filter-tray-section filter-tray-domains">
                  {domainList.map((domain) => {
                    const hidden = collapsedDomains.has(domain);
                    const label = domain
                      .replace(/\.docker\.com$/, '')
                      .replace(/^www$/, 'www');
                    return (
                      <button
                        key={domain}
                        className={`tray-pill ${hidden ? '' : 'active'}`}
                        onClick={() => toggleDomain(domain)}
                        title={domain}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Define mode banner */}
        {definingWorkflow && (
          <div className="define-banner">
            Click nodes to add steps to your workflow
          </div>
        )}

        {/* Active workflow banner */}
        {activeWorkflow && !definingWorkflow && (
          <div className="workflow-banner">
            Viewing: <strong>{activeWorkflow.name}</strong>
            <button onClick={handleDeselectWorkflow}>Clear</button>
          </div>
        )}

        {/* Graph */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={onInit}
          onNodeDrag={editMode ? onNodeDrag : undefined}
          onNodeDragStop={editMode ? onNodeDragStop : undefined}
          nodesDraggable={true}
          nodeTypes={nodeTypes}
          minZoom={0.05}
          maxZoom={2}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#2a2a44"
          />
          <Controls position="bottom-left" style={{ marginBottom: 48 }} />
          <MiniMap
            position="bottom-right"
            style={{ marginBottom: 48 }}
            nodeColor={(node) => {
              if (node.data?.dimmed) return '#222230';
              if (node.data?.isModal) return '#06b6d4';
              if (node.data?.isStub) return '#333355';
              return '#4B7BE5';
            }}
            maskColor="rgba(15, 15, 26, 0.8)"
          />
        </ReactFlow>

        {/* Legend */}
        <div className="legend">
          <div className="legend-item">
            <div className="legend-line navigate" />
            <span>Navigate</span>
          </div>
          <div className="legend-item">
            <div className="legend-line child-of" />
            <span>Hierarchy</span>
          </div>
          <div className="legend-item">
            <div className="legend-line modal-open" />
            <span>Modal</span>
          </div>
          <div className="legend-item">
            <div className="legend-line modal-dismiss" />
            <span>Dismiss</span>
          </div>
          {activeWorkflow && (
            <div className="legend-item">
              <div className="legend-line workflow-path" />
              <span>Workflow</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-bar">
            {sessionCount > 1 && (
              <div>
                <span>{sessionCount}</span> sessions
              </div>
            )}
            <div>
              <span>{stats.nodes}</span> pages
            </div>
            <div>
              <span>{stats.edges}</span> nav edges
            </div>
            <div>
              <span>{stats.stubs}</span> inferred
            </div>
            {stats.modals > 0 && (
              <div>
                <span>{stats.modals}</span> modals
              </div>
            )}
            <div>
              <span>{stats.domains}</span> domains
            </div>
            {stats.workflows > 0 && (
              <div>
                <span>{stats.workflows}</span> workflows
              </div>
            )}
            {dirName && (
              <div style={{ color: '#555570' }}>
                {dirName}/
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && session && !definingWorkflow && (
        <DetailPanel
          node={selectedNode}
          session={session}
          editMode={editMode}
          onClose={() => setSelectedNode(null)}
          onRename={renameNode}
          onDelete={deleteNode}
          onChangeParent={changeParent}
          onAddNote={(nodeId, text) => {
            mutateSession((s) => {
              if (s.nodes[nodeId]) {
                if (!s.nodes[nodeId].notes) s.nodes[nodeId].notes = [];
                s.nodes[nodeId].notes.push({
                  text,
                  contributor: 'viewer',
                  timestamp: new Date().toISOString(),
                });
              }
            });
          }}
          onToggleFlag={(nodeId, flag) => {
            mutateSession((s) => {
              if (s.nodes[nodeId]) {
                if (!s.nodes[nodeId].flags) s.nodes[nodeId].flags = [];
                const flags = s.nodes[nodeId].flags;
                const idx = flags.indexOf(flag);
                if (idx >= 0) {
                  flags.splice(idx, 1);
                } else {
                  flags.push(flag);
                }
              }
            });
          }}
        />
      )}
    </div>
  );
}
