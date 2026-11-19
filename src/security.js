'use strict'

const { app, session, shell, systemPreferences } = require('electron')
const { isTrustedUrl, isTrustedOrigin, isSafeExternalUrl, unwrapLinkShim } = require('./url-policy')
const { configureScreenShare } = require('./screen-share')

// Permissions Messenger legitimately needs. Everything else (geolocation, MIDI, HID, serial,
// USB, idle detection, ...) is denied, and even these are only granted to trusted origins.
const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'display-capture',
  'fullscreen',
  'clipboard-sanitized-write'
])

/** Hardened webPreferences used for every window, including call popups. */
const SECURE_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
  navigateOnDragDrop: false,
  spellcheck: true
})

function openExternal (url) {
  if (isSafeExternalUrl(url)) {
    shell.openExternal(url).catch((error) => console.error('openExternal failed:', error))
  }
}

async function ensureMacMediaAccess (mediaTypes = []) {
  if (process.platform !== 'darwin') return true
  const kinds = mediaTypes.length ? mediaTypes : ['audio', 'video']
  for (const kind of kinds) {
    const type = kind === 'video' ? 'camera' : 'microphone'
    if (systemPreferences.getMediaAccessStatus(type) === 'granted') continue
    if (!(await systemPreferences.askForMediaAccess(type))) return false
  }
  return true
}

function configureSessionPermissions (ses) {
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    ALLOWED_PERMISSIONS.has(permission) && isTrustedOrigin(requestingOrigin)
  )

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL()
    if (!ALLOWED_PERMISSIONS.has(permission) || !isTrustedUrl(origin)) {
      callback(false)
      return
    }
    if (permission === 'media') {
      ensureMacMediaAccess(details.mediaTypes).then(callback, () => callback(false))
      return
    }
    callback(true)
  })

  // Never allow device pickers (USB/HID/serial/bluetooth) from remote content.
  ses.setDevicePermissionHandler(() => false)
}

/** Applies navigation, popup and webview guards to every webContents the app creates. */
function guardWebContents (contents) {
  contents.on('will-attach-webview', (event) => event.preventDefault())

  // Untrusted top-level navigations/redirects are cancelled and handed to the default browser.
  const blockUntrustedNavigation = (event, legacyUrl) => {
    const url = event.url || legacyUrl
    const shimTarget = unwrapLinkShim(url)
    if (!shimTarget && isTrustedUrl(url)) return
    event.preventDefault()
    openExternal(shimTarget || url)
  }
  contents.on('will-navigate', blockUntrustedNavigation)
  contents.on('will-redirect', (event, legacyUrl) => {
    if (event.isMainFrame === false) return
    blockUntrustedNavigation(event, legacyUrl)
  })

  contents.setWindowOpenHandler(({ url }) => {
    const shimTarget = unwrapLinkShim(url)
    if (shimTarget) {
      openExternal(shimTarget)
      return { action: 'deny' }
    }
    // Calls and some account flows open popups on trusted hosts: keep them in-app, hardened.
    if (isTrustedUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: SECURE_WEB_PREFERENCES
        }
      }
    }
    openExternal(url)
    return { action: 'deny' }
  })
}

function applySecurityPolicy () {
  configureSessionPermissions(session.defaultSession)
  configureScreenShare(session.defaultSession)
  app.on('web-contents-created', (_event, contents) => guardWebContents(contents))
}

module.exports = { applySecurityPolicy, openExternal, SECURE_WEB_PREFERENCES }
