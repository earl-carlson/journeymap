import React, { memo } from 'react';

const DOMAIN_LABELS = {
  'www.docker.com': 'www',
  'app.docker.com': 'app',
  'hub.docker.com': 'hub',
  'docs.docker.com': 'docs',
  'admin.docker.com': 'admin',
  'scout.docker.com': 'scout',
  'build.docker.com': 'build',
  'testcontainers.com': 'testcontainers',
  'dockerstatus.com': 'status',
};

const DOMAIN_COLORS = {
  'www.docker.com': '#4B7BE5',
  'hub.docker.com': '#6B8FD9',
  'app.docker.com': '#2A9AAF',
  'docs.docker.com': '#3BA55D',
  'admin.docker.com': '#D4782A',
  'scout.docker.com': '#C4508A',
  'build.docker.com': '#C4A028',
  'testcontainers.com': '#5B8C5A',
  'dockerstatus.com': '#7A7A9A',
};

function DomainGroup({ data }) {
  const color = DOMAIN_COLORS[data.domain] || '#4B7BE5';
  const label = DOMAIN_LABELS[data.domain] || data.domain;

  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        background: `${color}06`,
        border: `1px solid ${color}20`,
        borderRadius: 16,
        position: 'relative',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: 16,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: `${color}90`,
          background: '#0f0f1a',
          padding: '2px 8px',
          borderRadius: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default memo(DomainGroup);
