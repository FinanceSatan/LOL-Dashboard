import { contextBridge, ipcRenderer } from 'electron'
import { EVENT_CHANNELS, type RiftApi } from '@shared/api'

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const api: RiftApi = {
  appInfo: invoke('appInfo'),
  getSettings: invoke('getSettings'),
  saveSettings: invoke('saveSettings'),
  setApiKey: invoke('setApiKey'),
  resolveAccount: invoke('resolveAccount'),
  detectAccountFromClient: invoke('detectAccountFromClient'),
  addAccount: invoke('addAccount'),
  removeAccount: invoke('removeAccount'),
  setActiveAccount: invoke('setActiveAccount'),
  useDemo: invoke('useDemo'),
  loadProfileData: invoke('loadProfileData'),
  sync: invoke('sync'),
  saveJournal: invoke('saveJournal'),
  saveGoals: invoke('saveGoals'),
  saveRoutine: invoke('saveRoutine'),
  getStaticData: invoke('getStaticData'),
  getChampionDetail: invoke('getChampionDetail'),
  scoutLiveGame: invoke('scoutLiveGame'),
  getLeaderboard: invoke('getLeaderboard'),
  getTopMasteries: invoke('getTopMasteries'),
  getLcuStatus: invoke('getLcuStatus'),
  pushRunePage: invoke('pushRunePage'),
  previewOverlay: invoke('previewOverlay'),
  exportData: invoke('exportData'),
  importData: invoke('importData'),
  clearCache: invoke('clearCache'),
  openExternal: invoke('openExternal'),
  openDataFolder: invoke('openDataFolder'),
  on: ((channel: string, cb: (payload: unknown) => void) => {
    if (!(EVENT_CHANNELS as readonly string[]).includes(channel)) throw new Error(`Unknown channel ${channel}`)
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }) as RiftApi['on']
} as RiftApi

contextBridge.exposeInMainWorld('api', api)
