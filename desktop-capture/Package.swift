// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DesktopCapture",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "DesktopCapture",
            path: "Sources/DesktopCapture",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("Carbon"),
                .linkedFramework("CoreGraphics"),
                .linkedFramework("ScreenCaptureKit"),
            ]
        )
    ]
)
