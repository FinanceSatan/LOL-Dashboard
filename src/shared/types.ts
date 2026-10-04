// Types shared between the Electron main process, the preload bridge and the renderer.

export type Role = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'
export const ROLES: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export type Tier =
  | 'IRON'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'EMERALD'
  | 'DIAMOND'
  | 'MASTER'
  | 'GRANDMASTER'
  | 'CHALLENGER'

export type Division = 'I' | 'II' | 'III' | 'IV'

export type PlatformId =
  | 'euw1'
  | 'eun1'
  | 'na1'
  | 'kr'
  | 'jp1'
  | 'br1'
  | 'la1'
  | 'la2'
  | 'oc1'
  | 'tr1'
  | 'ru'
  | 'me1'
  | 'ph2'
  | 'sg2'
  | 'th2'
  | 'tw2'
  | 'vn2'

export type Language = 'fa' | 'en'
export type DataSource = 'riot' | 'client'

export interface Account {
  puuid: string
  gameName: string
  tagLine: string
  platform: PlatformId
  profileIconId?: number
  summonerLevel?: number
  demo?: boolean
}

export interface RankEntry {
  queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' | string
  tier: Tier
  rank: Division
  leaguePoints: number
  wins: number
  losses: number
  hotStreak?: boolean
  veteran?: boolean
  freshBlood?: boolean
  miniSeries?: { progress: string; target: number; wins: number; losses: number }
}

export interface RankSnapshot {
  t: number // epoch ms
  queueType: string
  tier: Tier
  rank: Division
  lp: number
  wins: number
  losses: number
}

export interface Profile {
  account: Account
  ranks: RankEntry[]
  fetchedAt: number
}

export interface PlayerLine {
  puuid: string
  name: string // gameName#tag (or summoner name)
  championId: number
  championName: string
  teamId: 100 | 200
  role: Role | ''
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  damageTaken: number
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
  controlWards: number
  level: number
  items: number[] // 7 slots, 0 = empty
  spells: [number, number]
  keystone: number
  primaryStyle: number
  subStyle: number
  win: boolean
}

export interface RunePage {
  primaryStyle: number
  subStyle: number
  perks: number[] // 6 selections (4 primary + 2 secondary)
  statPerks: number[] // offense, flex, defense
}

export interface LaningStats {
  csAt10: number
  csAt15: number
  goldAt10: number
  goldAt15: number
  xpAt10: number
  xpAt15: number
  csDiffAt10: number | null
  csDiffAt15: number | null
  goldDiffAt10: number | null
  goldDiffAt15: number | null
  xpDiffAt10: number | null
  xpDiffAt15: number | null
  deathsBefore10: number
  deathsBefore14: number
  killsBefore14: number
  firstBloodInvolved: boolean
}

export interface MapEvent {
  t: number // seconds
  x: number
  y: number
}

export interface ObjectiveEvent {
  t: number // seconds
  type: 'DRAGON' | 'BARON' | 'HERALD' | 'HORDE' | 'ATAKHAN' | 'TOWER' | 'INHIBITOR' | 'ELDER'
  subType?: string
  team: 100 | 200 // team that secured it
}

export interface TimelinePoint {
  minute: number
  teamGoldDiff: number // my team minus enemy team
  myGold: number
  oppGold: number | null
  myCs: number
  oppCs: number | null
  myXp: number
}

export interface MyStats extends PlayerLine {
  killParticipation: number // 0..1
  damageShare: number // 0..1
  goldShare: number // 0..1
  csPerMin: number
  goldPerMin: number
  dpm: number
  visionPerMin: number
  kda: number
  timeDead: number // seconds
  soloKills: number | null
  skillshotsHit: number | null
  skillshotsDodged: number | null
  turretPlates: number | null
  damageToObjectives: number
  damageToBuildings: number
  objectiveTakedowns: number // dragons+barons+heralds taken part in
  largestMultiKill: number
  firstBloodKill: boolean
  firstTowerKill: boolean
  runes: RunePage | null
  skillOrder: string // e.g. "QWEQQRQWQWRWWEEREE"
  itemPurchases: { t: number; id: number }[]
}

export interface MatchSummary {
  matchId: string
  platform: string
  queueId: number
  gameCreation: number // epoch ms
  gameDuration: number // seconds
  gameVersion: string
  remake: boolean
  surrender: boolean
  win: boolean
  side: 'blue' | 'red'
  me: MyStats
  opponent: PlayerLine | null
  participants: PlayerLine[]
  bans: { teamId: 100 | 200; championId: number }[]
  laning: LaningStats | null
  timeline: TimelinePoint[]
  deaths: MapEvent[]
  kills: MapEvent[]
  objectives: ObjectiveEvent[]
  teamStats: {
    myTeam: TeamObjectives
    enemyTeam: TeamObjectives
  }
  source: 'riot' | 'client' | 'demo'
}

export interface TeamObjectives {
  kills: number
  dragons: number
  barons: number
  heralds: number
  hordes: number
  towers: number
  inhibitors: number
  firstDragon: boolean
  firstTower: boolean
  firstBlood: boolean
}

export interface JournalEntry {
  id: string
  createdAt: number
  matchId?: string
  championId?: number
  win?: boolean
  mental: number // 1..5
  tags: string[]
  went_well: string
  improve: string
  notes: string
  reviewed: boolean
}

export type GoalComparator = 'gte' | 'lte'

export interface Goal {
  id: string
  metric: string // MetricKey
  comparator: GoalComparator
  target: number
  window: number // last N games
  createdAt: number
  active: boolean
}

export interface RoutineDay {
  date: string // YYYY-MM-DD
  done: string[] // routine item ids
}

export interface ProfileData {
  account: Account
  profile: Profile | null
  matches: MatchSummary[]
  rankHistory: RankSnapshot[]
  journal: JournalEntry[]
  goals: Goal[]
  routine: RoutineDay[]
  lastSync: number | null
}

export interface OverlaySettings {
  enabled: boolean
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'middle-right'
  opacity: number // 0.3..1
  scale: number // 0.8..1.4
  showTimers: boolean
  showCsPace: boolean
}

export interface Settings {
  language: Language
  dataSource: DataSource
  accounts: Account[]
  activePuuid: string | null
  hasApiKey: boolean
  apiKeyHint: string // last 4 chars
  apiKeySetAt: number | null
  targetTier: Tier
  mainRole: Role | 'AUTO'
  analysisQueues: 'solo' | 'ranked' | 'all'
  analysisWindow: number // games
  initialSyncCount: number
  autoSyncAfterGame: boolean
  autoAccept: boolean
  autoAcceptDelay: number // seconds
  openChampSelect: boolean
  leaguePath: string
  overlay: OverlaySettings
  tilt: {
    enabled: boolean
    lossStreak: number
    maxGamesPerDay: number
    notify: boolean
  }
  minimizeToTray: boolean
  proxy: string
  csTargetPerMin: number
  autoUpdate: boolean
  onboarded: boolean
}

export type UpdateState =
  | 'disabled' // development build
  | 'idle'
  | 'checking'
  | 'none' // up to date
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatus {
  state: UpdateState
  currentVersion: string
  version?: string
  notes?: string
  progress?: number // 0..100
  error?: string
  checkedAt?: number
  /** portable exe: updates are downloaded manually from the release page */
  portable: boolean
  releaseUrl: string
}

export interface SyncProgress {
  stage: 'profile' | 'ids' | 'matches' | 'done' | 'error'
  done: number
  total: number
  message?: string
}

export interface SyncResult {
  ok: boolean
  newMatches: number
  error?: string
}

// ----- League client (LCU) -----

export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'CheckedIntoTournament'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'FailedToLaunch'
  | 'InProgress'
  | 'Reconnect'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | 'TerminatedInError'
  | string

export interface LcuStatus {
  connected: boolean
  phase: GameflowPhase
  summoner?: { gameName: string; tagLine: string; puuid: string; region?: string }
  lastAutoAccept?: number
}

export interface ChampSelectPlayer {
  cellId: number
  championId: number
  championPickIntent: number
  assignedPosition: string
  summonerName?: string
  puuid?: string
  spell1Id?: number
  spell2Id?: number
  isMe: boolean
}

export interface ChampSelectState {
  localPlayerCellId: number
  myTeam: ChampSelectPlayer[]
  theirTeam: ChampSelectPlayer[]
  bans: { myTeam: number[]; theirTeam: number[] }
  phase: string
  timeLeftMs: number
  queueId?: number
}

// ----- Live game (Live Client Data API / spectator) -----

export interface LivePlayer {
  name: string
  championName: string
  championId?: number
  team: 'ORDER' | 'CHAOS'
  level: number
  kills: number
  deaths: number
  assists: number
  cs: number
  wardScore: number
  items: number[]
  position: string
  isMe: boolean
  isDead: boolean
  respawnTimer: number
}

export interface LiveObjectiveTimer {
  key: string // dragon / baron / herald / grubs / atakhan / inhib-...
  label: string
  team?: 'ORDER' | 'CHAOS'
  respawnAt: number // game seconds
}

export interface LiveClientState {
  active: boolean
  gameTime: number
  gameMode: string
  me?: {
    name: string
    championName: string
    level: number
    currentGold: number
    cs: number
    kills: number
    deaths: number
    assists: number
    team: 'ORDER' | 'CHAOS'
  }
  players: LivePlayer[]
  timers: LiveObjectiveTimer[]
  teamKills: { ORDER: number; CHAOS: number }
  dragons: { ORDER: string[]; CHAOS: string[] }
}

export interface ScoutPlayer {
  puuid: string
  name: string
  championId: number
  teamId: 100 | 200
  spells: [number, number]
  keystone?: number
  isMe: boolean
  solo?: RankEntry | null
  flex?: RankEntry | null
  masteryPoints?: number | null
  masteryLevel?: number | null
  error?: string
}

export interface ScoutResult {
  gameId: number | string
  queueId: number
  gameStart: number
  players: ScoutPlayer[]
  bans: { teamId: number; championId: number }[]
  source: 'riot' | 'client' | 'demo'
}

export interface LeaderboardEntry {
  puuid: string
  name?: string
  lp: number
  wins: number
  losses: number
  tier: Tier
  hotStreak: boolean
}

export interface Leaderboard {
  platform: PlatformId
  queue: string
  fetchedAt: number
  entries: LeaderboardEntry[]
  cutoffs: { challenger: number | null; grandmaster: number | null; master: number }
}

// ----- Data Dragon -----

export interface DDChampion {
  id: string // "Ahri"
  key: number // 103
  name: string
  title: string
  tags: string[]
  info: { attack: number; defense: number; magic: number; difficulty: number }
  partype: string
}

export interface DDItem {
  id: number
  name: string
  plaintext: string
  description: string
  gold: { total: number; base: number; purchasable: boolean }
  tags: string[]
  into: string[]
  from: string[]
  depth?: number
}

export interface DDRune {
  id: number
  key: string
  name: string
  icon: string
  shortDesc: string
}

export interface DDRuneStyle {
  id: number
  key: string
  name: string
  icon: string
  slots: { runes: DDRune[] }[]
}

export interface DDSummonerSpell {
  id: string
  key: number
  name: string
  cooldown: number
  image: string
}

export interface StaticData {
  version: string
  champions: Record<number, DDChampion>
  items: Record<number, DDItem>
  runes: DDRuneStyle[]
  spells: Record<number, DDSummonerSpell>
}

export interface DDSpell {
  id: string
  name: string
  description: string
  cooldownBurn: string
  costBurn: string
  rangeBurn: string
  image: string
  maxrank: number
}

export interface ChampionDetail {
  id: string
  key: number
  name: string
  title: string
  lore: string
  allytips: string[]
  enemytips: string[]
  tags: string[]
  stats: Record<string, number>
  passive: { name: string; description: string; image: string }
  spells: DDSpell[]
}

export interface ApiError {
  ok: false
  error: string
  status?: number
}

export interface AppInfo {
  version: string
  platform: string
  dataPath: string
}
