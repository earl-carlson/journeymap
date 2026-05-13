import AppKit
import Carbon

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var session: Session? = nil
    var hotKeyRef: EventHotKeyRef? = nil
    var stampCount = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenuBar()
    }

    // -----------------------------------------------------------------------
    // Menu bar
    // -----------------------------------------------------------------------

    func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "◉ Map"
            button.toolTip = "IA Mapper — Desktop Capture"
        }
        rebuildMenu()
    }

    func rebuildMenu() {
        let menu = NSMenu()

        if session == nil {
            let start = NSMenuItem(title: "Start Session…", action: #selector(startSession), keyEquivalent: "")
            start.target = self
            menu.addItem(start)
        } else {
            let info = NSMenuItem(title: "● Recording (\(stampCount) stamps)", action: nil, keyEquivalent: "")
            info.isEnabled = false
            menu.addItem(info)

            menu.addItem(NSMenuItem.separator())

            let stamp = NSMenuItem(title: "Stamp View  ⌘⇧B", action: #selector(stampView), keyEquivalent: "")
            stamp.target = self
            menu.addItem(stamp)

            menu.addItem(NSMenuItem.separator())

            let stop = NSMenuItem(title: "Stop & Export", action: #selector(stopSession), keyEquivalent: "")
            stop.target = self
            menu.addItem(stop)
        }

        menu.addItem(NSMenuItem.separator())
        let quit = NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quit)

        statusItem.menu = menu
    }

    // -----------------------------------------------------------------------
    // Session lifecycle
    // -----------------------------------------------------------------------

    @objc func startSession() {
        let contributor = promptText(
            title: "Start Session",
            message: "Your name (used in the session filename):",
            placeholder: "Earl"
        ) ?? "Unknown"

        session = Session(contributor: contributor)
        stampCount = 0
        registerHotKey()
        rebuildMenu()

        if let button = statusItem.button {
            button.title = "● Map"
        }

        notify(title: "Session started", body: "Press ⌘⇧M to stamp a view.")
    }

    @objc func stopSession() {
        guard let s = session else { return }
        unregisterHotKey()

        let repoRoot = Exporter.findRepoRoot()
        do {
            let folder = try Exporter.export(session: s, repoRoot: repoRoot)
            session = nil
            stampCount = 0
            rebuildMenu()
            if let button = statusItem.button {
                button.title = "◉ Map"
            }
            notify(title: "Session exported", body: folder.lastPathComponent)
        } catch {
            showAlert(title: "Export failed", message: error.localizedDescription)
        }
    }

    // -----------------------------------------------------------------------
    // Stamp
    // -----------------------------------------------------------------------

    @objc func stampView() {
        guard let s = session else { return }

        // Capture Docker Desktop window first (before dialog steals focus)
        let png = Screenshotter.captureDockerDesktop()

        // Ask for the view label
        guard let label = promptText(
            title: "Stamp View",
            message: "What view is this? (e.g. Containers, Images > Pull, Settings > Docker Engine)",
            placeholder: "Containers"
        ), !label.isEmpty else { return }

        // Build a synthetic desktop URL from the label
        // "Images > Pull" -> desktop://docker-desktop/images/pull
        let path = label
            .lowercased()
            .components(separatedBy: ">")
            .map { $0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "-") }
            .joined(separator: "/")
        let url = "desktop://docker-desktop/\(path)"

        s.recordView(url: url, title: label, screenshotPng: png)
        stampCount += 1
        rebuildMenu()
        notify(title: "Stamped", body: label)
    }

    // -----------------------------------------------------------------------
    // Global hotkey (Cmd+Shift+M) via Carbon
    // -----------------------------------------------------------------------

    func registerHotKey() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))

        InstallEventHandler(
            GetApplicationEventTarget(),
            { (_, event, userData) -> OSStatus in
                guard let ptr = userData else { return OSStatus(eventNotHandledErr) }
                let delegate = Unmanaged<AppDelegate>.fromOpaque(ptr).takeUnretainedValue()
                delegate.stampView()
                return noErr
            },
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            nil
        )

        // Cmd+Shift+B: keyCode 11 = B
        let hotKeyID = EventHotKeyID(signature: OSType(0x4D415049), id: 1) // 'MAPI'
        RegisterEventHotKey(
            11,                          // B key
            UInt32(cmdKey | shiftKey),   // Cmd+Shift
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    func unregisterHotKey() {
        if let ref = hotKeyRef {
            UnregisterEventHotKey(ref)
            hotKeyRef = nil
        }
    }

    // -----------------------------------------------------------------------
    // UI helpers
    // -----------------------------------------------------------------------

    func promptText(title: String, message: String, placeholder: String) -> String? {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")

        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        input.placeholderString = placeholder
        input.stringValue = ""
        alert.accessoryView = input

        alert.window.initialFirstResponder = input

        NSApp.activate(ignoringOtherApps: true)
        let response = alert.runModal()
        return response == .alertFirstButtonReturn ? input.stringValue : nil
    }

    func showAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.runModal()
    }

    func notify(title: String, body: String) {
        // Simple: just update the menu bar button tooltip
        // (User notifications require entitlements for a non-bundled app)
        if let button = statusItem.button {
            button.toolTip = "\(title): \(body)"
        }
        // Print to console as fallback
        print("[\(title)] \(body)")
    }
}
