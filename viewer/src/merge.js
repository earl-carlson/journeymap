/**
 * IA Mapper — Session Merge Logic (Piece 5)
 *
 * Shared implementation used by both the viewer and (eventually) the CLI.
 * Merges multiple session.json files into a single unified graph.
 *
 * Rules:
 *   - Nodes dedup by ID (url-hash). Same page = one node.
 *   - Notes from all sessions appended with contributor attribution.
 *   - Flags from all contributors surfaced (union, not replace).
 *   - Edges dedup by from+to+type. Navigate edges increment count.
 *     child-of edges stay at count 1.
 *   - Workflows preserved from all sessions, node IDs already match.
 *   - Non-destructive: original sessions are never modified.
 *   - Contributors array tracks all merged sessions.
 */

/**
 * Merge one or more sessions into a base session.
 * If base is null, the first session becomes the base.
 *
 * @param {Object|null} base - Existing merged session, or null
 * @param  {...Object} sessions - Session objects to merge in
 * @returns {Object} - Merged session
 */
export function mergeSessions(base, ...sessions) {
  // Start from a copy of base, or create empty
  const merged = base
    ? structuredClone(base)
    : {
        meta: {
          contributor: 'merged',
          date: new Date().toISOString().slice(0, 10),
          mode: 'map',
        },
        nodes: {},
        edges: [],
        workflows: [],
        contributors: [],
      };

  // Ensure contributors array exists
  if (!merged.contributors) {
    merged.contributors = [];
    if (base && base.meta) {
      merged.contributors.push({
        contributor: base.meta.contributor,
        date: base.meta.date,
        mode: base.meta.mode,
      });
    }
  }

  for (const session of sessions) {
    if (!session || !session.nodes) continue;

    const contributor = session.meta?.contributor || 'anonymous';

    // Track contributor
    merged.contributors.push({
      contributor,
      date: session.meta?.date,
      mode: session.meta?.mode,
    });

    // Merge nodes
    for (const [id, node] of Object.entries(session.nodes)) {
      if (!merged.nodes[id]) {
        // New node — copy it in
        merged.nodes[id] = structuredClone(node);
        // Attribute notes
        if (merged.nodes[id].notes) {
          merged.nodes[id].notes = merged.nodes[id].notes.map((note) =>
            typeof note === 'string'
              ? { text: note, contributor }
              : { ...note, contributor: note.contributor || contributor }
          );
        }
      } else {
        // Existing node — merge fields
        const existing = merged.nodes[id];

        // Promote stub to real if the incoming node is real
        if (existing.stub && !node.stub) {
          existing.stub = false;
        }

        // Update title if incoming has a better one (non-stub, non-URL)
        if (!node.stub && node.title && node.title !== node.url) {
          existing.title = node.title;
        }

        // Union flags
        if (node.flags) {
          for (const flag of node.flags) {
            if (!existing.flags.includes(flag)) {
              existing.flags.push(flag);
            }
          }
        }

        // Append notes with attribution
        if (node.notes && node.notes.length > 0) {
          for (const note of node.notes) {
            const attributed =
              typeof note === 'string'
                ? { text: note, contributor }
                : { ...note, contributor: note.contributor || contributor };
            existing.notes.push(attributed);
          }
        }

        // Keep inferredParent if not set
        if (!existing.inferredParent && node.inferredParent) {
          existing.inferredParent = node.inferredParent;
        }

        // Merge modal fields
        if (node.isModal) {
          existing.isModal = true;
          existing.modalContentHash = existing.modalContentHash || node.modalContentHash;
          existing.parentPageId = existing.parentPageId || node.parentPageId;
        }
      }
    }

    // Merge edges
    for (const edge of session.edges) {
      const existing = merged.edges.find(
        (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (existing) {
        // child-of stays at 1, others accumulate
        if (edge.type !== 'child-of') {
          existing.count = (existing.count || 1) + (edge.count || 1);
        }
      } else {
        merged.edges.push(structuredClone(edge));
      }
    }

    // Merge workflows
    if (session.workflows) {
      for (const workflow of session.workflows) {
        // Check if a workflow with the same name already exists
        const existing = merged.workflows.find((w) => w.name === workflow.name);
        if (!existing) {
          merged.workflows.push({
            ...structuredClone(workflow),
            contributor,
          });
        }
      }
    }
  }

  // Update meta
  merged.meta.contributor = 'merged';
  merged.meta.date = new Date().toISOString().slice(0, 10);

  return merged;
}
