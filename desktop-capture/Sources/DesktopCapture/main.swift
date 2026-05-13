import AppKit

// Must run as a proper app to get menu bar + global hotkey
let app = NSApplication.shared
app.setActivationPolicy(.accessory) // menu bar only, no dock icon

let delegate = AppDelegate()
app.delegate = delegate
app.run()
