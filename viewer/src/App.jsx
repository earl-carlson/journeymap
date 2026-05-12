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
  const fileInputRef = useRef(null);
  const reactFlowRef = useRef(null);
  // Track whether we need to fit view (only on data load, not on drag)
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

  // Fit view only when data changes, not on drag/pan
  useEffect(() => {
    if (shouldFitView.current && reactFlowRef.current && nodes.length > 0) {
      shouldFitView.current = false;
      setTimeout(() => {
        reactFlowRef.current.fitView({ padding: 0.12, duration: 300 });
      }, 50);
    }
  }, [nodes]);

  // -----------------------------------------------------------------------
  // File loading with merge support
  // -----------------------------------------------------------------------

  const loadSessionFile = useCallback(
    async (file) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.nodes || data.edges === undefined) {
          console.error('Invalid session JSON:', file.name);
          return;
        }
        return data;
      } catch (err) {
        console.error('Failed to parse session:', file.name, err);
        return null;
      }
    },
    []
  );

  const handleFiles = useCallback(
    async (files) => {
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
      if (jsonFiles.length === 0) return;

      const sessions = (
        await Promise.all(jsonFiles.map(loadSessionFile))
      ).filter(Boolean);

      if (sessions.length === 0) return;

      // Merge into existing session (or start fresh)
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
      // Reset so the same file can be loaded again
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

  // -----------------------------------------------------------------------
  // React Flow init
  // -----------------------------------------------------------------------

  const onInit = useCallback((instance) => {
    reactFlowRef.current = instance;
  }, []);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

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
        <p>
          Load one or more session JSON files to visualize the information
          architecture graph. Drop multiple files to merge them into a single
          view.
        </p>
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
          <p style={{ fontSize: 24, color: '#555570' }}>&#8693;</p>
          <p>Drop session JSON files here</p>
          <p style={{ color: '#555570' }}>one or many — they'll merge automatically</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
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
          <button
            className="toolbar-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            + Add Session
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
