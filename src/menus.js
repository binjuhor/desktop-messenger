'use strict'

const { app, clipboard, Menu, shell } = require('electron')
const { openExternal } = require('./security')
const { START_URL } = require('./url-policy')

const isMac = process.platform === 'darwin'
const REPO_URL = 'https://github.com/binjuhor/desktop-messenger'

function buildApplicationMenu (getWindow) {
  const withWindow = (fn) => () => {
    const win = getWindow()
    if (win) fn(win)
  }

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: withWindow((w) => w.loadURL(START_URL)) },
        { role: 'reload' },
        { role: 'forceReload' },
        // DevTools only in development: a console on a logged-in session invites self-XSS scams.
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: isMac ? 'Cmd+[' : 'Alt+Left',
          click: withWindow((w) => w.webContents.navigationHistory.canGoBack() && w.webContents.navigationHistory.goBack())
        },
        {
          label: 'Forward',
          accelerator: isMac ? 'Cmd+]' : 'Alt+Right',
          click: withWindow((w) => w.webContents.navigationHistory.canGoForward() && w.webContents.navigationHistory.goForward())
        }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Project on GitHub', click: () => shell.openExternal(REPO_URL) }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Native right-click menu: spelling, clipboard, links and images. */
function attachContextMenu (contents) {
  contents.on('context-menu', (_event, params) => {
    const items = []

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) })
      }
      items.push({
        label: 'Add to Dictionary',
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
      items.push({ type: 'separator' })
    }

    if (params.linkURL) {
      items.push(
        { label: 'Open Link in Browser', click: () => openExternal(params.linkURL) },
        { label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' }
      )
    }

    if (params.mediaType === 'image' && params.srcURL) {
      items.push(
        { label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) },
        { label: 'Save Image As…', click: () => contents.downloadURL(params.srcURL) },
        { type: 'separator' }
      )
    }

    const { editFlags } = params
    if (params.isEditable) {
      items.push(
        { role: 'cut', enabled: editFlags.canCut },
        { role: 'copy', enabled: editFlags.canCopy },
        { role: 'paste', enabled: editFlags.canPaste },
        { role: 'selectAll', enabled: editFlags.canSelectAll }
      )
    } else if (params.selectionText) {
      items.push({ role: 'copy' })
    }

    if (!app.isPackaged) {
      items.push({ type: 'separator' }, { label: 'Inspect Element', click: () => contents.inspectElement(params.x, params.y) })
    }

    const menu = items.filter((item, i, all) =>
      // drop leading/trailing/duplicate separators
      item.type !== 'separator' || (i > 0 && i < all.length - 1 && all[i + 1].type !== 'separator')
    )
    if (menu.length) Menu.buildFromTemplate(menu).popup()
  })
}

module.exports = { buildApplicationMenu, attachContextMenu }
