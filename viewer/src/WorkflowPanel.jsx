import React, { useState, useMemo, useCallback } from 'react';

/**
 * WorkflowPanel — left sidebar for workflow definition, selection, and gap detection.
 *
 * Modes:
 *   - List: shows existing workflows, create button
 *   - Define: building a new workflow by clicking nodes or searching
 *   - View: selected workflow with path, gaps, and actions
 */
export default function WorkflowPanel({
  session,
  workflows,
  activeWorkflow,
  onSelectWorkflow,
  onDeselectWorkflow,
  onCreateWorkflow,
  onDeleteWorkflow,
  onAddStub,
  onExportCaptureQueue,
  definingWorkflow,
  onStartDefine,
  onCancelDefine,
  onSaveDefine,
  defineSteps,
  onRemoveDefineStep,
  onClose,
}) {
  const [newName, setNewName] = useState('');
  const [newPersona, setNewPersona] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [search, setSearch] = useState('');
  const [personaFilter, setPersonaFilter] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customScreenshot, setCustomScreenshot] = useState(null); // data URL

  // -----------------------------------------------------------------------
  // Personas — seed list + any custom ones from existing workflows
  // -----------------------------------------------------------------------

  const DEFAULT_PERSONAS = [
    'Admin',
    'Docker Employee',
    'Purchaser',
    'Developer',
    'VP of Engineering',
  ];

  // All persona options (for autocomplete in Define mode)
  const allPersonas = useMemo(() => {
    const set = new Set(DEFAULT_PERSONAS);
    for (const wf of workflows) {
      if (wf.persona) set.add(wf.persona);
    }
    return [...set];
  }, [workflows]);

  // Only personas actually assigned to workflows (for filter pills)
  const usedPersonas = useMemo(() => {
    const set = new Set();
    for (const wf of workflows) {
      if (wf.persona) set.add(wf.persona);
    }
    return [...set];
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    if (!personaFilter) return workflows;
    return workflows.filter((wf) => wf.persona === personaFilter);
  }, [workflows, personaFilter]);

  // -----------------------------------------------------------------------
  // Search: filter session nodes by title for adding to workflow
  // -----------------------------------------------------------------------

  const searchResults = useMemo(() => {
    if (!search.trim() || !session?.nodes) return [];
    const q = search.toLowerCase();
    const stepIds = new Set((defineSteps || []).map((s) => s.id));
    return Object.entries(session.nodes)
      .filter(([id, n]) => {
        if (stepIds.has(id)) return false;
        if (n.isModal) return false;
        const title = (n.title || '').toLowerCase();
        const url = (n.url || '').toLowerCase();
        return title.includes(q) || url.includes(q);
      })
      .slice(0, 8)
      .map(([id, n]) => ({ id, title: n.title, url: n.url, stub: n.stub }));
  }, [search, session, defineSteps]);

  // -----------------------------------------------------------------------
  // Gap detection for active workflow
  // -----------------------------------------------------------------------

  const gaps = useMemo(() => {
    if (!activeWorkflow || !session) return [];
    const path = activeWorkflow.path || [];
    const detected = [];

    for (let i = 0; i < path.length - 1; i++) {
      const fromId = path[i];
      const toId = path[i + 1];
      const fromNode = session.nodes[fromId];
      const toNode = session.nodes[toId];
      if (!fromNode || !toNode) continue;

      // Check if there's a direct navigate edge between them
      const hasDirectEdge = session.edges.some(
        (e) =>
          e.from === fromId &&
          e.to === toId &&
          (e.type === 'navigate' || e.type === 'child-of')
      );

      if (!hasDirectEdge) {
        // Count hierarchy distance
        const dist = urlHierarchyDistance(fromNode.url, toNode.url);
        const missingCount = dist > 1 ? dist - 1 : 1;
        detected.push({
          fromId,
          toId,
          fromTitle: fromNode.title,
          toTitle: toNode.title,
          missingCount,
          index: i,
        });
      }
    }

    return detected;
  }, [activeWorkflow, session]);

  // Capture queue: all stubs in the active workflow path
  const captureQueue = useMemo(() => {
    if (!activeWorkflow || !session) return [];
    return (activeWorkflow.path || [])
      .map((id) => ({ id, ...(session.nodes[id] || {}) }))
      .filter((n) => n.stub);
  }, [activeWorkflow, session]);

  // -----------------------------------------------------------------------
  // Define mode
  // -----------------------------------------------------------------------

  if (definingWorkflow) {
    return (
      <div className="workflow-panel">
        <div className="workflow-panel-header">
          <span className="workflow-panel-title">Define Workflow</span>
          <button className="wf-close" onClick={onCancelDefine}>
            &times;
          </button>
        </div>

        <div className="wf-field">
          <label>Workflow name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Create new project"
            autoFocus
          />
        </div>

        <div className="wf-field">
          <label>Persona</label>
          <input
            type="text"
            list="persona-options"
            value={newPersona}
            onChange={(e) => setNewPersona(e.target.value)}
            placeholder="e.g. Net new user, Admin, Developer"
          />
          <datalist id="persona-options">
            {allPersonas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div className="wf-field">
          <label>Workflow notes</label>
          <textarea
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Describe this workflow, context, assumptions..."
            rows={2}
            className="wf-textarea"
          />
        </div>

        <div className="wf-section-label">
          Steps ({(defineSteps || []).length})
          <span className="wf-hint">Click nodes on the graph to add steps</span>
        </div>

        {/* Search to add by title */}
        <div className="wf-field">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages to add..."
          />
        </div>

        {search && searchResults.length > 0 && (
          <div className="wf-search-results">
            {searchResults.map((r) => (
              <div
                key={r.id}
                className="wf-search-item"
                onClick={() => {
                  onCreateWorkflow && onCreateWorkflow(r.id);
                  setSearch('');
                }}
              >
                <div className="wf-search-title">
                  {r.stub && <span className="wf-stub-badge">stub</span>}
                  {r.title}
                </div>
                <div className="wf-search-url">{r.url}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add custom step form */}
        {showCustomForm ? (
          <div className="wf-custom-form">
            <div className="wf-section-label">Custom Step</div>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Step title (e.g. Check email for login link)"
              className="wf-custom-input"
              autoFocus
            />
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Notes about this step..."
              rows={2}
              className="wf-textarea"
            />
            <div className="wf-custom-screenshot-row">
              <label className="wf-custom-screenshot-btn">
                {customScreenshot ? 'Change screenshot' : '+ Screenshot'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setCustomScreenshot(reader.result);
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {customScreenshot && (
                <img src={customScreenshot} alt="preview" className="wf-custom-screenshot-preview" />
              )}
            </div>
            <div className="workflow-prompt-actions">
              <button
                className="wf-btn wf-btn-primary"
                disabled={!customTitle.trim()}
                onClick={() => {
                  const id = `custom-${Date.now()}`;
                  onRemoveDefineStep && void 0; // just to keep linter happy
                  // Add custom step via the parent's step list
                  // We pass it up through onCreateWorkflow with a special object
                  const step = {
                    id,
                    title: customTitle.trim(),
                    url: '',
                    custom: true,
                    notes: customNotes.trim() || null,
                    screenshotDataUrl: customScreenshot,
                  };
                  // Directly add to defineSteps via the parent callback
                  if (typeof onCreateWorkflow === 'function') {
                    onCreateWorkflow(step);
                  }
                  setCustomTitle('');
                  setCustomNotes('');
                  setCustomScreenshot(null);
                  setShowCustomForm(false);
                }}
              >
                Add Step
              </button>
              <button
                className="wf-btn wf-btn-secondary"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomTitle('');
                  setCustomNotes('');
                  setCustomScreenshot(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="wf-btn wf-btn-secondary wf-add-custom-btn"
            onClick={() => setShowCustomForm(true)}
          >
            + Add Custom Step
          </button>
        )}

        {/* Step list */}
        <div className="wf-steps">
          {(defineSteps || []).map((step, i) => (
            <div key={`${step.id}-${i}`} className={`wf-step ${step.custom ? 'custom' : ''}`}>
              <span className="wf-step-num">{i + 1}</span>
              <div className="wf-step-info">
                <div className="wf-step-title">
                  {step.custom && <span className="wf-custom-badge">custom</span>}
                  {step.title}
                </div>
                {step.url && <div className="wf-step-url">{step.url}</div>}
                {step.notes && <div className="wf-step-notes">{step.notes}</div>}
              </div>
              <button
                className="wf-step-remove"
                onClick={() => onRemoveDefineStep(i)}
                title="Remove step"
              >
                &times;
              </button>
            </div>
          ))}
          {(defineSteps || []).length === 0 && (
            <div className="wf-empty">
              Click nodes on the graph, search above, or add custom steps.
            </div>
          )}
        </div>

        <div className="wf-actions">
          <button
            className="wf-btn wf-btn-primary"
            disabled={!newName.trim() || (defineSteps || []).length < 2}
            onClick={() => {
              onSaveDefine(
                newName.trim(),
                newPersona.trim() || null,
                newNotes.trim() || null
              );
              setNewName('');
              setNewPersona('');
              setNewNotes('');
              setSearch('');
            }}
          >
            Save Workflow
          </button>
          <button className="wf-btn wf-btn-secondary" onClick={onCancelDefine}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // View mode: active workflow selected
  // -----------------------------------------------------------------------

  if (activeWorkflow) {
    return (
      <div className="workflow-panel">
        <div className="workflow-panel-header">
          <span className="workflow-panel-title">{activeWorkflow.name}</span>
          <button className="wf-close" onClick={onDeselectWorkflow}>
            &times;
          </button>
        </div>

        <div className="wf-meta-row">
          {activeWorkflow.persona && (
            <span className="wf-persona-badge">{activeWorkflow.persona}</span>
          )}
          {activeWorkflow.contributor && (
            <span className="wf-meta">by {activeWorkflow.contributor}</span>
          )}
        </div>

        {/* Workflow-level notes */}
        {activeWorkflow.notes && (
          <div className="wf-workflow-notes">
            {activeWorkflow.notes}
          </div>
        )}

        <div className="wf-section-label">
          Path ({(activeWorkflow.path || []).length} steps)
        </div>

        <div className="wf-steps">
          {(activeWorkflow.path || []).map((stepId, i) => {
            const isCustom = stepId.startsWith('custom-');
            const customData = isCustom ? (activeWorkflow.customSteps || {})[stepId] : null;
            const node = isCustom ? null : session?.nodes[stepId];
            const isGapBefore = gaps.some((g) => g.index === i - 1);
            return (
              <React.Fragment key={`${stepId}-${i}`}>
                {isGapBefore && (
                  <div className="wf-gap">
                    <span className="wf-gap-icon">&#9888;</span>
                    <span>
                      {gaps.find((g) => g.index === i - 1)?.missingCount || '?'}{' '}
                      uncaptured step
                      {(gaps.find((g) => g.index === i - 1)?.missingCount || 0) !== 1
                        ? 's'
                        : ''}
                    </span>
                    <button
                      className="wf-gap-action"
                      onClick={() => {
                        const gap = gaps.find((g) => g.index === i - 1);
                        if (gap) onAddStub(gap.fromId, gap.toId);
                      }}
                      title="Create stub placeholder"
                    >
                      + Stub
                    </button>
                  </div>
                )}
                {isCustom ? (
                  <div className="wf-step custom">
                    <span className="wf-step-num">{i + 1}</span>
                    <div className="wf-step-info">
                      <div className="wf-step-title">
                        <span className="wf-custom-badge">custom</span>
                        {customData?.title || stepId}
                      </div>
                      {customData?.notes && (
                        <div className="wf-step-notes">{customData.notes}</div>
                      )}
                      {customData?.screenshotDataUrl && (
                        <img
                          src={customData.screenshotDataUrl}
                          alt={customData.title}
                          className="wf-step-screenshot"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                <div
                  className={`wf-step ${node?.stub ? 'stub' : ''}`}
                >
                  <span className="wf-step-num">{i + 1}</span>
                  <div className="wf-step-info">
                    <div className="wf-step-title">
                      {node?.stub && (
                        <span className="wf-stub-badge">stub</span>
                      )}
                      {node?.title || stepId}
                    </div>
                    <div className="wf-step-url">{node?.url || ''}</div>
                  </div>
                </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Gap summary */}
        {gaps.length > 0 && (
          <div className="wf-gap-summary">
            {gaps.length} gap{gaps.length !== 1 ? 's' : ''} detected
          </div>
        )}

        {/* Capture queue */}
        {captureQueue.length > 0 && (
          <div className="wf-section">
            <div className="wf-section-label">
              Capture Queue ({captureQueue.length})
            </div>
            <button
              className="wf-btn wf-btn-secondary"
              onClick={onExportCaptureQueue}
            >
              Export Capture Queue
            </button>
          </div>
        )}

        <div className="wf-actions">
          <button
            className="wf-btn wf-btn-danger"
            onClick={() => onDeleteWorkflow(activeWorkflow.name)}
          >
            Delete Workflow
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // List mode: show all workflows
  // -----------------------------------------------------------------------

  return (
    <div className="workflow-panel">
      <div className="workflow-panel-header">
        <span className="workflow-panel-title">Workflows</span>
        <button className="wf-close" onClick={onClose}>
          &times;
        </button>
      </div>

      {/* Persona filter pills — only shown when workflows have personas assigned */}
      {usedPersonas.length > 0 && (
        <div className="wf-persona-filters">
          <button
            className={`wf-persona-pill ${!personaFilter ? 'active' : ''}`}
            onClick={() => setPersonaFilter(null)}
          >
            All
          </button>
          {usedPersonas.map((p) => (
            <button
              key={p}
              className={`wf-persona-pill ${personaFilter === p ? 'active' : ''}`}
              onClick={() => setPersonaFilter(personaFilter === p ? null : p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {filteredWorkflows.length === 0 ? (
        <div className="wf-empty">
          {workflows.length === 0
            ? 'No workflows defined yet. Create one by clicking nodes in sequence.'
            : 'No workflows match this persona.'}
        </div>
      ) : (
        <div className="wf-list">
          {filteredWorkflows.map((wf) => (
            <div
              key={wf.name}
              className="wf-list-item"
              onClick={() => onSelectWorkflow(wf)}
            >
              <div className="wf-list-name-row">
                <span className="wf-list-name">{wf.name}</span>
                {wf.persona && (
                  <span className="wf-persona-badge small">{wf.persona}</span>
                )}
              </div>
              <div className="wf-list-meta">
                {(wf.path || []).length} steps
                {wf.contributor ? ` \u00b7 ${wf.contributor}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="wf-actions">
        <button className="wf-btn wf-btn-primary" onClick={onStartDefine}>
          + New Workflow
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urlHierarchyDistance(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    if (a.hostname !== b.hostname) return 99;

    const segsA = a.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const segsB = b.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

    let common = 0;
    while (
      common < segsA.length &&
      common < segsB.length &&
      segsA[common] === segsB[common]
    ) {
      common++;
    }

    return segsA.length - common + (segsB.length - common);
  } catch {
    return 99;
  }
}
