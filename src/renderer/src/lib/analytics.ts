// Pure analytics over normalized match summaries.
import { MAP_BOUNDS, QUEUES, absoluteLp, isSummonersRift } from '@shared/constants'
import type { MatchSummary, RankSnapshot, Role, RunePage, Settings, StaticData, Tier } from '@shared/types'
import { METRICS, type MetricKey, isLegendary, metricScore } from './metrics'

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)
export const stdev = (xs: number[]): number => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

export function filterForAnalysis(matches: MatchSummary[], queues: Settings['analysisQueues']): MatchSummary[] {
  return matches.filter((m) => {
    if (m.remake || !isSummonersRift(m.queueId)) return false
    if (queues === 'solo') return m.queueId === 420
    if (queues === 'ranked') return QUEUES[m.queueId]?.ranked === true
    return true
  })
}

export function winrate(matches: MatchSummary[]): number {
  return matches.length ? matches.filter((m) => m.win).length / matches.length : NaN
}

export function mainRole(matches: MatchSummary[], override: Settings['mainRole'] = 'AUTO'): Role {
  if (override !== 'AUTO') return override
  const counts = new Map<Role, number>()
  for (const m of matches.slice(0, 50)) {
    if (m.me.role) counts.set(m.me.role, (counts.get(m.me.role) ?? 0) + 1)
  }
  let best: Role = 'MIDDLE'
  let n = -1
  for (const [r, c] of counts)
    if (c > n) {
      best = r
      n = c
    }
  return best
}

export function metricValues(matches: MatchSummary[], key: MetricKey, items?: StaticData['items']): number[] {
  const out: number[] = []
  for (const m of matches) {
    const v = METRICS[key].get(m, items)
    if (v != null && Number.isFinite(v)) out.push(v)
  }
  return out
}

export function metricAvg(matches: MatchSummary[], key: MetricKey, items?: StaticData['items']): number | null {
  const vs = metricValues(matches, key, items)
  return vs.length ? mean(vs) : null
}

// ---------------------------------------------------------------------------
// Per-game performance score
// ---------------------------------------------------------------------------

const SCORE_WEIGHTS: Partial<Record<MetricKey, number>> = {
  csPerMin: 1.2,
  kda: 1.1,
  kp: 1,
  dpm: 1,
  visionPerMin: 0.7,
  deaths: 1,
  csDiffAt10: 0.8,
  goldDiffAt15: 0.9,
  damageShare: 0.6
}

const SUPPORT_WEIGHTS: Partial<Record<MetricKey, number>> = {
  kda: 1.1,
  kp: 1.3,
  visionPerMin: 1.4,
  controlWards: 0.8,
  deaths: 1.1,
  goldDiffAt15: 0.5
}

export function gameScore(m: MatchSummary, tier: Tier): number {
  const role: Role = m.me.role || 'MIDDLE'
  const weights = role === 'UTILITY' ? SUPPORT_WEIGHTS : SCORE_WEIGHTS
  let total = 0
  let wsum = 0
  for (const [k, w] of Object.entries(weights) as [MetricKey, number][]) {
    const v = METRICS[k].get(m)
    if (v == null) continue
    const s = metricScore(k, v, role, tier)
    if (s == null) continue
    total += s * w
    wsum += w
  }
  const base = wsum ? total / wsum : 50
  return Math.max(0, Math.min(100, base + (m.win ? 4 : -4)))
}

export function grade(score: number): string {
  if (score >= 92) return 'S+'
  if (score >= 84) return 'S'
  if (score >= 76) return 'A'
  if (score >= 66) return 'B'
  if (score >= 54) return 'C'
  return 'D'
}

// ---------------------------------------------------------------------------
// Skill profile (radar)
// ---------------------------------------------------------------------------

export type SkillDim = 'farming' | 'laning' | 'fighting' | 'vision' | 'survival' | 'objectives' | 'consistency'

export function skillProfile(matches: MatchSummary[], role: Role, tier: Tier): Record<SkillDim, number> {
  const s = (k: MetricKey) => {
    const avg = metricAvg(matches, k)
    return avg == null ? null : metricScore(k, avg, role, tier)
  }
  const avgOf = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null)
    return v.length ? mean(v) : 50
  }
  const scores = matches.map((m) => gameScore(m, tier))
  const consistency = matches.length >= 3 ? Math.max(0, Math.min(100, 100 - stdev(scores) * 3.2)) : 50
  return {
    farming: avgOf(role === 'UTILITY' ? [s('goldPerMin')] : [s('csPerMin'), s('csAt10')]),
    laning: avgOf([s('csDiffAt10'), s('goldDiffAt15'), s('xpDiffAt10')]),
    fighting: avgOf([s('kda'), s('kp'), s('dpm'), s('damageShare')]),
    vision: avgOf([s('visionPerMin'), s('controlWards')]),
    survival: avgOf([s('deaths'), s('deathsBefore14')]),
    objectives: avgOf([s('objectiveTakedowns')]),
    consistency
  }
}

// ---------------------------------------------------------------------------
// Champions, roles and matchups
// ---------------------------------------------------------------------------

export interface ChampAgg {
  championId: number
  championName: string
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  csPerMin: number
  dpm: number
  kp: number
  goldDiff15: number | null
  avgScore: number
  lastPlayed: number
  /** Bayesian winrate (shrinks small samples towards 50%). */
  confidenceWr: number
}

export function championStats(matches: MatchSummary[], tier: Tier): ChampAgg[] {
  const groups = new Map<number, MatchSummary[]>()
  for (const m of matches) {
    const list = groups.get(m.me.championId) ?? []
    list.push(m)
    groups.set(m.me.championId, list)
  }
  const out: ChampAgg[] = []
  for (const [championId, ms] of groups) {
    const wins = ms.filter((m) => m.win).length
    const gd = metricValues(ms, 'goldDiffAt15')
    out.push({
      championId,
      championName: ms[0].me.championName,
      games: ms.length,
      wins,
      kills: mean(ms.map((m) => m.me.kills)),
      deaths: mean(ms.map((m) => m.me.deaths)),
      assists: mean(ms.map((m) => m.me.assists)),
      csPerMin: mean(ms.map((m) => m.me.csPerMin)),
      dpm: mean(ms.map((m) => m.me.dpm)),
      kp: mean(ms.map((m) => m.me.killParticipation)),
      goldDiff15: gd.length ? mean(gd) : null,
      avgScore: mean(ms.map((m) => gameScore(m, tier))),
      lastPlayed: Math.max(...ms.map((m) => m.gameCreation)),
      confidenceWr: (wins + 5) / (ms.length + 10)
    })
  }
  return out.sort((a, b) => b.games - a.games)
}

export interface RoleAgg {
  role: Role
  games: number
  wins: number
  avgScore: number
}

export function roleStats(matches: MatchSummary[], tier: Tier): RoleAgg[] {
  const map = new Map<Role, MatchSummary[]>()
  for (const m of matches) {
    if (!m.me.role) continue
    const l = map.get(m.me.role) ?? []
    l.push(m)
    map.set(m.me.role, l)
  }
  return [...map.entries()]
    .map(([role, ms]) => ({
      role,
      games: ms.length,
      wins: ms.filter((m) => m.win).length,
      avgScore: mean(ms.map((m) => gameScore(m, tier)))
    }))
    .sort((a, b) => b.games - a.games)
}

export interface MatchupAgg {
  enemyChampionId: number
  enemyChampionName: string
  games: number
  wins: number
  csDiff10: number | null
  goldDiff15: number | null
  laneDeaths: number | null
}

export function matchupStats(matches: MatchSummary[], myChampionId?: number): MatchupAgg[] {
  const map = new Map<number, MatchSummary[]>()
  for (const m of matches) {
    if (!m.opponent) continue
    if (myChampionId && m.me.championId !== myChampionId) continue
    const l = map.get(m.opponent.championId) ?? []
    l.push(m)
    map.set(m.opponent.championId, l)
  }
  return [...map.entries()]
    .map(([id, ms]) => {
      const cs = metricValues(ms, 'csDiffAt10')
      const gd = metricValues(ms, 'goldDiffAt15')
      const ld = metricValues(ms, 'deathsBefore14')
      return {
        enemyChampionId: id,
        enemyChampionName: ms[0].opponent?.championName ?? '',
        games: ms.length,
        wins: ms.filter((m) => m.win).length,
        csDiff10: cs.length ? mean(cs) : null,
        goldDiff15: gd.length ? mean(gd) : null,
        laneDeaths: ld.length ? mean(ld) : null
      }
    })
    .sort((a, b) => b.games - a.games)
}

// ---------------------------------------------------------------------------
// Streaks, sessions, time patterns, tilt
// ---------------------------------------------------------------------------

/** Matches must be sorted newest first. */
export function currentStreak(matches: MatchSummary[]): { type: 'W' | 'L' | null; count: number } {
  if (!matches.length) return { type: null, count: 0 }
  const first = matches[0].win
  let count = 0
  for (const m of matches) {
    if (m.win !== first) break
    count++
  }
  return { type: first ? 'W' : 'L', count }
}

export function longestStreaks(matches: MatchSummary[]): { win: number; loss: number } {
  let win = 0
  let loss = 0
  let cw = 0
  let cl = 0
  for (const m of [...matches].reverse()) {
    if (m.win) {
      cw++
      cl = 0
    } else {
      cl++
      cw = 0
    }
    win = Math.max(win, cw)
    loss = Math.max(loss, cl)
  }
  return { win, loss }
}

export interface Session {
  start: number
  end: number
  matches: MatchSummary[] // oldest first
}

export function sessions(matches: MatchSummary[], gapMinutes = 75): Session[] {
  const sorted = [...matches].sort((a, b) => a.gameCreation - b.gameCreation)
  const out: Session[] = []
  for (const m of sorted) {
    const last = out[out.length - 1]
    const end = m.gameCreation + m.gameDuration * 1000
    if (last && m.gameCreation - last.end < gapMinutes * 60000) {
      last.matches.push(m)
      last.end = end
    } else out.push({ start: m.gameCreation, end, matches: [m] })
  }
  return out
}

export function winrateByGameInSession(matches: MatchSummary[]): { index: number; games: number; winrate: number }[] {
  const buckets = new Map<number, { g: number; w: number }>()
  for (const s of sessions(matches)) {
    s.matches.forEach((m, i) => {
      const idx = Math.min(i + 1, 6)
      const b = buckets.get(idx) ?? { g: 0, w: 0 }
      b.g++
      if (m.win) b.w++
      buckets.set(idx, b)
    })
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, b]) => ({ index, games: b.g, winrate: b.w / b.g }))
}

export function tiltStats(matches: MatchSummary[]) {
  const sorted = [...matches].sort((a, b) => a.gameCreation - b.gameCreation)
  let afterLoss = { g: 0, w: 0 }
  let afterWin = { g: 0, w: 0 }
  let after2Losses = { g: 0, w: 0 }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const gap = sorted[i].gameCreation - (prev.gameCreation + prev.gameDuration * 1000)
    if (gap > 3 * 3600000) continue // only consecutive games within a few hours
    const b = prev.win ? afterWin : afterLoss
    b.g++
    if (sorted[i].win) b.w++
    if (i >= 2 && !prev.win && !sorted[i - 2].win) {
      after2Losses.g++
      if (sorted[i].win) after2Losses.w++
    }
  }
  const wr = (b: { g: number; w: number }) => (b.g ? b.w / b.g : NaN)
  return {
    afterWin: { games: afterWin.g, winrate: wr(afterWin) },
    afterLoss: { games: afterLoss.g, winrate: wr(afterLoss) },
    after2Losses: { games: after2Losses.g, winrate: wr(after2Losses) }
  }
}

export function gamesToday(matches: MatchSummary[], now = Date.now()): MatchSummary[] {
  // A "gaming day" starts at 05:00 so a late-night session still counts as today.
  const start = new Date(now)
  start.setHours(5, 0, 0, 0)
  if (new Date(now).getHours() < 5) start.setDate(start.getDate() - 1)
  return matches.filter((m) => m.gameCreation >= start.getTime())
}

export function hourBuckets(matches: MatchSummary[]): { label: string; games: number; winrate: number }[] {
  const ranges: [string, number, number][] = [
    ['06–12', 6, 12],
    ['12–16', 12, 16],
    ['16–20', 16, 20],
    ['20–24', 20, 24],
    ['00–06', 0, 6]
  ]
  return ranges.map(([label, a, b]) => {
    const ms = matches.filter((m) => {
      const h = new Date(m.gameCreation).getHours()
      return h >= a && h < b
    })
    return { label, games: ms.length, winrate: winrate(ms) }
  })
}

export function weekdayBuckets(matches: MatchSummary[]): { day: number; games: number; winrate: number }[] {
  return [6, 0, 1, 2, 3, 4, 5].map((day) => {
    const ms = matches.filter((m) => new Date(m.gameCreation).getDay() === day)
    return { day, games: ms.length, winrate: winrate(ms) }
  })
}

export function durationBuckets(matches: MatchSummary[]): { label: string; games: number; winrate: number }[] {
  const ranges: [string, number, number][] = [
    ['<20', 0, 20],
    ['20–25', 20, 25],
    ['25–30', 25, 30],
    ['30–35', 30, 35],
    ['35+', 35, 999]
  ]
  return ranges.map(([label, a, b]) => {
    const ms = matches.filter((m) => m.gameDuration / 60 >= a && m.gameDuration / 60 < b)
    return { label, games: ms.length, winrate: winrate(ms) }
  })
}

export function sideStats(matches: MatchSummary[]) {
  const blue = matches.filter((m) => m.side === 'blue')
  const red = matches.filter((m) => m.side === 'red')
  return {
    blue: { games: blue.length, winrate: winrate(blue) },
    red: { games: red.length, winrate: winrate(red) }
  }
}

/** Games where the team was clearly ahead at 15 but lost (throws) and the reverse (comebacks). */
export function leadConversion(matches: MatchSummary[]) {
  const withTl = matches.filter((m) => m.timeline.length > 15)
  const ahead = withTl.filter((m) => m.timeline[15].teamGoldDiff >= 1500)
  const behind = withTl.filter((m) => m.timeline[15].teamGoldDiff <= -1500)
  return {
    ahead: { games: ahead.length, winrate: winrate(ahead) },
    behind: { games: behind.length, winrate: winrate(behind) }
  }
}

// ---------------------------------------------------------------------------
// Timelines & maps
// ---------------------------------------------------------------------------

export function averageCurves(matches: MatchSummary[], maxMinute = 30) {
  const out: { minute: number; teamGold: number; laneGold: number | null; csDiff: number | null; games: number }[] = []
  for (let minute = 1; minute <= maxMinute; minute++) {
    const pts = matches.map((m) => m.timeline[minute]).filter(Boolean)
    if (pts.length < 3) break
    const lane = pts.filter((p) => p.oppGold != null).map((p) => p.myGold - (p.oppGold ?? 0))
    const cs = pts.filter((p) => p.oppCs != null).map((p) => p.myCs - (p.oppCs ?? 0))
    out.push({
      minute,
      teamGold: Math.round(mean(pts.map((p) => p.teamGoldDiff))),
      laneGold: lane.length ? Math.round(mean(lane)) : null,
      csDiff: cs.length ? Math.round(mean(cs) * 10) / 10 : null,
      games: pts.length
    })
  }
  return out
}

export function toMapPercent(x: number, y: number): { left: number; top: number } {
  const { minX, minY, maxX, maxY } = MAP_BOUNDS
  return {
    left: ((x - minX) / (maxX - minX)) * 100,
    top: (1 - (y - minY) / (maxY - minY)) * 100
  }
}

/** Splits deaths into "own half" vs "enemy half" of the map (diagonal split). */
export function deathZones(matches: MatchSummary[]) {
  let own = 0
  let enemy = 0
  let early = 0
  let total = 0
  for (const m of matches) {
    for (const d of m.deaths) {
      total++
      const onRedHalf = d.x + d.y > 14800
      const inEnemyHalf = m.side === 'blue' ? onRedHalf : !onRedHalf
      if (inEnemyHalf) enemy++
      else own++
      if (d.t < 840) early++
    }
  }
  return { own, enemy, early, total, enemyShare: total ? enemy / total : NaN }
}

// ---------------------------------------------------------------------------
// Builds & runes from personal history
// ---------------------------------------------------------------------------

export interface RuneAgg {
  page: RunePage
  games: number
  wins: number
}

export function runePages(matches: MatchSummary[], championId: number): RuneAgg[] {
  const map = new Map<string, RuneAgg>()
  for (const m of matches) {
    if (m.me.championId !== championId || !m.me.runes) continue
    const key = JSON.stringify(m.me.runes)
    const agg = map.get(key) ?? { page: m.me.runes, games: 0, wins: 0 }
    agg.games++
    if (m.win) agg.wins++
    map.set(key, agg)
  }
  return [...map.values()].sort((a, b) => (b.wins + 2) / (b.games + 4) - (a.wins + 2) / (a.games + 4) || b.games - a.games)
}

export function coreItems(
  matches: MatchSummary[],
  championId: number,
  items?: StaticData['items']
): { id: number; games: number; wins: number }[] {
  const map = new Map<number, { id: number; games: number; wins: number }>()
  for (const m of matches) {
    if (m.me.championId !== championId) continue
    for (const id of new Set(m.me.items)) {
      if (!id || (items && !isLegendary(id, items) && !items[id]?.tags.includes('Boots'))) continue
      const agg = map.get(id) ?? { id, games: 0, wins: 0 }
      agg.games++
      if (m.win) agg.wins++
      map.set(id, agg)
    }
  }
  return [...map.values()].sort((a, b) => b.games - a.games)
}

export function commonSkillOrder(matches: MatchSummary[], championId: number): string | null {
  const counts = new Map<string, number>()
  for (const m of matches) {
    if (m.me.championId !== championId || m.me.skillOrder.length < 9) continue
    const key = m.me.skillOrder.slice(0, 18)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let n = 0
  for (const [k, c] of counts)
    if (c > n) {
      best = k
      n = c
    }
  return best
}

/** Skill max order like "Q > W > E" derived from a level-up sequence. */
export function maxOrder(order: string): string {
  const firstMax: Record<string, number> = {}
  const count: Record<string, number> = { Q: 0, W: 0, E: 0 }
  order.split('').forEach((k, i) => {
    if (k === 'R') return
    count[k] = (count[k] ?? 0) + 1
    if (count[k] === 5 && firstMax[k] == null) firstMax[k] = i
  })
  return ['Q', 'W', 'E']
    .sort((a, b) => (firstMax[a] ?? 99 + (5 - count[a])) - (firstMax[b] ?? 99 + (5 - count[b])))
    .join(' > ')
}

// ---------------------------------------------------------------------------
// Rank / LP
// ---------------------------------------------------------------------------

export function lpSeries(history: RankSnapshot[], queue = 'RANKED_SOLO_5x5') {
  return history
    .filter((h) => h.queueType === queue)
    .map((h) => ({ t: h.t, abs: absoluteLp(h.tier, h.rank, h.lp), tier: h.tier, rank: h.rank, lp: h.lp }))
}

/** Attributes LP changes to individual solo-queue games when snapshots allow it. */
export function lpDeltaByMatch(matches: MatchSummary[], history: RankSnapshot[]): Map<string, number> {
  const out = new Map<string, number>()
  const snaps = history.filter((h) => h.queueType === 'RANKED_SOLO_5x5').sort((a, b) => a.t - b.t)
  const solo = matches.filter((m) => m.queueId === 420)
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1]
    const b = snaps[i]
    if (b.wins + b.losses - (a.wins + a.losses) !== 1) continue
    const game = solo.find((m) => {
      const end = m.gameCreation + m.gameDuration * 1000
      return end <= b.t && end >= a.t - 60000
    })
    if (game) out.set(game.matchId, absoluteLp(b.tier, b.rank, b.lp) - absoluteLp(a.tier, a.rank, a.lp))
  }
  return out
}

export function averageLpChange(deltas: Map<string, number>): { gain: number | null; loss: number | null } {
  const vals = [...deltas.values()]
  const g = vals.filter((v) => v > 0 && v < 60)
  const l = vals.filter((v) => v < 0 && v > -60)
  return { gain: g.length ? mean(g) : null, loss: l.length ? mean(l) : null }
}

/** Expected number of games to climb `lpNeeded` at a winrate with given LP gains/losses. */
export function gamesToClimb(lpNeeded: number, wr: number, gain: number, loss: number): number | null {
  const perGame = wr * gain - (1 - wr) * Math.abs(loss)
  if (perGame <= 0) return null
  return Math.ceil(lpNeeded / perGame)
}

export function requiredWinrate(lpNeeded: number, games: number, gain: number, loss: number): number {
  // games * (w*gain - (1-w)*loss) = lpNeeded  →  w = (lpNeeded/games + loss) / (gain + loss)
  const l = Math.abs(loss)
  return (lpNeeded / games + l) / (gain + l)
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

/** Rolling average series from oldest to newest. */
export function rolling(matches: MatchSummary[], key: MetricKey, window = 10, items?: StaticData['items']) {
  const sorted = [...matches].sort((a, b) => a.gameCreation - b.gameCreation)
  const vals = sorted.map((m) => METRICS[key].get(m, items))
  const out: { i: number; t: number; value: number | null; avg: number | null }[] = []
  sorted.forEach((m, i) => {
    const slice = vals.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null)
    out.push({ i: i + 1, t: m.gameCreation, value: vals[i], avg: slice.length ? mean(slice) : null })
  })
  return out
}

/** Compare the recent half of the window with the older half. */
export function trendDelta(matches: MatchSummary[], key: MetricKey, items?: StaticData['items']): number | null {
  if (matches.length < 8) return null
  const half = Math.floor(matches.length / 2)
  const recent = metricAvg(matches.slice(0, half), key, items)
  const older = metricAvg(matches.slice(half), key, items)
  if (recent == null || older == null) return null
  return recent - older
}
