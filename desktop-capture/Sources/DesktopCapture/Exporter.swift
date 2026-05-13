import Foundation

struct Exporter {
    /// Write session.json + screenshots/ into exports/ in the journeymap repo.
    /// Returns the path of the created session folder.
    static func export(session: Session, repoRoot: URL) throws -> URL {
        let exportsDir = repoRoot.appendingPathComponent("exports")

        // Folder name: session-{contributor}-{YYYY-MM-DD}-{HHmmss}
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd-HHmmss"
        let timestamp = formatter.string(from: Date())
        let folderName = "session-\(session.meta.contributor)-\(timestamp)"
        let sessionDir = exportsDir.appendingPathComponent(folderName)
        let screenshotsDir = sessionDir.appendingPathComponent("screenshots")

        try FileManager.default.createDirectory(at: screenshotsDir, withIntermediateDirectories: true)

        // Write screenshots
        for (nodeId, pngData) in session.screenshotData {
            let file = screenshotsDir.appendingPathComponent("\(nodeId).png")
            try pngData.write(to: file)
        }

        // Write session.json
        let data = session.toSessionData()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let json = try encoder.encode(data)
        let jsonFile = sessionDir.appendingPathComponent("session.json")
        try json.write(to: jsonFile)

        return sessionDir
    }

    /// Find the journeymap repo root by walking up from the app bundle,
    /// or fall back to the hardcoded path.
    static func findRepoRoot() -> URL {
        // Try to find exports/ relative to known locations
        let candidates = [
            URL(fileURLWithPath: NSHomeDirectory())
                .appendingPathComponent("Documents/GitHub/journeymap"),
            URL(fileURLWithPath: "/Users/earl/Documents/GitHub/journeymap"),
        ]
        for candidate in candidates {
            let exports = candidate.appendingPathComponent("exports")
            if FileManager.default.fileExists(atPath: exports.path) {
                return candidate
            }
        }
        // Last resort: ask the user
        return candidates[0]
    }
}
