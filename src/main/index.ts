import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, session, shell } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { platformFromClientRegion } from '@shared/constants'
import { DEMO_ACCOUNT } from '@shared/demo'
import type { Result } from '@shared/api'
import type { Account, Goal, JournalEntry, PlatformId, RoutineDay, RunePage, Settings } from '@shared/types'
import icon from '../../resources/icon.png?asset'
import { ClientWatcher } from './lcu/watcher'
import { destroyOverlay, sendOverlaySettings, updateOverlay } from './overlay'
import { getChampionDetail, getStaticData } from './riot/ddragon'
import {
  activeAccount,
  clearCaches,
  exportAll,
  getApiKey,
  getDataPath,
  getSettings,
  importAll,
  loadProfileData,
  removeAccount,
  saveProfileData,
  setApiKey,
  updateSettings,
  upsertAccount
} from './store'
import { errorCode, getLeaderboard, riot, scoutLiveGame, syncActive } from './sync'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  initUpdater,
  installUpdate,
  setAutoDownload,
  stopUpdater
} from './updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

function emit(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
  if (channel === 'live:update') updateOverlay(getSettings().overlay, payload as never)
}

const watcher = new ClientWatcher(emit, () => {
  const s = getSettings()
  if (!s.autoSyncAfterGame) return
  const delays = s.dataSource === 'client' ? [20000, 90000] : [75000, 240000]
  for (const d of delays) setTimeout(() => void syncActive(emit, () => watcher.lcu, { auto: true }), d)
})

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return { ok: false, error: errorCode(err) }
  }
}

function applyProxy(proxy: string): void {
  const rules = proxy.trim()
  void session.defaultSession.setProxy(rules ? { proxyRules: rules } : { mode: 'system' })
}

function createWindow(): void {
  const settings = getSettings()
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b0f17',
    title: 'Rift Coach',
    icon,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0f17', symbolColor: '#c8cfdb', height: 40 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (e) => {
    if (!quitting && getSettings().minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()
      ensureTray()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env['ELECTRON_RENDERER_URL']) void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  if (settings.minimizeToTray) ensureTray()
}

function ensureTray(): void {
  if (tray) return
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
  tray.setToolTip('Rift Coach')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Rift Coach', click: () => mainWindow?.show() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => mainWindow?.show())
}

function registerIpc(): void {
  ipcMain.handle('appInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    dataPath: getDataPath()
  }))

  ipcMain.handle('getSettings', () => getSettings())
  ipcMain.handle('saveSettings', (_e, patch: Partial<Settings>) => {
    const before = getSettings()
    const next = updateSettings(patch)
    if (patch.proxy !== undefined && patch.proxy !== before.proxy) applyProxy(next.proxy)
    if (patch.overlay) {
      updateOverlay(next.overlay, null)
      sendOverlaySettings()
    }
    if (patch.minimizeToTray) ensureTray()
    if (patch.autoUpdate !== undefined) setAutoDownload(next.autoUpdate)
    return next
  })
  ipcMain.handle('setApiKey', async (_e, key: string | null) =>
    wrap(async () => {
      const clean = key?.trim() || null
      if (clean && !/^RGAPI-[0-9a-f-]{36}$/i.test(clean)) throw new Error('INVALID_KEY_FORMAT')
      const previous = getApiKey()
      setApiKey(clean)
      if (clean) {
        // Validate the key with a cheap request.
        try {
          await riot.accountByRiotId('euw1', 'Riot', 'Key')
        } catch (err) {
          const code = errorCode(err)
          if (code === 'INVALID_API_KEY' || code.startsWith('NETWORK')) {
            setApiKey(previous)
            throw err
          }
        }
      }
      return getSettings()
    })
  )

  ipcMain.handle('resolveAccount', (_e, gameName: string, tagLine: string, platform: PlatformId) =>
    wrap(async () => {
      const acc = await riot.accountByRiotId(platform, gameName.trim(), tagLine.trim().replace(/^#/, ''))
      const summoner = await riot.summonerByPuuid(platform, acc.puuid)
      const account: Account = {
        puuid: acc.puuid,
        gameName: acc.gameName,
        tagLine: acc.tagLine,
        platform,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel
      }
      return account
    })
  )
  ipcMain.handle('detectAccountFromClient', () =>
    wrap(async () => {
      const lcu = watcher.lcu
      if (!lcu) throw new Error('CLIENT_NOT_RUNNING')
      const me = await lcu.get<any>('/lol-summoner/v1/current-summoner')
      const region = await lcu.get<any>('/riotclient/region-locale').catch(() => null)
      const platform = platformFromClientRegion(String(region?.region ?? '')) ?? 'euw1'
      const account: Account = {
        puuid: me.puuid,
        gameName: me.gameName ?? me.displayName,
        tagLine: me.tagLine ?? '',
        platform,
        profileIconId: me.profileIconId,
        summonerLevel: me.summonerLevel
      }
      return account
    })
  )
  ipcMain.handle('addAccount', (_e, acc: Account) => upsertAccount(acc, true))
  ipcMain.handle('removeAccount', (_e, puuid: string) => removeAccount(puuid))
  ipcMain.handle('setActiveAccount', (_e, puuid: string) => updateSettings({ activePuuid: puuid }))
  ipcMain.handle('useDemo', () => upsertAccount({ ...DEMO_ACCOUNT }, true))

  ipcMain.handle('loadProfileData', () => {
    const acc = activeAccount()
    return acc ? loadProfileData(acc) : null
  })
  ipcMain.handle('sync', (_e, options?: { older?: number }) => syncActive(emit, () => watcher.lcu, options ?? {}))
  ipcMain.handle('saveJournal', (_e, entries: JournalEntry[]) => {
    const acc = activeAccount()
    if (!acc) return
    const data = loadProfileData(acc)
    data.journal = entries
    saveProfileData(data)
  })
  ipcMain.handle('saveGoals', (_e, goals: Goal[]) => {
    const acc = activeAccount()
    if (!acc) return
    const data = loadProfileData(acc)
    data.goals = goals
    saveProfileData(data)
  })
  ipcMain.handle('saveRoutine', (_e, days: RoutineDay[]) => {
    const acc = activeAccount()
    if (!acc) return
    const data = loadProfileData(acc)
    data.routine = days.slice(-120)
    saveProfileData(data)
  })

  ipcMain.handle('getStaticData', () => wrap(() => getStaticData()))
  ipcMain.handle('getChampionDetail', (_e, id: string) => wrap(() => getChampionDetail(id)))

  ipcMain.handle('scoutLiveGame', (_e, target?: { gameName: string; tagLine: string }) =>
    wrap(() => scoutLiveGame(() => watcher.lcu, target))
  )
  ipcMain.handle('getLeaderboard', () => wrap(() => getLeaderboard()))
  ipcMain.handle('getTopMasteries', () =>
    wrap(async () => {
      const acc = activeAccount()
      if (!acc || acc.demo || !getSettings().hasApiKey) return []
      return riot.topMasteries(acc.platform, acc.puuid, 12)
    })
  )

  ipcMain.handle('getLcuStatus', () => watcher.status)
  ipcMain.handle('pushRunePage', (_e, page: RunePage, name: string) =>
    wrap(async () => {
      await watcher.pushRunePage(page, name)
      return undefined
    })
  )
  ipcMain.handle('getUpdateStatus', () => getUpdateStatus())
  ipcMain.handle('checkForUpdates', () => checkForUpdates())
  ipcMain.handle('downloadUpdate', () => downloadUpdate())
  ipcMain.handle('installUpdate', () => {
    quitting = true
    installUpdate()
  })

  ipcMain.handle('previewOverlay', () => {
    if (!getSettings().overlay.enabled) updateSettings({ overlay: { ...getSettings().overlay, enabled: true } })
    watcher.previewOverlay()
  })

  ipcMain.handle('exportData', () =>
    wrap(async () => {
      const res = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: `rift-coach-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePath) throw new Error('CANCELLED')
      writeFileSync(res.filePath, JSON.stringify(exportAll(), null, 1))
      return res.filePath
    })
  )
  ipcMain.handle('importData', () =>
    wrap(async () => {
      const res = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePaths[0]) throw new Error('CANCELLED')
      importAll(JSON.parse(readFileSync(res.filePaths[0], 'utf8')))
      return undefined
    })
  )
  ipcMain.handle('clearCache', () => clearCaches())
  ipcMain.handle('openExternal', (_e, url: string) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle('openDataFolder', () => shell.openPath(getDataPath()))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.riftcoach.app')
    Menu.setApplicationMenu(null)
    applyProxy(getSettings().proxy)
    registerIpc()
    createWindow()
    watcher.start()
    initUpdater(emit, getSettings().autoUpdate)
  })

  app.on('before-quit', () => {
    quitting = true
    watcher.stop()
    stopUpdater()
    destroyOverlay()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
