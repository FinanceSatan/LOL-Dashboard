import { create } from 'zustand'
import type {
  ChampSelectState,
  Goal,
  JournalEntry,
  LcuStatus,
  LiveClientState,
  ProfileData,
  RoutineDay,
  Settings,
  StaticData,
  SyncProgress,
  SyncResult,
  UpdateStatus
} from '@shared/types'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error' | 'warn'
  text: string
}

interface AppState {
  ready: boolean
  settings: Settings | null
  data: ProfileData | null
  staticData: StaticData | null
  staticError: string | null
  /** championId → name collected from match data (fallback when Data Dragon is unreachable) */
  champNames: Record<number, string>
  lcu: LcuStatus
  champSelect: ChampSelectState | null
  live: LiveClientState | null
  syncing: boolean
  progress: SyncProgress | null
  update: UpdateStatus | null
  appVersion: string
  toasts: Toast[]
  init: () => Promise<void>
  reloadData: () => Promise<void>
  loadStatic: () => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<Settings>
  setSettings: (s: Settings) => void
  runSync: (opts?: { older?: number }) => Promise<SyncResult>
  setJournal: (entries: JournalEntry[]) => void
  setGoals: (goals: Goal[]) => void
  setRoutine: (days: RoutineDay[]) => void
  toast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
}

let toastId = 0
let listenersBound = false

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  settings: null,
  data: null,
  staticData: null,
  staticError: null,
  champNames: {},
  lcu: { connected: false, phase: 'None' },
  champSelect: null,
  live: null,
  syncing: false,
  progress: null,
  update: null,
  appVersion: '',
  toasts: [],

  init: async () => {
    const api = window.api
    if (!listenersBound) {
      listenersBound = true
      api.on('sync:progress', (p) => set({ progress: p, syncing: p.stage !== 'done' && p.stage !== 'error' }))
      api.on('sync:done', (r) => {
        set({ syncing: false })
        if (r.ok && (r.newMatches > 0 || !r.auto)) void get().reloadData()
        if (r.auto && r.ok && r.newMatches > 0) window.dispatchEvent(new CustomEvent('rift:new-games', { detail: r.newMatches }))
      })
      api.on('lcu:status', (s) => set({ lcu: s }))
      api.on('lcu:champselect', (s) => set({ champSelect: s }))
      api.on('live:update', (s) => set({ live: s.active ? s : null }))
      api.on('settings:changed', async () => set({ settings: await api.getSettings() }))
      api.on('update:status', (u) => set({ update: u }))
    }
    const [settings, lcu, update, info] = await Promise.all([
      api.getSettings(),
      api.getLcuStatus(),
      api.getUpdateStatus(),
      api.appInfo()
    ])
    set({ settings, lcu, update, appVersion: info.version })
    void get().loadStatic()
    await get().reloadData()
    set({ ready: true })
  },

  reloadData: async () => {
    const data = await window.api.loadProfileData()
    const champNames: Record<number, string> = { ...get().champNames }
    for (const m of data?.matches ?? []) {
      for (const p of m.participants) if (p.championName) champNames[p.championId] = p.championName
    }
    set({ data, champNames })
  },

  loadStatic: async () => {
    const res = await window.api.getStaticData()
    if (res.ok) set({ staticData: res.data, staticError: null })
    else set({ staticError: res.error })
  },

  saveSettings: async (patch) => {
    const settings = await window.api.saveSettings(patch)
    set({ settings })
    return settings
  },

  setSettings: (settings) => set({ settings }),

  runSync: async (opts) => {
    set({ syncing: true, progress: { stage: 'profile', done: 0, total: 1 } })
    const res = await window.api.sync(opts)
    set({ syncing: false })
    return res
  },

  setJournal: (entries) => {
    const data = get().data
    if (!data) return
    set({ data: { ...data, journal: entries } })
    void window.api.saveJournal(entries)
  },

  setGoals: (goals) => {
    const data = get().data
    if (!data) return
    set({ data: { ...data, goals } })
    void window.api.saveGoals(goals)
  },

  setRoutine: (days) => {
    const data = get().data
    if (!data) return
    set({ data: { ...data, routine: days } })
    void window.api.saveRoutine(days)
  },

  toast: (text, kind = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, kind, text }] })
    setTimeout(() => get().dismissToast(id), 5000)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))
