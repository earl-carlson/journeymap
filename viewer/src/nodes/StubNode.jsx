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

  return (
    <div
      style={{
        background: '#16162a',
        border: `1.5px dashed ${selected ? '#6366f1' : '#333355'}`,
        borderRadius: 10,
        padding: '6px 12px',
        minWidth: 160,
        maxWidth: 220,
        opacity: data.dimmed ? 0.15 : 0.6,
        cursor: 'pointer',
        transition: 'border-color 0.15s, opacity 0.2s',
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

      {/* Path */}
      <div
        style={{
          fontSize: 10,
          color: '#555570',
          marginTop: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {shortPath}
      </div>
    </div>
  );
}

export default memo(StubNode);
