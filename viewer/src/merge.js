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

        // Keep screenshot if existing doesn't have one
        if (!existing.screenshotDataUrl && node.screenshotDataUrl) {
          existing.screenshotDataUrl = node.screenshotDataUrl;
          existing.screenshot = node.screenshot;
        }
        if (!existing.screenshot && node.screenshot) {
          existing.screenshot = node.screenshot;
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

  // Dedup pass: re-canonicalize URLs and merge nodes that only differed
  // by tracking parameters (_gl, utm_*, gclid, etc.)
  deduplicateByCanonicalUrl(merged);

  return merged;
}

// ---------------------------------------------------------------------------
// URL canonicalization + dedup
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = new Set([
  '_gl', '_ga', '_gid', '_gac',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gclsrc', 'dclid', 'fbclid',
  'msclkid', 'twclid', 'li_fat_id',
  'mc_cid', 'mc_eid',
  'ref', 'referrer',
  '_hsenc', '_hsmi', 'hsa_cam', 'hsa_grp', 'hsa_mt', 'hsa_src', 'hsa_ad',
  'hsa_acc', 'hsa_net', 'hsa_ver', 'hsa_la', 'hsa_ol', 'hsa_kw', 'hsa_tgt',
]);

function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key)) {
        u.searchParams.delete(key);
      }
    }
    let result = u.toString().replace(/\/+$/, '');
    if (result.endsWith('?')) result = result.slice(0, -1);
    return result;
  } catch {
    return url;
  }
}

function urlHash(url) {
  const normalized = cleanUrl(url);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Post-merge dedup: find nodes whose URLs only differ by tracking params,
 * merge them into one node under the canonical ID, and rewrite all edges
 * and workflow paths.
 */
function deduplicateByCanonicalUrl(merged) {
  const canonicalMap = new Map(); // canonicalId → [oldId, oldId, ...]
  const idRemap = new Map();     // oldId → canonicalId

  for (const [id, node] of Object.entries(merged.nodes)) {
    // Never dedup modal nodes — they are distinct pages, not tracking-param variants
    if (id.includes(':modal:')) continue;

    const canonical = cleanUrl(node.url);
    const canonId = urlHash(canonical);

    if (canonId !== id) {
      // This node's ID doesn't match its canonical URL hash — it has tracking params
      if (!canonicalMap.has(canonId)) {
        canonicalMap.set(canonId, []);
      }
      canonicalMap.get(canonId).push(id);
      idRemap.set(id, canonId);
    }
  }

  if (idRemap.size === 0) return; // Nothing to dedup

  // Merge duplicate nodes into their canonical version
  for (const [canonId, dupeIds] of canonicalMap) {
    // Ensure the canonical node exists
    if (!merged.nodes[canonId]) {
      // Use the first dupe as the base
      const firstDupe = dupeIds[0];
      merged.nodes[canonId] = structuredClone(merged.nodes[firstDupe]);
      merged.nodes[canonId].url = cleanUrl(merged.nodes[canonId].url);
    }

    const target = merged.nodes[canonId];

    for (const dupeId of dupeIds) {
      const dupe = merged.nodes[dupeId];
      if (!dupe) continue;

      // Promote stub
      if (target.stub && !dupe.stub) target.stub = false;

      // Better title
      if (!dupe.stub && dupe.title && dupe.title !== dupe.url) {
        target.title = dupe.title;
      }

      // Union flags
      if (dupe.flags) {
        if (!target.flags) target.flags = [];
        for (const f of dupe.flags) {
          if (!target.flags.includes(f)) target.flags.push(f);
        }
      }

      // Append notes
      if (dupe.notes && dupe.notes.length > 0) {
        if (!target.notes) target.notes = [];
        target.notes.push(...dupe.notes);
      }

      // Keep screenshot
      if (!target.screenshotDataUrl && dupe.screenshotDataUrl) {
        target.screenshotDataUrl = dupe.screenshotDataUrl;
        target.screenshot = dupe.screenshot;
      }
      if (!target.screenshot && dupe.screenshot) {
        target.screenshot = dupe.screenshot;
      }

      // Keep inferredParent (remap it too), but never create a self-reference
      if (!target.inferredParent && dupe.inferredParent) {
        const remapped = idRemap.get(dupe.inferredParent) || dupe.inferredParent;
        if (remapped !== canonId) {
          target.inferredParent = remapped;
        }
      }

      // Remove the duplicate
      delete merged.nodes[dupeId];
    }

    // Remap inferredParent on the canonical node
    if (target.inferredParent && idRemap.has(target.inferredParent)) {
      target.inferredParent = idRemap.get(target.inferredParent);
    }
  }

  // Remap inferredParent on all remaining nodes
  for (const node of Object.values(merged.nodes)) {
    if (node.inferredParent && idRemap.has(node.inferredParent)) {
      node.inferredParent = idRemap.get(node.inferredParent);
    }
  }

  // Remap edges
  for (const edge of merged.edges) {
    if (idRemap.has(edge.from)) edge.from = idRemap.get(edge.from);
    if (idRemap.has(edge.to)) edge.to = idRemap.get(edge.to);
  }

  // Dedup edges after remapping (same from+to+type)
  const edgeKey = (e) => `${e.from}->${e.to}:${e.type}`;
  const edgeMap = new Map();
  for (const edge of merged.edges) {
    const key = edgeKey(edge);
    if (edgeMap.has(key)) {
      const existing = edgeMap.get(key);
      if (edge.type !== 'child-of') {
        existing.count = (existing.count || 1) + (edge.count || 1);
      }
    } else {
      edgeMap.set(key, edge);
    }
  }
  merged.edges = [...edgeMap.values()];

  // Remove self-referencing edges (from === to)
  merged.edges = merged.edges.filter((e) => e.from !== e.to);

  // Remap workflow paths
  for (const wf of merged.workflows) {
    if (wf.path) {
      wf.path = wf.path.map((id) => idRemap.get(id) || id);
    }
  }

  console.log(`[merge] Deduped ${idRemap.size} nodes with tracking params`);
}
