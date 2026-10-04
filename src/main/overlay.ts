import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { LiveClientState, OverlaySettings } from '@shared/types'

let overlay: BrowserWindow | null = null
let lastLive: LiveClientState | null = null

const BASE_W = 270
const BASE_H = 250

function place(win: BrowserWindow, s: OverlaySettings): void {
  const area = screen.getPrimaryDisplay().workArea
  const w = Math.round(BASE_W * s.scale)
  const h = Math.round(BASE_H * s.scale)
  const m = 12
  const pos = {
    'top-left': { x: area.x + m, y: area.y + 80 },
    'top-right': { x: area.x + area.width - w - m, y: area.y + 80 },
    'bottom-left': { x: area.x + m, y: area.y + area.height - h - 260 },
    'bottom-right': { x: area.x + area.width - w - m, y: area.y + area.height - h - 300 },
    'middle-right': { x: area.x + area.width - w - m, y: area.y + Math.round(area.height / 2 - h / 2) }
  }[s.position]
  win.setBounds({ x: pos.x, y: pos.y, width: w, height: h })
}

function load(win: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/overlay`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/overlay' })
}

export function updateOverlay(settings: OverlaySettings, live: LiveClientState | null): void {
  if (live) lastLive = live
  const shouldShow = settings.enabled && Boolean(lastLive?.active)
  if (!shouldShow) {
    if (overlay && !overlay.isDestroyed()) overlay.hide()
    return
  }
  if (!overlay || overlay.isDestroyed()) {
    overlay = new BrowserWindow({
      width: BASE_W,
      height: BASE_H,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true
      }
    })
    overlay.setAlwaysOnTop(true, 'screen-saver')
    overlay.setIgnoreMouseEvents(true)
    overlay.setVisibleOnAllWorkspaces(true)
    load(overlay)
    overlay.webContents.once('did-finish-load', () => {
      if (lastLive) overlay?.webContents.send('live:update', lastLive)
    })
  }
  place(overlay, settings)
  overlay.setOpacity(Math.min(1, Math.max(0.3, settings.opacity)))
  if (!overlay.isVisible()) overlay.showInactive()
  if (live) overlay.webContents.send('live:update', live)
}

export function sendOverlaySettings(): void {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send('settings:changed', null)
}

export function destroyOverlay(): void {
  if (overlay && !overlay.isDestroyed()) overlay.destroy()
  overlay = null
}
