'use strict'

const path = require('path')
const { app, Menu, Tray } = require('electron')

// macOS uses the dock for the same purpose, so the tray is Windows/Linux only.
const TRAY_SUPPORTED = process.platform !== 'darwin'

let tray = null

/** Creates the tray icon. `showWindow` restores/focuses the main window. */
function createTray (showWindow) {
  if (!TRAY_SUPPORTED || tray) return

  // Electron picks tray-icon@2x.png automatically on HiDPI displays.
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'))
  tray.setToolTip('Messenger')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Messenger', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
  // Windows: single click restores. Linux (AppIndicator) only exposes the context menu.
  tray.on('click', showWindow)
}

function setTrayUnreadCount (count) {
  if (!tray) return
  tray.setToolTip(count > 0 ? `Messenger (${count} unread)` : 'Messenger')
}

function destroyTray () {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

module.exports = { createTray, setTrayUnreadCount, destroyTray, TRAY_SUPPORTED }
