import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function StubNode({ data, selected }) {
  let shortPath = '';
  try {
    const u = new URL(data.url);
    shortPath = u.pathname.replace(/\/+$/, '') || '/';
  } catch {
    shortPath = data.url;
  }

  const hasChildren = (data.directChildCount || 0) > 0;
  const isCollapsed = data.isCollapsed;
  const collapseChildCount = isCollapsed ? (data.hiddenChildren || data.directChildCount || 0) : (data.directChildCount || 0);

  const handleCollapseClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (data.onToggleCollapse) data.onToggleCollapse(data.nodeId);
  };

  return (
    <div
      style={{
        background: data.isDropTarget ? '#1a2a1a' : '#16162a',
        border: `1.5px ${data.isDropTarget ? 'solid #22c55e' : `dashed ${selected ? '#4B7BE5' : '#333355'}`}`,
        borderRadius: 10,
        padding: '6px 12px',
        minWidth: 160,
        maxWidth: 220,
        opacity: data.dimmed ? 0.15 : data.isDropTarget ? 1 : 0.6,
        cursor: 'pointer',
        transition: 'border-color 0.15s, opacity 0.2s, background 0.15s',
        boxShadow: data.isDropTarget ? '0 0 0 3px rgba(34,197,94,0.3)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555570', width: 6, height: 6, border: '2px solid #16162a' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#555570', width: 6, height: 6, border: '2px solid #16162a' }} />

      {/* Stub indicator */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#555570',
          marginBottom: 2,
        }}
      >
        inferred
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#8888aa',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={data.title}
      >
        {data.title}
      </div>

      {/* Path + collapse button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
        <span
          style={{
            fontSize: 10,
            color: '#555570',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {shortPath}
        </span>
        {hasChildren && (
          <button
            onClick={handleCollapseClick}
            title={isCollapsed ? `Expand ${collapseChildCount} children` : 'Collapse children'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: isCollapsed ? 'rgba(85,85,112,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isCollapsed ? 'rgba(119,119,153,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 5,
              padding: '1px 5px',
              cursor: 'pointer',
              color: isCollapsed ? '#777799' : '#555570',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              flexShrink: 0,
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
    </div>
  );
}

export default memo(StubNode);
