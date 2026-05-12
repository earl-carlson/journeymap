import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import DetailPanel from './DetailPanel';
import { sessionToGraph, getSessionStats } from './sessionToGraph';
import { layoutGraph } from './layout';
import { mergeSessions } from './merge';

const nodeTypes = {
  pageNode: PageNode,
  stubNode: StubNode,
  modalNode: ModalNode,
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
          // Load screenshots from screenshots/ subfolder
          try {
            const screenshotDir = await entry.getDirectoryHandle('screenshots');
            for (const [nodeId, node] of Object.entries(data.nodes)) {
              if (node.screenshot) {
                try {
                  // Extract filename from path like "screenshots/abc123.png"
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
  const [stats, setStats] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [dirHandle, setDirHandle] = useState(null);
  const [dirName, setDirName] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const reactFlowRef = useRef(null);
  const shouldFitView = useRef(false);

  // -----------------------------------------------------------------------
  // Build graph from session data
  // -----------------------------------------------------------------------

  const buildGraph = useCallback(
    (sessionData, mode, flags, stubs) => {
      const { nodes: rfNodes, edges: rfEdges } = sessionToGraph(sessionData, {
        viewMode: mode,
        flagFilter: flags,
        showStubs: stubs,
      });

      const positioned = layoutGraph(rfNodes, rfEdges, mode);
      setNodes(positioned);
      setEdges(rfEdges);
      setStats(getSessionStats(sessionData));
      shouldFitView.current = true;
    },
    [setNodes, setEdges]
  );

  // Rebuild when view mode or filters change
  useEffect(() => {
    if (session) {
      buildGraph(session, viewMode, flagFilter, showStubs);
    }
  }, [session, viewMode, flagFilter, showStubs, buildGraph]);

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
  // Directory-based loading
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
        setSession(merged);
        setSessionCount(sessions.length);
        setSelectedNode(null);
      } catch (err) {
        console.error('Failed to scan directory:', err);
      }
      setLoading(false);
    },
    []
  );

  const pickDirectory = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
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

    // Verify permission
    try {
      const perm = await dirHandle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') {
        const req = await dirHandle.requestPermission({ mode: 'read' });
        if (req !== 'granted') return;
      }
    } catch {
      return;
    }

    await loadFromDirectory(dirHandle);
  }, [dirHandle, loadFromDirectory]);

  // Try to restore saved directory handle on mount
  useEffect(() => {
    (async () => {
      const handle = await loadDirHandle();
      if (handle) {
        setDirHandle(handle);
        setDirName(handle.name);
        // Don't auto-load — need user gesture to verify permission
      }
    })();
  }, []);

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
  // Node selection
  // -----------------------------------------------------------------------

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // -----------------------------------------------------------------------
  // Filter toggles
  // -----------------------------------------------------------------------

  const toggleFlag = useCallback((flag) => {
    setFlagFilter((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
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
  }, [setNodes, setEdges]);

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  if (!session) {
    return (
      <div
        className="empty-state"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <h2>IA Mapper Viewer</h2>
        {loading ? (
          <p>Loading sessions...</p>
        ) : (
          <>
            <p>
              Choose your exports folder to auto-load all sessions, or drop
              individual JSON files.
            </p>

            {/* Directory picker — primary action */}
            <button
              className="toolbar-btn"
              style={{
                padding: '12px 24px',
                fontSize: 14,
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onClick={pickDirectory}
            >
              {dirName ? `Open ${dirName}` : 'Choose Exports Folder'}
            </button>

            {/* If we have a saved handle, offer to reconnect */}
            {dirHandle && (
              <button
                className="toolbar-btn"
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  marginTop: 4,
                }}
                onClick={refreshDirectory}
              >
                Reload from {dirName}
              </button>
            )}

            {/* Drop zone fallback */}
            <div
              className="drop-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('dragover');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('dragover');
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove('dragover');
                handleDrop(e);
              }}
            >
              <p style={{ fontSize: 20, color: '#555570' }}>&#8693;</p>
              <p>or drop JSON files here</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
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
      <div className="graph-container">
        {/* Toolbar */}
        <div className="toolbar">
          <span className="toolbar-title">IA Mapper</span>
          <div className="view-toggle">
            <button
              className={viewMode === 'hierarchy' ? 'active' : ''}
              onClick={() => setViewMode('hierarchy')}
            >
              Hierarchy
            </button>
            <button
              className={viewMode === 'navigation' ? 'active' : ''}
              onClick={() => setViewMode('navigation')}
            >
              Navigation
            </button>
            <button
              className={viewMode === 'all' ? 'active' : ''}
              onClick={() => setViewMode('all')}
            >
              All
            </button>
          </div>
          <button
            className={`toolbar-btn ${showStubs ? 'active' : ''}`}
            onClick={() => setShowStubs(!showStubs)}
          >
            {showStubs ? 'Hide' : 'Show'} Stubs
          </button>
          {dirHandle && (
            <button className="toolbar-btn" onClick={refreshDirectory}>
              Refresh
            </button>
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

        {/* Flag filters */}
        <div className="filter-bar">
          {['broken', 'confusing', 'missing', 'good'].map((flag) => (
            <button
              key={flag}
              className={`filter-btn ${flag} ${
                flagFilter.includes(flag) ? 'active' : ''
              }`}
              onClick={() => toggleFlag(flag)}
            >
              {flag}
            </button>
          ))}
        </div>

        {/* Graph */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={onInit}
          nodeTypes={nodeTypes}
          minZoom={0.05}
          maxZoom={2}
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
              if (node.data?.isModal) return '#06b6d4';
              if (node.data?.isStub) return '#333355';
              return '#6366f1';
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
            {dirName && (
              <div style={{ color: '#555570' }}>
                {dirName}/
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && session && (
        <DetailPanel
          node={selectedNode}
          session={session}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
