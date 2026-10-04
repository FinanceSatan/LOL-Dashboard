// Metric registry + approximate tier/role benchmarks used for scoring and coaching.
import { TIERS } from '@shared/constants'
import type { MatchSummary, Role, StaticData, Tier } from '@shared/types'

export type MetricKey =
  | 'csPerMin'
  | 'csAt10'
  | 'csDiffAt10'
  | 'goldDiffAt15'
  | 'xpDiffAt10'
  | 'goldPerMin'
  | 'dpm'
  | 'damageShare'
  | 'kp'
  | 'kda'
  | 'deaths'
  | 'deathsBefore14'
  | 'visionPerMin'
  | 'controlWards'
  | 'soloKills'
  | 'firstItemMin'
  | 'objectiveTakedowns'

export type MetricFormat = 'dec1' | 'dec2' | 'int' | 'pct' | 'signed' | 'min'

export interface MetricDef {
  key: MetricKey
  format: MetricFormat
  higherIsBetter: boolean
  /** Diff metrics are scored on an absolute scale instead of a ratio. */
  diffScale?: number
  /** How strongly the benchmark scales with tier (1 = linear with tier factor). */
  tierExp: number
  get: (m: MatchSummary, items?: StaticData['items']) => number | null
}

export function isLegendary(id: number, items?: StaticData['items']): boolean {
  const it = items?.[id]
  if (!it) return false
  if (it.tags.includes('Consumable') || it.tags.includes('Trinket')) return false
  if (it.tags.includes('Boots')) return false
  return it.gold.total >= 2200 && it.into.length === 0
}

export function firstItemMinutes(m: MatchSummary, items?: StaticData['items']): number | null {
  if (!items || !m.me.itemPurchases.length) return null
  const first = m.me.itemPurchases.find((p) => isLegendary(p.id, items))
  return first ? first.t / 60 : null
}

export const METRICS: Record<MetricKey, MetricDef> = {
  csPerMin: { key: 'csPerMin', format: 'dec1', higherIsBetter: true, tierExp: 1, get: (m) => m.me.csPerMin },
  csAt10: { key: 'csAt10', format: 'int', higherIsBetter: true, tierExp: 1, get: (m) => m.laning?.csAt10 ?? null },
  csDiffAt10: {
    key: 'csDiffAt10',
    format: 'signed',
    higherIsBetter: true,
    diffScale: 12,
    tierExp: 0,
    get: (m) => m.laning?.csDiffAt10 ?? null
  },
  goldDiffAt15: {
    key: 'goldDiffAt15',
    format: 'signed',
    higherIsBetter: true,
    diffScale: 700,
    tierExp: 0,
    get: (m) => m.laning?.goldDiffAt15 ?? null
  },
  xpDiffAt10: {
    key: 'xpDiffAt10',
    format: 'signed',
    higherIsBetter: true,
    diffScale: 350,
    tierExp: 0,
    get: (m) => m.laning?.xpDiffAt10 ?? null
  },
  goldPerMin: { key: 'goldPerMin', format: 'int', higherIsBetter: true, tierExp: 0.6, get: (m) => m.me.goldPerMin },
  dpm: { key: 'dpm', format: 'int', higherIsBetter: true, tierExp: 0.9, get: (m) => m.me.dpm },
  damageShare: { key: 'damageShare', format: 'pct', higherIsBetter: true, tierExp: 0.25, get: (m) => m.me.damageShare },
  kp: { key: 'kp', format: 'pct', higherIsBetter: true, tierExp: 0.35, get: (m) => m.me.killParticipation },
  kda: { key: 'kda', format: 'dec2', higherIsBetter: true, tierExp: 0.8, get: (m) => m.me.kda },
  deaths: { key: 'deaths', format: 'dec1', higherIsBetter: false, tierExp: -0.7, get: (m) => m.me.deaths },
  deathsBefore14: {
    key: 'deathsBefore14',
    format: 'dec1',
    higherIsBetter: false,
    tierExp: -0.9,
    get: (m) => m.laning?.deathsBefore14 ?? null
  },
  visionPerMin: { key: 'visionPerMin', format: 'dec2', higherIsBetter: true, tierExp: 1.3, get: (m) => m.me.visionPerMin },
  controlWards: { key: 'controlWards', format: 'dec1', higherIsBetter: true, tierExp: 1.6, get: (m) => m.me.controlWards },
  soloKills: { key: 'soloKills', format: 'dec1', higherIsBetter: true, tierExp: 0.5, get: (m) => m.me.soloKills },
  firstItemMin: {
    key: 'firstItemMin',
    format: 'min',
    higherIsBetter: false,
    tierExp: -0.5,
    get: (m, items) => firstItemMinutes(m, items)
  },
  objectiveTakedowns: {
    key: 'objectiveTakedowns',
    format: 'dec1',
    higherIsBetter: true,
    tierExp: 0.6,
    get: (m) => (m.source === 'client' ? null : m.me.objectiveTakedowns)
  }
}

/**
 * Approximate Challenger-level reference values per role (solo queue averages
 * gathered from public statistics; meant as direction, not as exact truth).
 */
const CHALLENGER: Record<Role, Partial<Record<MetricKey, number>>> = {
  TOP: { csPerMin: 7.9, csAt10: 78, csDiffAt10: 4, goldDiffAt15: 250, xpDiffAt10: 120, goldPerMin: 440, dpm: 720, damageShare: 0.24, kp: 0.47, kda: 3.0, deaths: 4.6, deathsBefore14: 0.9, visionPerMin: 0.75, controlWards: 2.2, soloKills: 1.6, firstItemMin: 11.5, objectiveTakedowns: 1.6 },
  JUNGLE: { csPerMin: 6.6, csAt10: 66, csDiffAt10: 3, goldDiffAt15: 250, xpDiffAt10: 150, goldPerMin: 425, dpm: 560, damageShare: 0.18, kp: 0.66, kda: 3.6, deaths: 4.8, deathsBefore14: 0.9, visionPerMin: 1.15, controlWards: 3.4, soloKills: 0.9, firstItemMin: 11.0, objectiveTakedowns: 4.0 },
  MIDDLE: { csPerMin: 8.6, csAt10: 85, csDiffAt10: 4, goldDiffAt15: 250, xpDiffAt10: 120, goldPerMin: 450, dpm: 820, damageShare: 0.27, kp: 0.56, kda: 3.4, deaths: 4.3, deathsBefore14: 0.8, visionPerMin: 0.85, controlWards: 2.4, soloKills: 1.4, firstItemMin: 10.8, objectiveTakedowns: 2.0 },
  BOTTOM: { csPerMin: 9.2, csAt10: 87, csDiffAt10: 4, goldDiffAt15: 250, xpDiffAt10: 100, goldPerMin: 470, dpm: 880, damageShare: 0.29, kp: 0.56, kda: 3.4, deaths: 4.6, deathsBefore14: 0.9, visionPerMin: 0.75, controlWards: 2.0, soloKills: 0.7, firstItemMin: 11.2, objectiveTakedowns: 2.0 },
  UTILITY: { csPerMin: 1.3, csAt10: 12, csDiffAt10: 1, goldDiffAt15: 150, xpDiffAt10: 80, goldPerMin: 300, dpm: 330, damageShare: 0.1, kp: 0.66, kda: 3.6, deaths: 5.2, deathsBefore14: 1.0, visionPerMin: 2.6, controlWards: 5.2, soloKills: 0.3, firstItemMin: 13.5, objectiveTakedowns: 2.0 }
}

const TIER_FACTOR: Record<Tier, number> = {
  IRON: 0.6,
  BRONZE: 0.67,
  SILVER: 0.73,
  GOLD: 0.79,
  PLATINUM: 0.84,
  EMERALD: 0.88,
  DIAMOND: 0.92,
  MASTER: 0.96,
  GRANDMASTER: 0.98,
  CHALLENGER: 1
}

export function benchmark(key: MetricKey, role: Role, tier: Tier): number | null {
  const base = CHALLENGER[role]?.[key]
  if (base == null) return null
  const def = METRICS[key]
  if (def.diffScale) return base
  return base * Math.pow(TIER_FACTOR[tier], def.tierExp)
}

export function nextTier(tier: Tier): Tier {
  const i = TIERS.indexOf(tier)
  return TIERS[Math.min(TIERS.length - 1, i + 1)]
}

/** 0..100 where ~80 means "at the benchmark". */
export function metricScore(key: MetricKey, value: number, role: Role, tier: Tier): number | null {
  const def = METRICS[key]
  const bench = benchmark(key, role, tier)
  if (bench == null || !Number.isFinite(value)) return null
  let score: number
  if (def.diffScale) {
    score = 80 + ((value - bench) / def.diffScale) * 20
  } else if (def.higherIsBetter) {
    score = bench > 0 ? (value / bench) * 80 : 80
  } else {
    score = value <= 0 ? 100 : (bench / value) * 80
  }
  return Math.max(0, Math.min(100, score))
}

export function formatMetric(format: MetricFormat, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  // left-to-right isolate keeps signs and % in place inside right-to-left (Persian) text
  return `\u2066${formatMetricRaw(format, v)}\u2069`
}

function formatMetricRaw(format: MetricFormat, v: number): string {
  switch (format) {
    case 'dec1':
      return v.toFixed(1)
    case 'dec2':
      return v.toFixed(2)
    case 'int':
      return Math.round(v).toLocaleString('en-US')
    case 'pct':
      return `${Math.round(v * 100)}%`
    case 'signed':
      return `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}`
    case 'min': {
      const mm = Math.floor(v)
      const ss = Math.round((v - mm) * 60)
      return `${mm}:${String(ss).padStart(2, '0')}`
    }
  }
}

export const fmtMetric = (key: MetricKey, v: number | null | undefined) => formatMetric(METRICS[key].format, v)
