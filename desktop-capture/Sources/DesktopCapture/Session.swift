import Foundation

struct SessionNode: Codable {
    var url: String
    var title: String
    var screenshot: String?      // relative path: "screenshots/{id}.png"
    var notes: [String]
    var flags: [String]
    var stub: Bool
    var inferredParent: String?
    var platform: String
}

struct SessionEdge: Codable {
    var from: String
    var to: String
    var type: String
    var count: Int
    var navClass: String?
}

struct SessionMeta: Codable {
    var contributor: String
    var date: String
    var mode: String
}

struct SessionData: Codable {
    var meta: SessionMeta
    var nodes: [String: SessionNode]
    var edges: [SessionEdge]
    var workflows: [String]
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

class Session {
    var meta: SessionMeta
    var nodes: [String: SessionNode] = [:]
    var edges: [SessionEdge] = []
    var screenshotData: [String: Data] = [:]  // nodeId -> PNG data

    private var previousNodeId: String? = nil

    init(contributor: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        meta = SessionMeta(
            contributor: contributor,
            date: formatter.string(from: Date()),
            mode: "map"
        )
    }

    // Record a stamped view. Returns the node ID.
    @discardableResult
    func recordView(url: String, title: String, screenshotPng: Data?) -> String {
        let id = nodeId(for: url)

        if nodes[id] == nil {
            // New node
            let screenshotPath: String? = screenshotPng != nil ? "screenshots/\(id).png" : nil
            nodes[id] = SessionNode(
                url: url,
                title: title,
                screenshot: screenshotPath,
                notes: [],
                flags: [],
                stub: false,
                inferredParent: nil,
                platform: "desktop"
            )
            if let png = screenshotPng {
                screenshotData[id] = png
            }
            buildAncestorChain(for: url)
        }

        // Navigate edge from previous node
        if let prev = previousNodeId, prev != id {
            addEdge(from: prev, to: id, type: "navigate", navClass: navClass(from: prev, to: id))
        }

        previousNodeId = id
        return id
    }

    // Walk up the URL path creating stub nodes and child-of edges.
    // Always ensures "Docker Desktop" exists as the top-level root node.
    private func buildAncestorChain(for url: String) {
        guard var components = URLComponents(string: url) else { return }
        let pathParts = components.path
            .split(separator: "/", omittingEmptySubsequences: true)
            .map(String.init)

        // Ensure the Docker Desktop root node always exists
        let rootUrl = "desktop://docker-desktop"
        let rootId = nodeId(for: rootUrl)
        if nodes[rootId] == nil {
            nodes[rootId] = SessionNode(
                url: rootUrl,
                title: "Docker Desktop",
                screenshot: nil,
                notes: [],
                flags: [],
                stub: true,
                inferredParent: nil,
                platform: "desktop"
            )
        }

        guard !pathParts.isEmpty else { return }

        // Build ancestor URLs from root down
        var ancestors: [String] = []
        for i in 0..<pathParts.count {
            components.path = "/" + pathParts[0...i].joined(separator: "/")
            components.query = nil
            components.fragment = nil
            if let s = components.string {
                ancestors.append(s)
            }
        }

        // The node itself is the last ancestor — skip it
        let chain = ancestors.dropLast()

        // Start parent chain from the Docker Desktop root
        var parentId: String? = rootId
        for ancestorUrl in chain {
            let aid = nodeId(for: ancestorUrl)
            if nodes[aid] == nil {
                // Derive a readable title from the last path segment
                let segment = ancestorUrl.split(separator: "/").last.map(String.init) ?? ancestorUrl
                let title = segment.replacingOccurrences(of: "-", with: " ").capitalized
                nodes[aid] = SessionNode(
                    url: ancestorUrl,
                    title: title,
                    screenshot: nil,
                    notes: [],
                    flags: [],
                    stub: true,
                    inferredParent: parentId,
                    platform: "desktop"
                )
            }
            if let pid = parentId {
                addEdge(from: pid, to: aid, type: "child-of", navClass: nil)
            }
            parentId = aid
        }

        // Wire the actual node's inferredParent to the deepest ancestor
        let nodeUrl = cleanUrl(url)
        let nid = urlHash(nodeUrl)
        if var node = nodes[nid], node.inferredParent == nil {
            node.inferredParent = parentId
            nodes[nid] = node
        }

        // child-of edge from parent to this node
        if let pid = parentId {
            addEdge(from: pid, to: nid, type: "child-of", navClass: nil)
        }
    }

    private func addEdge(from: String, to: String, type edgeType: String, navClass: String?) {
        // Deduplicate: increment count if same from/to/type exists
        if let idx = edges.firstIndex(where: { $0.from == from && $0.to == to && $0.type == edgeType }) {
            if edgeType != "child-of" {
                edges[idx].count += 1
            }
            return
        }
        edges.append(SessionEdge(from: from, to: to, type: edgeType, count: 1, navClass: navClass))
    }

    private func navClass(from: String, to: String) -> String {
        let fromUrl = nodes[from]?.url ?? ""
        let toUrl = nodes[to]?.url ?? ""
        guard
            let fromHost = URLComponents(string: fromUrl)?.host,
            let toHost = URLComponents(string: toUrl)?.host
        else { return "same-domain-other" }
        return fromHost == toHost ? "same-domain-other" : "cross-domain"
    }

    func toSessionData() -> SessionData {
        SessionData(meta: meta, nodes: nodes, edges: edges, workflows: [])
    }
}
