import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function ModalNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#1a2a3a' : '#141e2e',
        border: `2px solid ${selected ? '#06b6d4' : '#0e4f5c'}`,
        borderRadius: 8,
        padding: '6px 10px',
        minWidth: 160,
        maxWidth: 200,
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 2px rgba(6,182,212,0.2)' : 'none',
        opacity: data.dimmed ? 0.2 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s, opacity 0.2s',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#06b6d4', width: 7, height: 7, border: '2px solid #141e2e' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#06b6d4', width: 7, height: 7, border: '2px solid #141e2e' }} />

      {/* Modal indicator */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#06b6d4',
          marginBottom: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 11 }}>&#9671;</span>
        modal
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#b0d0e0',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={data.title}
      >
        {data.title}
      </div>
    </div>
  );
}

export default memo(ModalNode);
