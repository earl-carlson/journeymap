import Foundation

/// djb2 hash — must match the Chrome extension's urlHash() exactly.
/// Seed 5381, shift (hash << 5) + hash, unsigned 32-bit, 8-char hex output.
func urlHash(_ input: String) -> String {
    var hash: UInt32 = 5381
    for char in input.unicodeScalars {
        hash = (hash &<< 5) &+ hash &+ UInt32(char.value)
    }
    return String(format: "%08x", hash)
}

/// Strip tracking params and fragment — mirrors cleanUrl() in the extension.
func cleanUrl(_ rawUrl: String) -> String {
    guard var components = URLComponents(string: rawUrl) else { return rawUrl }

    // Strip fragment
    components.fragment = nil

    // Strip tracking query params
    let blocked: Set<String> = [
        "_gl", "_ga", "_gid", "_gcl_au",
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "gclid", "fbclid", "_hsenc", "_hsmi", "hsCtaTracking",
        "ref", "referrer", "source"
    ]
    if let items = components.queryItems {
        let filtered = items.filter { !blocked.contains($0.name) }
        components.queryItems = filtered.isEmpty ? nil : filtered
    }

    // Drop trailing slash on path (but keep root "/")
    var path = components.path
    if path.count > 1, path.hasSuffix("/") {
        path.removeLast()
        components.path = path
    }

    return components.string ?? rawUrl
}

/// Canonical node ID for a desktop view.
/// Uses a synthetic desktop:// URL so IDs are stable and unique.
func nodeId(for url: String) -> String {
    return urlHash(cleanUrl(url))
}
