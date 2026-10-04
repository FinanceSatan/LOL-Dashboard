import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Account, ProfileData, Settings } from '@shared/types'
import { generateDemoProfileData, DEMO_PUUID } from '@shared/demo'

interface StoredSettings extends Omit<Settings, 'hasApiKey' | 'apiKeyHint'> {
  apiKeyEnc: string | null
  apiKeyPlain?: boolean
}

export const DEFAULT_SETTINGS: StoredSettings = {
  language: 'fa',
  dataSource: 'riot',
  accounts: [],
  activePuuid: null,
  apiKeyEnc: null,
  apiKeySetAt: null,
  targetTier: 'CHALLENGER',
  mainRole: 'AUTO',
  analysisQueues: 'solo',
  analysisWindow: 30,
  initialSyncCount: 60,
  autoSyncAfterGame: true,
  autoAccept: false,
  autoAcceptDelay: 2,
  openChampSelect: true,
  leaguePath: 'C:\\Riot Games\\League of Legends',
  overlay: {
    enabled: false,
    position: 'middle-right',
    opacity: 0.85,
    scale: 1,
    showTimers: true,
    showCsPace: true
  },
  tilt: { enabled: true, lossStreak: 3, maxGamesPerDay: 8, notify: true },
  minimizeToTray: false,
  proxy: '',
  csTargetPerMin: 8,
  autoUpdate: true,
  onboarded: false
}

function dataDir(): string {
  const dir = join(app.getPath('userData'), 'rift-data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function profilesDir(): string {
  const dir = join(dataDir(), 'profiles')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function cacheDir(name: string): string {
  const dir = join(dataDir(), 'cache', name)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getDataPath(): string {
  return dataDir()
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch (err) {
    console.error('Failed to read', file, err)
    // keep a copy of the broken file so data is never silently lost
    try {
      renameSync(file, `${file}.broken-${Date.now()}`)
    } catch {
      /* ignore */
    }
    return fallback
  }
}

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data), 'utf8')
  renameSync(tmp, file)
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

let settingsCache: StoredSettings | null = null

function settingsFile(): string {
  return join(dataDir(), 'settings.json')
}

function loadStored(): StoredSettings {
  if (!settingsCache) {
    const raw = readJson<Partial<StoredSettings>>(settingsFile(), {})
    settingsCache = {
      ...DEFAULT_SETTINGS,
      ...raw,
      overlay: { ...DEFAULT_SETTINGS.overlay, ...(raw.overlay ?? {}) },
      tilt: { ...DEFAULT_SETTINGS.tilt, ...(raw.tilt ?? {}) }
    }
  }
  return settingsCache
}

function persistSettings(): void {
  if (settingsCache) writeJsonAtomic(settingsFile(), settingsCache)
}

// decrypted key kept in memory so frequent settings reads don't hit DPAPI every time
let apiKeyCache: string | null | undefined

export function getApiKey(): string | null {
  if (apiKeyCache !== undefined) return apiKeyCache
  const s = loadStored()
  if (!s.apiKeyEnc) return (apiKeyCache = null)
  try {
    apiKeyCache = s.apiKeyPlain
      ? Buffer.from(s.apiKeyEnc, 'base64').toString('utf8')
      : safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64'))
  } catch (err) {
    console.error('Could not decrypt API key', err)
    apiKeyCache = null
  }
  return apiKeyCache
}

export function setApiKey(key: string | null): void {
  apiKeyCache = undefined
  const s = loadStored()
  if (!key) {
    s.apiKeyEnc = null
    s.apiKeySetAt = null
  } else if (safeStorage.isEncryptionAvailable()) {
    s.apiKeyEnc = safeStorage.encryptString(key).toString('base64')
    s.apiKeyPlain = false
    s.apiKeySetAt = Date.now()
  } else {
    s.apiKeyEnc = Buffer.from(key, 'utf8').toString('base64')
    s.apiKeyPlain = true
    s.apiKeySetAt = Date.now()
  }
  persistSettings()
}

export function getSettings(): Settings {
  const { apiKeyEnc, apiKeyPlain: _plain, ...rest } = loadStored()
  const key = apiKeyEnc ? getApiKey() : null
  return {
    ...rest,
    hasApiKey: Boolean(key),
    apiKeyHint: key ? key.slice(-4) : ''
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = loadStored()
  const { hasApiKey: _h, apiKeyHint: _k, ...clean } = patch
  Object.assign(s, clean)
  if (patch.overlay) s.overlay = { ...s.overlay, ...patch.overlay }
  if (patch.tilt) s.tilt = { ...s.tilt, ...patch.tilt }
  persistSettings()
  return getSettings()
}

export function activeAccount(): Account | null {
  const s = loadStored()
  return s.accounts.find((a) => a.puuid === s.activePuuid) ?? s.accounts[0] ?? null
}

export function upsertAccount(acc: Account, makeActive = true): Settings {
  const s = loadStored()
  const idx = s.accounts.findIndex((a) => a.puuid === acc.puuid)
  if (idx >= 0) s.accounts[idx] = { ...s.accounts[idx], ...acc }
  else s.accounts.push(acc)
  if (makeActive) s.activePuuid = acc.puuid
  persistSettings()
  return getSettings()
}

export function removeAccount(puuid: string): Settings {
  const s = loadStored()
  s.accounts = s.accounts.filter((a) => a.puuid !== puuid)
  if (s.activePuuid === puuid) s.activePuuid = s.accounts[0]?.puuid ?? null
  persistSettings()
  const file = profileFile(puuid)
  if (existsSync(file)) rmSync(file)
  return getSettings()
}

// ---------------------------------------------------------------------------
// Profile data (matches, rank history, journal, goals …)
// ---------------------------------------------------------------------------

const profileCache = new Map<string, ProfileData>()

function profileFile(puuid: string): string {
  return join(profilesDir(), `${puuid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.json`)
}

export function loadProfileData(account: Account): ProfileData {
  if (account.puuid === DEMO_PUUID) {
    let demo = profileCache.get(DEMO_PUUID)
    if (!demo) {
      demo = generateDemoProfileData()
      // keep user edits (journal/goals) for the demo account across restarts
      const saved = readJson<Partial<ProfileData> | null>(profileFile(DEMO_PUUID), null)
      if (saved?.journal) demo.journal = saved.journal
      if (saved?.goals) demo.goals = saved.goals
      if (saved?.routine) demo.routine = saved.routine
      profileCache.set(DEMO_PUUID, demo)
    }
    return demo
  }
  let data = profileCache.get(account.puuid)
  if (!data) {
    const raw = readJson<Partial<ProfileData>>(profileFile(account.puuid), {})
    data = {
      account,
      profile: raw.profile ?? null,
      matches: raw.matches ?? [],
      rankHistory: raw.rankHistory ?? [],
      journal: raw.journal ?? [],
      goals: raw.goals ?? [],
      routine: raw.routine ?? [],
      lastSync: raw.lastSync ?? null
    }
    profileCache.set(account.puuid, data)
  }
  data.account = account
  return data
}

export function saveProfileData(data: ProfileData): void {
  profileCache.set(data.account.puuid, data)
  if (data.account.puuid === DEMO_PUUID) {
    writeJsonAtomic(profileFile(DEMO_PUUID), { journal: data.journal, goals: data.goals, routine: data.routine })
    return
  }
  writeJsonAtomic(profileFile(data.account.puuid), data)
}

export function exportAll(): object {
  const profiles: Record<string, unknown> = {}
  for (const f of readdirSync(profilesDir())) {
    if (f.endsWith('.json')) profiles[f] = readJson(join(profilesDir(), f), null)
  }
  const { apiKeyEnc: _k, apiKeyPlain: _p, ...settings } = loadStored()
  return { app: 'rift-coach', version: 1, exportedAt: Date.now(), settings, profiles }
}

export function importAll(payload: unknown): void {
  const p = payload as { app?: string; settings?: Partial<StoredSettings>; profiles?: Record<string, unknown> }
  if (!p || p.app !== 'rift-coach') throw new Error('Not a Rift Coach backup file')
  if (p.settings) {
    apiKeyCache = undefined
    const s = loadStored()
    const keep = { apiKeyEnc: s.apiKeyEnc, apiKeyPlain: s.apiKeyPlain, apiKeySetAt: s.apiKeySetAt }
    settingsCache = { ...DEFAULT_SETTINGS, ...p.settings, ...keep } as StoredSettings
    persistSettings()
  }
  for (const [file, data] of Object.entries(p.profiles ?? {})) {
    if (/^[\w-]+\.json$/.test(file) && data) writeJsonAtomic(join(profilesDir(), file), data)
  }
  profileCache.clear()
}

export function clearCaches(): void {
  const dir = join(dataDir(), 'cache')
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
