import AppKit
import CoreGraphics

struct Screenshotter {
    /// Capture the Docker Desktop window as PNG data.
    /// Falls back to full screen if the window can't be found.
    static func captureDockerDesktop() -> Data? {
        // Find the Docker Desktop window by owner name
        let windowList = CGWindowListCopyWindowInfo(
            [.optionOnScreenOnly, .excludeDesktopElements],
            kCGNullWindowID
        ) as? [[String: Any]] ?? []

        let dockerWindow = windowList.first { info in
            let owner = info[kCGWindowOwnerName as String] as? String ?? ""
            let layer = info[kCGWindowLayer as String] as? Int ?? 0
            return owner == "Docker Desktop" && layer == 0
        }

        if let window = dockerWindow,
           let windowId = window[kCGWindowNumber as String] as? CGWindowID {
            // Capture just the Docker Desktop window
            if let image = CGWindowListCreateImage(
                .null,
                .optionIncludingWindow,
                windowId,
                [.boundsIgnoreFraming, .bestResolution]
            ) {
                return pngData(from: image)
            }
        }

        // Fallback: capture the full screen
        if let screen = NSScreen.main,
           let image = CGWindowListCreateImage(
               screen.frame,
               .optionOnScreenOnly,
               kCGNullWindowID,
               .bestResolution
           ) {
            return pngData(from: image)
        }

        return nil
    }

    private static func pngData(from cgImage: CGImage) -> Data? {
        let rep = NSBitmapImageRep(cgImage: cgImage)
        return rep.representation(using: .png, properties: [:])
    }
}
