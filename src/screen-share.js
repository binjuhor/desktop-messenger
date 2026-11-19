'use strict'

const { BrowserWindow, desktopCapturer, Menu } = require('electron')
const { isTrustedUrl } = require('./url-policy')

/**
 * Handles getDisplayMedia() for calls. Shows a native menu of screens/windows so the user
 * explicitly chooses what to share; untrusted frames and dismissed pickers share nothing.
 */
function configureScreenShare (ses) {
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    const deny = () => callback({})
    const origin = request.securityOrigin || request.frame?.url
    if (!isTrustedUrl(origin)) return deny()

    let sources
    try {
      sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    } catch (error) {
      console.error('Screen sources unavailable:', error)
      return deny()
    }
    if (!sources.length) return deny()

    // The callback must be called exactly once, whichever of click/close fires first.
    let settled = false
    const settle = (result) => {
      if (settled) return
      settled = true
      callback(result)
    }
    const pick = (source) => settle({ video: source })
    const screens = sources.filter((s) => s.id.startsWith('screen:'))
    const windows = sources.filter((s) => s.id.startsWith('window:'))

    const menu = Menu.buildFromTemplate([
      { label: 'Share your screen', enabled: false },
      ...screens.map((s, i) => ({ label: screens.length > 1 ? `Screen ${i + 1}` : 'Entire Screen', click: () => pick(s) })),
      ...(windows.length ? [{ type: 'separator' }, { label: 'Share a window', enabled: false }] : []),
      ...windows.map((s) => ({ label: s.name.slice(0, 60) || 'Untitled window', click: () => pick(s) }))
    ])

    menu.popup({
      window: BrowserWindow.getFocusedWindow() || undefined,
      // On some platforms the close callback fires before the item's click handler,
      // so give the click a moment to land before treating the close as a dismissal.
      callback: () => setTimeout(() => settle({}), 250)
    })
  })
}

module.exports = { configureScreenShare }
