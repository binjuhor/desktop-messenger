'use strict'

const fs = require('fs')
const path = require('path')
const { app, screen } = require('electron')

const DEFAULT_STATE = { width: 1100, height: 780 }

function statePath () {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function isVisibleOnSomeDisplay (bounds) {
  return screen.getAllDisplays().some(({ workArea }) =>
    bounds.x >= workArea.x &&
    bounds.y >= workArea.y &&
    bounds.x + bounds.width <= workArea.x + workArea.width &&
    bounds.y + bounds.height <= workArea.y + workArea.height
  )
}

/** Returns last saved bounds, dropping the position if that display is gone. */
function loadWindowState () {
  try {
    const saved = JSON.parse(fs.readFileSync(statePath(), 'utf8'))
    const state = {
      width: Number(saved.width) || DEFAULT_STATE.width,
      height: Number(saved.height) || DEFAULT_STATE.height,
      isMaximized: saved.isMaximized === true
    }
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const candidate = { ...state, x: saved.x, y: saved.y }
      if (isVisibleOnSomeDisplay(candidate)) return candidate
    }
    return state
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/** Persists bounds whenever the window is moved/resized/closed. */
function trackWindowState (win) {
  let timer = null

  const save = () => {
    if (win.isDestroyed()) return
    const bounds = win.getNormalBounds()
    const state = { ...bounds, isMaximized: win.isMaximized() }
    try {
      fs.writeFileSync(statePath(), JSON.stringify(state))
    } catch (error) {
      console.error('Unable to save window state:', error)
    }
  }

  const debouncedSave = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  }

  win.on('resize', debouncedSave)
  win.on('move', debouncedSave)
  win.on('close', () => {
    clearTimeout(timer)
    save()
  })
}

module.exports = { loadWindowState, trackWindowState }
