import React, { useState, useRef, useEffect, useMemo } from 'react';

const FLAG_OPTIONS = ['broken', 'confusing', 'missing', 'good'];

// ---------------------------------------------------------------------------
// ParentPicker — searchable dropdown of all nodes
// ---------------------------------------------------------------------------
function ParentPicker({ nodeId, currentParentId, session, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const options = useMemo(() => {
    const q = query.toLowerCase();
    return Object.entries(session.nodes)
      .filter(([id, n]) => {
        if (id === nodeId) return false;           // can't parent to self
        if (id === currentParentId) return false;  // already the parent
        if (!n.title) return false;
        return !q || n.title.toLowerCase().includes(q) || n.url?.toLowerCase().includes(q);
      })
      .sort((a, b) => a[1].title.localeCompare(b[1].title))
      .slice(0, 40);
  }, [query, session.nodes, nodeId, currentParentId]);

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 60,
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #333355',
        borderRadius: 10,
        width: 360,
        maxHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #333355' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            style={{
              width: '100%',
              background: '#0d0d1a',
              border: '1px solid #333355',
              borderRadius: 6,
              color: '#e0e0ff',
              padding: '6px 10px',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* None option — make root */}
          <div
            style={{
              padding: '8px 14px',
              cursor: 'pointer',
              color: '#888899',
              fontSize: 12,
              borderBottom: '1px solid #222240',
            }}
            onClick={() => { onSelect(null); onClose(); }}
          >
            (no parent — make root)
          </div>
          {options.map(([id, n]) => (
            <div
              key={id}
              style={{
                padding: '8px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid #1a1a2e',
                fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#252545'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onSelect(id); onClose(); }}
            >
              <div style={{ color: '#e0e0ff', fontWeight: 500 }}>{n.title}</div>
              <div style={{ color: '#555570', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.url}</div>
            </div>
          ))}
          {options.length === 0 && (
            <div style={{ padding: '12px 14px', color: '#555570', fontSize: 12 }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------
export default function DetailPanel({
  node, session, editMode,
  onClose, onRename, onDelete, onChangeParent, onAddNote, onToggleFlag,
}) {
  if (!node) return null;

  const [noteText, setNoteText] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showParentPicker, setShowParentPicker] = useState(false);
  const titleInputRef = useRef(null);

  const data = node.data;

  // Sync title draft when node changes
  useEffect(() => {
    setEditingTitle(false);
    setTitleDraft(data.title || '');
  }, [node.id]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  // Find edges connected to this node
  const incomingEdges = session.edges.filter((e) => e.to === node.id);
  const outgoingEdges = session.edges.filter((e) => e.from === node.id);

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

  const commitRename = () => {
    const t = titleDraft.trim();
    if (t && t !== data.title) onRename?.(node.id, t);
    setEditingTitle(false);
  };

  const parentNode = data.inferredParent ? session.nodes[data.inferredParent] : null;

  return (
    <div className="detail-panel" style={{ position: 'relative' }}>
      {showParentPicker && (
        <ParentPicker
          nodeId={node.id}
          currentParentId={data.inferredParent}
          session={session}
          onSelect={(newParentId) => onChangeParent?.(node.id, newParentId)}
          onClose={() => setShowParentPicker(false)}
        />
      )}

      <button className="detail-close" onClick={onClose}>&times;</button>

      {/* Title — editable in edit mode */}
      {editMode && editingTitle ? (
        <input
          ref={titleInputRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditingTitle(false);
          }}
          style={{
            width: '100%',
            background: '#0d0d1a',
            border: '1px solid #4B7BE5',
            borderRadius: 6,
            color: '#e0e0ff',
            fontSize: 15,
            fontWeight: 600,
            padding: '6px 8px',
            marginBottom: 6,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div
          className="detail-title"
          style={editMode ? { cursor: 'text', borderBottom: '1px dashed #333355' } : {}}
          onClick={() => {
            if (editMode) {
              setTitleDraft(data.title || '');
              setEditingTitle(true);
            }
          }}
          title={editMode ? 'Click to rename' : undefined}
        >
          {data.title}
          {editMode && <span style={{ fontSize: 11, color: '#555570', marginLeft: 6 }}>✎</span>}
        </div>
      )}

      <a className="detail-url" href={data.url} target="_blank" rel="noopener noreferrer">
        {data.url}
      </a>

      {/* Edit mode controls */}
      {editMode && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowParentPicker(true)}
            style={{
              flex: 1,
              background: '#1e1e36',
              border: '1px solid #333355',
              borderRadius: 6,
              color: '#aaaacc',
              fontSize: 12,
              padding: '5px 10px',
              cursor: 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title="Change parent"
          >
            ↖ {parentNode ? parentNode.title : '(no parent)'}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${data.title}"? Its children will be re-parented.`)) {
                onDelete?.(node.id);
              }
            }}
            style={{
              background: '#2a1a1a',
              border: '1px solid #663333',
              borderRadius: 6,
              color: '#cc4444',
              fontSize: 12,
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            ✕ Delete
          </button>
        </div>
      )}

      {/* Screenshot */}
      {(data.screenshotDataUrl || data.screenshot) && (
        <div className="detail-section">
          <div className="detail-section-label">Screenshot</div>
          <img
            src={data.screenshotDataUrl || data.screenshot}
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
                const src = data.screenshotDataUrl || data.screenshot;
                w.document.write(`<img src="${src}" style="max-width:100%">`);
                w.document.title = data.title;
              }
            }}
          />
        </div>
      )}

      {/* Type badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.isModal && <span className="detail-badge cyan">Modal</span>}
        {data.isStub && <span className="detail-badge dim">Inferred</span>}
        {data.domain && <span className="detail-badge domain">{data.domain}</span>}
        {data.platform && data.platform !== 'web' && (
          <span className="detail-badge platform">{data.platform}</span>
        )}
      </div>

      {/* Flags */}
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
          <div className="detail-section-label">Incoming ({incomingEdges.length})</div>
          <div className="detail-edges">
            {incomingEdges.map((edge, i) => (
              <div key={i} className="detail-edge">
                <span className={`detail-edge-type ${edge.type}`}>{edge.type}</span>
                <span className="detail-edge-title" title={resolveTitle(edge.from)}>
                  {resolveTitle(edge.from)}
                </span>
                {edge.count > 1 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{edge.count}x</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing edges */}
      {outgoingEdges.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-label">Outgoing ({outgoingEdges.length})</div>
          <div className="detail-edges">
            {outgoingEdges.map((edge, i) => (
              <div key={i} className="detail-edge">
                <span className={`detail-edge-type ${edge.type}`}>{edge.type}</span>
                <span className="detail-edge-title" title={resolveTitle(edge.to)}>
                  {resolveTitle(edge.to)}
                </span>
                {edge.count > 1 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{edge.count}x</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node ID */}
      <div className="detail-section">
        <div className="detail-section-label">Node ID</div>
        <div style={{ fontSize: 10, color: '#555570', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {node.id}
        </div>
      </div>
    </div>
  );
}
