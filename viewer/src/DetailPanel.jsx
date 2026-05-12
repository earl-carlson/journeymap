import React, { useState } from 'react';

const FLAG_OPTIONS = ['broken', 'confusing', 'missing', 'good'];

export default function DetailPanel({ node, session, onClose, onAddNote, onToggleFlag }) {
  if (!node) return null;

  const [noteText, setNoteText] = useState('');

  const data = node.data;

  // Find edges connected to this node
  const incomingEdges = session.edges.filter((e) => e.to === node.id);
  const outgoingEdges = session.edges.filter((e) => e.from === node.id);

  // Resolve node titles for edge display
  const resolveTitle = (id) => {
    const n = session.nodes[id];
    return n ? n.title : id;
  };

  const handleSubmitNote = () => {
    const text = noteText.trim();
    if (!text || !onAddNote) return;
    onAddNote(node.id, text);
    setNoteText('');
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

      {/* Screenshot */}
      {data.screenshotDataUrl && (
        <div className="detail-section">
          <div className="detail-section-label">Screenshot</div>
          <img
            src={data.screenshotDataUrl}
            alt={`Screenshot of ${data.title}`}
            style={{
              width: '100%',
              borderRadius: 6,
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            onClick={() => {
              const w = window.open();
              if (w) {
                w.document.write(`<img src="${data.screenshotDataUrl}" style="max-width:100%">`);
                w.document.title = data.title;
              }
            }}
          />
        </div>
      )}

      {/* Type badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.isModal && (
          <span className="detail-badge cyan">Modal</span>
        )}
        {data.isStub && (
          <span className="detail-badge dim">Inferred</span>
        )}
        {data.domain && (
          <span className="detail-badge domain">{data.domain}</span>
        )}
        {data.platform && data.platform !== 'web' && (
          <span className="detail-badge platform">{data.platform}</span>
        )}
      </div>

      {/* Flags — clickable toggles */}
      <div className="detail-section">
        <div className="detail-section-label">Flags</div>
        <div className="detail-flags">
          {FLAG_OPTIONS.map((flag) => {
            const active = data.flags && data.flags.includes(flag);
            return (
              <button
                key={flag}
                className={`detail-flag-btn ${flag} ${active ? 'active' : ''}`}
                onClick={() => onToggleFlag && onToggleFlag(node.id, flag)}
              >
                {flag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="detail-section">
        <div className="detail-section-label">
          Notes{data.notes && data.notes.length > 0 ? ` (${data.notes.length})` : ''}
        </div>
        {data.notes && data.notes.length > 0 && (
          <div className="detail-notes-list">
            {data.notes.map((note, i) => {
              const text = typeof note === 'string' ? note : note?.text || '';
              const contributor = typeof note === 'object' ? note?.contributor : null;
              return (
                <div key={i} className="detail-note">
                  {text}
                  {contributor && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                      — {contributor}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Add note input */}
        <div className="detail-note-input">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitNote();
              }
            }}
          />
          <button
            className="detail-note-submit"
            onClick={handleSubmitNote}
            disabled={!noteText.trim()}
          >
            Add
          </button>
        </div>
      </div>

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
                <span className="detail-edge-title" title={resolveTitle(edge.from)}>
                  {resolveTitle(edge.from)}
                </span>
                {edge.count > 1 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
                <span className="detail-edge-title" title={resolveTitle(edge.to)}>
                  {resolveTitle(edge.to)}
                </span>
                {edge.count > 1 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
