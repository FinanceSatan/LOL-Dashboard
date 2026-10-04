// Rule-based coaching engine: turns match analytics into prioritized, actionable advice.
import { TIERS } from '@shared/constants'
import type { MatchSummary, Role, StaticData, Tier } from '@shared/types'
import {
  championStats,
  deathZones,
  durationBuckets,
  hourBuckets,
  leadConversion,
  mean,
  metricAvg,
  tiltStats,
  winrateByGameInSession
} from './analytics'
import { METRICS, type MetricKey, benchmark, metricScore } from './metrics'

export type InsightKind = 'weakness' | 'strength' | 'pattern'

export interface Insight {
  id: string
  kind: InsightKind
  severity: 1 | 2 | 3
  metric?: MetricKey
  value?: number
  target?: number
  /** i18n key prefix: `${key}.title`, `${key}.body`, `${key}.drills` */
  key: string
  params: Record<string, string | number>
  /** Higher = more important to fix. */
  priority: number
}

export const ROLE_METRICS: Record<Role, MetricKey[]> = {
  TOP: ['csPerMin', 'csAt10', 'csDiffAt10', 'goldDiffAt15', 'deathsBefore14', 'deaths', 'kp', 'dpm', 'soloKills', 'visionPerMin', 'controlWards', 'firstItemMin'],
  JUNGLE: ['csPerMin', 'csAt10', 'kp', 'objectiveTakedowns', 'deaths', 'deathsBefore14', 'visionPerMin', 'controlWards', 'dpm', 'goldDiffAt15', 'firstItemMin'],
  MIDDLE: ['csPerMin', 'csAt10', 'csDiffAt10', 'goldDiffAt15', 'deathsBefore14', 'deaths', 'kp', 'dpm', 'damageShare', 'soloKills', 'visionPerMin', 'controlWards', 'firstItemMin'],
  BOTTOM: ['csPerMin', 'csAt10', 'csDiffAt10', 'goldDiffAt15', 'deathsBefore14', 'deaths', 'kp', 'dpm', 'damageShare', 'visionPerMin', 'controlWards', 'firstItemMin'],
  UTILITY: ['visionPerMin', 'controlWards', 'kp', 'deaths', 'deathsBefore14', 'goldDiffAt15', 'kda']
}

export function analyze(
  matches: MatchSummary[],
  role: Role,
  tier: Tier,
  items?: StaticData['items']
): Insight[] {
  const out: Insight[] = []
  const roleMatches = matches.filter((m) => m.me.role === role)
  const base = roleMatches.length >= 5 ? roleMatches : matches
  if (base.length < 3) return out

  // 1) Metric gaps vs. the target tier
  for (const key of ROLE_METRICS[role]) {
    const avg = metricAvg(base, key, items)
    if (avg == null) continue
    const score = metricScore(key, avg, role, tier)
    const target = benchmark(key, role, tier)
    if (score == null || target == null) continue
    const common = { metric: key, value: avg, target, params: { value: avg, target } }
    if (score < 72) {
      const severity: 1 | 2 | 3 = score < 55 ? 3 : score < 65 ? 2 : 1
      out.push({ id: `w-${key}`, kind: 'weakness', severity, key: `coach.m.${key}`, priority: 100 - score, ...common })
    } else if (score >= 88) {
      out.push({ id: `s-${key}`, kind: 'strength', severity: 1, key: `coach.s.${key}`, priority: score - 80, ...common })
    }
  }

  // 2) Deaths in the enemy half → overextending without information
  const zones = deathZones(base)
  if (zones.total >= 12 && zones.enemyShare > 0.55) {
    out.push({
      id: 'p-overextend',
      kind: 'pattern',
      severity: zones.enemyShare > 0.65 ? 3 : 2,
      key: 'coach.p.overextend',
      params: { pct: Math.round(zones.enemyShare * 100) },
      priority: zones.enemyShare * 60
    })
  }

  // 3) Lead conversion & comebacks
  const lc = leadConversion(base)
  if (lc.ahead.games >= 4 && lc.ahead.winrate < 0.7) {
    out.push({
      id: 'p-throws',
      kind: 'pattern',
      severity: lc.ahead.winrate < 0.55 ? 3 : 2,
      key: 'coach.p.throws',
      params: { pct: Math.round(lc.ahead.winrate * 100), games: lc.ahead.games },
      priority: (0.8 - lc.ahead.winrate) * 100
    })
  }
  if (lc.behind.games >= 4 && lc.behind.winrate >= 0.35) {
    out.push({
      id: 's-comeback',
      kind: 'strength',
      severity: 1,
      key: 'coach.s.comeback',
      params: { pct: Math.round(lc.behind.winrate * 100), games: lc.behind.games },
      priority: 10
    })
  }

  // 4) Late game
  const dur = durationBuckets(base)
  const late = dur[dur.length - 1]
  const lateish = dur[dur.length - 2]
  const lateGames = late.games + lateish.games
  const lateWr = lateGames ? (late.winrate * late.games + lateish.winrate * lateish.games) / lateGames : NaN
  if (lateGames >= 6 && lateWr < 0.42) {
    out.push({
      id: 'p-late',
      kind: 'pattern',
      severity: 2,
      key: 'coach.p.late',
      params: { pct: Math.round(lateWr * 100), games: lateGames },
      priority: (0.5 - lateWr) * 100
    })
  }

  // 5) Champion pool
  const recent = matches.slice(0, 20)
  const uniq = new Set(recent.map((m) => m.me.championId)).size
  if (recent.length >= 15 && uniq >= 7) {
    out.push({ id: 'p-pool', kind: 'pattern', severity: 2, key: 'coach.p.pool', params: { count: uniq }, priority: 30 + uniq })
  }
  const champs = championStats(matches, tier).filter((c) => c.games >= 5)
  const best = [...champs].sort((a, b) => b.confidenceWr - a.confidenceWr)[0]
  if (best && best.wins / best.games >= 0.55) {
    out.push({
      id: 's-best-champ',
      kind: 'strength',
      severity: 1,
      key: 'coach.s.bestChamp',
      params: { champion: best.championId, pct: Math.round((best.wins / best.games) * 100), games: best.games },
      priority: 20
    })
  }
  const worst = [...champs].sort((a, b) => a.confidenceWr - b.confidenceWr)[0]
  if (worst && worst !== best && worst.wins / worst.games < 0.42 && worst.games >= 6) {
    out.push({
      id: 'p-worst-champ',
      kind: 'pattern',
      severity: 2,
      key: 'coach.p.worstChamp',
      params: { champion: worst.championId, pct: Math.round((worst.wins / worst.games) * 100), games: worst.games },
      priority: 35
    })
  }

  // 6) Tilt & fatigue
  const tilt = tiltStats(matches)
  if (tilt.afterLoss.games >= 8 && tilt.afterWin.games >= 8 && tilt.afterWin.winrate - tilt.afterLoss.winrate > 0.1) {
    out.push({
      id: 'p-tilt',
      kind: 'pattern',
      severity: tilt.afterWin.winrate - tilt.afterLoss.winrate > 0.18 ? 3 : 2,
      key: 'coach.p.tilt',
      params: {
        afterLoss: Math.round(tilt.afterLoss.winrate * 100),
        afterWin: Math.round(tilt.afterWin.winrate * 100)
      },
      priority: (tilt.afterWin.winrate - tilt.afterLoss.winrate) * 200
    })
  }
  const bySession = winrateByGameInSession(matches)
  const lateSession = bySession.filter((b) => b.index >= 4)
  const lateSessionGames = lateSession.reduce((a, b) => a + b.games, 0)
  if (lateSessionGames >= 8) {
    const wr = lateSession.reduce((a, b) => a + b.winrate * b.games, 0) / lateSessionGames
    if (wr < 0.45) {
      out.push({
        id: 'p-fatigue',
        kind: 'pattern',
        severity: 2,
        key: 'coach.p.fatigue',
        params: { pct: Math.round(wr * 100) },
        priority: (0.5 - wr) * 120
      })
    }
  }
  const hours = hourBuckets(matches).filter((h) => h.games >= 8)
  if (hours.length >= 2) {
    const sorted = [...hours].sort((a, b) => a.winrate - b.winrate)
    const worstH = sorted[0]
    const bestH = sorted[sorted.length - 1]
    if (bestH.winrate - worstH.winrate > 0.15) {
      out.push({
        id: 'p-hours',
        kind: 'pattern',
        severity: 1,
        key: 'coach.p.hours',
        params: {
          best: bestH.label,
          bestPct: Math.round(bestH.winrate * 100),
          worst: worstH.label,
          worstPct: Math.round(worstH.winrate * 100)
        },
        priority: (bestH.winrate - worstH.winrate) * 80
      })
    }
  }

  // 7) Farming falls off after laning phase
  if (role !== 'UTILITY') {
    const early = metricAvg(base, 'csAt10')
    const overall = metricAvg(base, 'csPerMin')
    if (early != null && overall != null && early > 0) {
      const earlyRate = early / 8.9 // minions arrive at ~1:05
      if (overall < earlyRate * 0.92) {
        out.push({
          id: 'p-midgame-farm',
          kind: 'pattern',
          severity: 1,
          key: 'coach.p.midFarm',
          params: { early: earlyRate.toFixed(1), overall: overall.toFixed(1) },
          priority: 25
        })
      }
    }
  }

  return out.sort((a, b) => b.severity - a.severity || b.priority - a.priority)
}

/** Estimates which tier the player's averages correspond to (benchmarks met). */
export function estimateTier(matches: MatchSummary[], role: Role, keys?: MetricKey[], items?: StaticData['items']): Tier | null {
  const list = keys ?? ROLE_METRICS[role]
  const avgs = list
    .map((k) => [k, metricAvg(matches, k, items)] as const)
    .filter((x): x is readonly [MetricKey, number] => x[1] != null && !METRICS[x[0]].diffScale)
  if (!avgs.length) return null
  let result: Tier = 'IRON'
  for (const tier of TIERS) {
    const scores = avgs.map(([k, v]) => metricScore(k, v, role, tier) ?? 0)
    if (mean(scores) >= 78) result = tier
    else break
  }
  return result
}

export const DIM_METRICS: Record<string, MetricKey[]> = {
  farming: ['csPerMin', 'csAt10'],
  fighting: ['kda', 'kp', 'dpm'],
  vision: ['visionPerMin', 'controlWards'],
  survival: ['deaths', 'deathsBefore14']
}
