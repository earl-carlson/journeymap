import React from 'react';

export default function DetailPanel({ node, session, onClose }) {
  if (!node) return null;

  const data = node.data;

  // Find edges connected to this node
  const incomingEdges = session.edges.filter((e) => e.to === node.id);
  const outgoingEdges = session.edges.filter((e) => e.from === node.id);

  // Resolve node titles for edge display
  const resolveTitle = (id) => {
    const n = session.nodes[id];
    return n ? n.title : id;
  };

  return (
    <div className="detail-panel">
      <button className="detail-close" onClick={onClose}>
        &times;
      </button>

      <div className="detail-title">{data.title}</div>

      <a
        className="detail-url"
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {data.url}
      </a>

      {/* Type badges */}
      <div style={{ display: 'flex', gap: 6 }}>
        {data.isModal && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 8,
              background: 'rgba(6,182,212,0.15)',
              color: '#06b6d4',
            }}
          >
            Modal
          </span>
        )}
        {data.isStub && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 8,
              background: 'rgba(85,85,112,0.2)',
              color: '#777799',
            }}
          >
            Inferred
          </span>
        )}
        {data.domain && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 8,
              background: 'rgba(99,102,241,0.1)',
              color: '#8888aa',
            }}
          >
            {data.domain}
          </span>
        )}
      </div>

      {/* Flags */}
      {data.flags && data.flags.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-label">Flags</div>
          <div className="detail-flags">
            {data.flags.map((flag) => (
              <span key={flag} className={`detail-flag ${flag}`}>
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes && data.notes.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-label">Notes</div>
          {data.notes.map((note, i) => (
            <div key={i} className="detail-note">
              {note}
            </div>
          ))}
        </div>
      )}

      {/* Incoming edges */}
      {incomingEdges.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-label">
            Incoming ({incomingEdges.length})
          </div>
          <div className="detail-edges">
            {incomingEdges.map((edge, i) => (
              <div key={i} className="detail-edge">
                <span className={`detail-edge-type ${edge.type}`}>
                  {edge.type}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={resolveTitle(edge.from)}
                >
                  {resolveTitle(edge.from)}
                </span>
                {edge.count > 1 && (
                  <span style={{ color: '#6366f1', fontWeight: 600 }}>
                    {edge.count}x
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing edges */}
      {outgoingEdges.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-label">
            Outgoing ({outgoingEdges.length})
          </div>
          <div className="detail-edges">
            {outgoingEdges.map((edge, i) => (
              <div key={i} className="detail-edge">
                <span className={`detail-edge-type ${edge.type}`}>
                  {edge.type}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={resolveTitle(edge.to)}
                >
                  {resolveTitle(edge.to)}
                </span>
                {edge.count > 1 && (
                  <span style={{ color: '#6366f1', fontWeight: 600 }}>
                    {edge.count}x
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw node ID for debugging */}
      <div className="detail-section">
        <div className="detail-section-label">Node ID</div>
        <div
          style={{
            fontSize: 10,
            color: '#555570',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {node.id}
        </div>
      </div>
    </div>
  );
}
