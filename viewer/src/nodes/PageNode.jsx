import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const FLAG_COLORS = {
  broken: '#ef4444',
  confusing: '#f97316',
  missing: '#eab308',
  good: '#22c55e',
};

const DOMAIN_COLORS = {
  'www.docker.com': '#4B7BE5',
  'hub.docker.com': '#6B8FD9',
  'app.docker.com': '#2A9AAF',
  'docs.docker.com': '#3BA55D',
  'admin.docker.com': '#D4782A',
  'scout.docker.com': '#C4508A',
  'build.docker.com': '#C4A028',
};

function PageNode({ data, selected }) {
  const domainColor = DOMAIN_COLORS[data.domain] || '#4B7BE5';
  const hasFlags = data.flags && data.flags.length > 0;
  const flagColor = hasFlags ? FLAG_COLORS[data.flags[0]] : null;

  const isCollapsed = data.isCollapsed;
  const hasChildren = (data.directChildCount || 0) > 0;
  const collapseChildCount = isCollapsed ? (data.hiddenChildren || data.directChildCount || 0) : (data.directChildCount || 0);

  // Extract short path from URL
  let shortPath = '';
  try {
    const u = new URL(data.url);
    shortPath = u.pathname.replace(/\/+$/, '') || '/';
  } catch {
    shortPath = data.url;
  }

  const handleCollapseClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (data.onToggleCollapse) data.onToggleCollapse(data.nodeId);
  };

  const showBottom = hasFlags || hasChildren;

  return (
    <div
      style={{
        background: data.isDropTarget ? '#1a2a1a' : selected ? '#2a2a4a' : '#1e1e36',
        border: `2px solid ${data.isDropTarget ? '#22c55e' : selected ? '#4B7BE5' : flagColor || domainColor}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 200,
        maxWidth: 260,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, opacity 0.2s, background 0.15s',
        boxShadow: data.isDropTarget
          ? '0 0 0 3px rgba(34,197,94,0.3)'
          : selected
          ? '0 0 0 2px rgba(75,123,229,0.25)'
          : hasFlags
          ? `0 0 0 1px ${flagColor}33`
          : 'none',
        opacity: data.dimmed ? 0.2 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: domainColor, width: 8, height: 8, border: '2px solid #1e1e36' }} />
      <Handle type="source" position={Position.Right} style={{ background: domainColor, width: 8, height: 8, border: '2px solid #1e1e36' }} />

      {/* Domain badge */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: domainColor,
          marginBottom: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: domainColor,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        {data.domain}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#e0e0f0',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={data.title}
      >
        {data.title}
      </div>

      {/* Path */}
      <div
        style={{
          fontSize: 10,
          color: '#777799',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={shortPath}
      >
        {shortPath}
      </div>

      {/* Flags + collapse button + depth badge */}
      {showBottom && (
        <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center' }}>
          {hasFlags && data.flags.map((flag) => (
            <span
              key={flag}
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '1px 5px',
                borderRadius: 6,
                background: `${FLAG_COLORS[flag]}22`,
                color: FLAG_COLORS[flag],
              }}
            >
              {flag}
            </span>
          ))}
          {hasChildren && (
            <button
              onClick={handleCollapseClick}
              title={isCollapsed ? `Expand ${collapseChildCount} children` : 'Collapse children'}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: isCollapsed ? 'rgba(75,123,229,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isCollapsed ? 'rgba(75,123,229,0.35)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 5,
                padding: '1px 5px',
                cursor: 'pointer',
                color: isCollapsed ? '#6B93EA' : '#666688',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {isCollapsed ? (
                <>
                  <span style={{ fontSize: 11, lineHeight: 1 }}>+</span>
                  <span>{collapseChildCount}</span>
                </>
              ) : (
                <span style={{ fontSize: 11, lineHeight: 1 }}>−</span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(PageNode);
