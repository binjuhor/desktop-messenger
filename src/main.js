'use strict'

const path = require('path')
const { app, BrowserWindow, nativeTheme } = require('electron')
const { applySecurityPolicy, SECURE_WEB_PREFERENCES } = require('./security')
const { buildApplicationMenu, attachContextMenu } = require('./menus')
const { loadWindowState, trackWindowState } = require('./window-state')
const { START_URL, unreadCountFromTitle } = require('./url-policy')
const { createTray, setTrayUnreadCount, destroyTray } = require('./tray')

const isMac = process.platform === 'darwin'
// Closing the window keeps the app alive (dock on macOS, tray on Windows). Linux is excluded:
// many desktops (e.g. stock GNOME) hide tray icons, which would leave an invisible process.
const hideOnClose = isMac || process.platform === 'win32'

let mainWindow = null
let isQuitting = false
let lastUnreadCount = 0

// Messenger serves a degraded "unsupported browser" page to unknown user agents,
// so present as the bundled Chrome instead of "Electron/x Messenger/x".
function sanitizeUserAgent () {
  const escapedName = app.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  app.userAgentFallback = app.userAgentFallback
    .replace(/\sElectron\/\S+/, '')
    .replace(new RegExp(`\\s${escapedName}/\\S+`), '')
}

function updateUnreadBadge (title) {
  const count = unreadCountFromTitle(title)
  if (count === lastUnreadCount) return
  const increased = count > lastUnreadCount
  lastUnreadCount = count

  app.setBadgeCount(count) // macOS dock + Linux Unity launchers; no-op elsewhere
  setTrayUnreadCount(count)

  if (increased && mainWindow && !mainWindow.isFocused()) {
    if (isMac) app.dock?.bounce('informational')
    else mainWindow.flashFrame(true)
  }
}

function createMainWindow () {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 380,
    minHeight: 500,
    show: false,
    title: 'Messenger',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#ffffff',
    autoHideMenuBar: !isMac,
    webPreferences: SECURE_WEB_PREFERENCES
  })

  if (state.isMaximized) mainWindow.maximize()
  trackWindowState(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('focus', () => mainWindow.flashFrame(false))
  mainWindow.on('page-title-updated', (_event, title) => updateUnreadBadge(title))

  mainWindow.on('close', (event) => {
    if (hideOnClose && !isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.loadURL(START_URL)
}

function showMainWindow () {
  if (!mainWindow) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// The product name "Messenger" would otherwise resolve to the same profile folder as Meta's
// official Messenger desktop app. Keep cookies, cache and settings in a dedicated directory.
// Must run before anything touches userData (including the single-instance lock).
app.setPath('userData', path.join(app.getPath('appData'), 'Desktop Messenger'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  sanitizeUserAgent()
  // Registered before any window exists so popups (e.g. call windows) get the same treatment.
  app.on('web-contents-created', (_event, contents) => attachContextMenu(contents))

  app.whenReady().then(() => {
    applySecurityPolicy()
    buildApplicationMenu(() => mainWindow)
    createMainWindow()
    createTray(showMainWindow)
  })

  app.on('activate', showMainWindow)
  app.on('before-quit', () => {
    isQuitting = true
    destroyTray()
  })
  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })
}
