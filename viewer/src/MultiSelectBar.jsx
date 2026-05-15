import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function MultiSelectBar({ selectedIds, session, onDeleteAll, onMergeAll, onClear }) {
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const count = selectedIds.size;

  useEffect(() => {
    if (showMergePicker) inputRef.current?.focus();
  }, [showMergePicker]);

  const options = useMemo(() => {
    const q = query.toLowerCase();
    return Object.entries(session.nodes)
      .filter(([, n]) => {
        if (!n.title) return false;
        return !q || n.title.toLowerCase().includes(q) || n.url?.toLowerCase().includes(q);
      })
      .sort((a, b) => a[1].title.localeCompare(b[1].title))
      .slice(0, 40);
  }, [query, session.nodes]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: '#1a1a2e',
      border: '1px solid #4B7BE5',
      borderRadius: 10,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#aaaacc', fontSize: 13, fontWeight: 600 }}>
        {count} selected
      </span>

      <div style={{ width: 1, height: 20, background: '#333355' }} />

      {/* Merge into picker */}
      {showMergePicker ? (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Merge all into…"
            onKeyDown={(e) => e.key === 'Escape' && setShowMergePicker(false)}
            style={{
              background: '#0d0d1a',
              border: '1px solid #4B7BE5',
              borderRadius: 6,
              color: '#e0e0ff',
              padding: '5px 10px',
              fontSize: 12,
              outline: 'none',
              width: 200,
            }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: '#1a1a2e',
            border: '1px solid #333355',
            borderRadius: 8,
            width: 300,
            maxHeight: 260,
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            {options.map(([id, n]) => (
              <div
                key={id}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #1a1a2e',
                  fontSize: 13,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#252545'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                  const targetTitle = n.title;
                  if (window.confirm(`Merge ${count} nodes into "${targetTitle}"?\n\nAll selected nodes will be deleted. Their children, edges, notes, and flags move to "${targetTitle}".`)) {
                    onMergeAll(id);
                  }
                  setShowMergePicker(false);
                  setQuery('');
                }}
              >
                <div style={{ color: '#e0e0ff', fontWeight: 500 }}>{n.title}</div>
                <div style={{ color: '#555570', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.url}</div>
              </div>
            ))}
            {options.length === 0 && (
              <div style={{ padding: '10px 12px', color: '#555570', fontSize: 12 }}>No matches</div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowMergePicker(true)}
          style={{
            background: '#1e1e36',
            border: '1px solid #444466',
            borderRadius: 6,
            color: '#8888cc',
            fontSize: 12,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          ⇒ Merge all into…
        </button>
      )}

      <button
        onClick={onDeleteAll}
        style={{
          background: '#2a1a1a',
          border: '1px solid #663333',
          borderRadius: 6,
          color: '#cc4444',
          fontSize: 12,
          padding: '5px 12px',
          cursor: 'pointer',
        }}
      >
        ✕ Delete all
      </button>

      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: 'none',
          color: '#555570',
          fontSize: 18,
          cursor: 'pointer',
          lineHeight: 1,
          padding: '0 2px',
        }}
        title="Clear selection"
      >
        ×
      </button>
    </div>
  );
}
