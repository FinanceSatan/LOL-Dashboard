import type {
  Account,
  AppInfo,
  ChampSelectState,
  ChampionDetail,
  Goal,
  JournalEntry,
  LcuStatus,
  Leaderboard,
  LiveClientState,
  PlatformId,
  ProfileData,
  RoutineDay,
  RunePage,
  ScoutResult,
  Settings,
  StaticData,
  SyncProgress,
  SyncResult,
  UpdateStatus
} from './types'

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

/** The API exposed by the preload script as `window.api`. */
export interface RiftApi {
  appInfo(): Promise<AppInfo>

  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>
  setApiKey(key: string | null): Promise<Result<Settings>>

  resolveAccount(gameName: string, tagLine: string, platform: PlatformId): Promise<Result<Account>>
  detectAccountFromClient(): Promise<Result<Account>>
  addAccount(account: Account): Promise<Settings>
  removeAccount(puuid: string): Promise<Settings>
  setActiveAccount(puuid: string): Promise<Settings>
  useDemo(): Promise<Settings>

  loadProfileData(): Promise<ProfileData | null>
  sync(options?: { older?: number }): Promise<SyncResult>
  saveJournal(entries: JournalEntry[]): Promise<void>
  saveGoals(goals: Goal[]): Promise<void>
  saveRoutine(days: RoutineDay[]): Promise<void>

  getStaticData(): Promise<Result<StaticData>>
  getChampionDetail(id: string): Promise<Result<ChampionDetail>>

  scoutLiveGame(target?: { gameName: string; tagLine: string }): Promise<Result<ScoutResult | null>>
  getLeaderboard(): Promise<Result<Leaderboard>>
  getTopMasteries(): Promise<Result<{ championId: number; championPoints: number; championLevel: number }[]>>

  getLcuStatus(): Promise<LcuStatus>
  pushRunePage(page: RunePage, name: string): Promise<Result>
  previewOverlay(): Promise<void>

  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<UpdateStatus>
  downloadUpdate(): Promise<UpdateStatus>
  installUpdate(): Promise<void>

  exportData(): Promise<Result<string>>
  importData(): Promise<Result>
  clearCache(): Promise<void>
  openExternal(url: string): Promise<void>
  openDataFolder(): Promise<void>

  on(channel: 'sync:progress', cb: (p: SyncProgress) => void): () => void
  on(channel: 'sync:done', cb: (r: SyncResult & { auto: boolean }) => void): () => void
  on(channel: 'lcu:status', cb: (s: LcuStatus) => void): () => void
  on(channel: 'lcu:champselect', cb: (s: ChampSelectState | null) => void): () => void
  on(channel: 'live:update', cb: (s: LiveClientState) => void): () => void
  on(channel: 'navigate', cb: (path: string) => void): () => void
  on(channel: 'settings:changed', cb: (s: Settings) => void): () => void
  on(channel: 'update:status', cb: (s: UpdateStatus) => void): () => void
}

export const EVENT_CHANNELS = [
  'sync:progress',
  'sync:done',
  'lcu:status',
  'lcu:champselect',
  'live:update',
  'navigate',
  'settings:changed',
  'update:status'
] as const
