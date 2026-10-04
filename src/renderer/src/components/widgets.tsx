import clsx from 'clsx'
import { AlertTriangle, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { QUEUES, TIERS, TIER_COLORS, rankFromAbsolute } from '@shared/constants'
import type { Goal, MatchSummary, RankSnapshot } from '@shared/types'
import { useT } from '@/i18n'
import { gameScore, grade, lpSeries, metricValues, type SkillDim } from '@/lib/analytics'
import type { Insight } from '@/lib/coach'
import { clock, dateShort, timeAgo } from '@/lib/format'
import { METRICS, fmtMetric, type MetricKey } from '@/lib/metrics'
import { useApp } from '@/store/app'
import { AXIS, GOLD, SERIES, TooltipBox, axisProps } from './charts'
import { ChampIcon, ItemRow, RoleIcon, useChampName } from './game'
import { Badge, Progress } from './ui'

export function GradeBadge({ score, className }: { score: number; className?: string }) {
  const g = grade(score)
  return (
    <span
      title={`${Math.round(score)}/100`}
      className={clsx(
        'inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-black tnum',
        g.startsWith('S') && 'bg-gold/20 text-gold',
        g === 'A' && 'bg-good/15 text-good',
        g === 'B' && 'bg-accent/15 text-accent',
        g === 'C' && 'bg-warn/15 text-warn',
        g === 'D' && 'bg-bad/15 text-bad',
        className
      )}
    >
      {g}
    </span>
  )
}

export function MatchRow({
  m,
  lpDelta,
  onClick,
  compact,
  reviewed
}: {
  m: MatchSummary
  lpDelta?: number
  onClick?: () => void
  compact?: boolean
  reviewed?: boolean
}) {
  const t = useT()
  const tier = useApp((s) => s.settings?.targetTier ?? 'CHALLENGER')
  const champName = useChampName()
  const score = gameScore(m, tier)
  const q = QUEUES[m.queueId]
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-panel px-3 py-2.5 text-start transition-colors hover:bg-panel2',
        m.remake ? 'border-line' : m.win ? 'border-win/25' : 'border-loss/25'
      )}
    >
      <span className={clsx('absolute inset-y-0 start-0 w-1', m.remake ? 'bg-muted' : m.win ? 'bg-win' : 'bg-loss')} />
      <div className="w-20 shrink-0 ps-1.5">
        <div className={clsx('text-xs font-bold', m.remake ? 'text-muted' : m.win ? 'text-win' : 'text-loss')}>
          {m.remake ? t('match.remake') : m.win ? t('match.victory') : t('match.defeat')}
        </div>
        <div className="truncate text-[11px] text-muted">{q ? (t.lang === 'fa' ? q.fa : q.en) : m.queueId}</div>
        <div className="text-[11px] text-muted tnum">{clock(m.gameDuration)}</div>
      </div>
      <div className="relative shrink-0">
        <ChampIcon id={m.me.championId} name={m.me.championName} size={compact ? 38 : 44} rounded="lg" />
        <span className="absolute -bottom-1 -end-1 rounded bg-bg px-1 text-[10px] font-bold text-ink2 tnum">{m.me.level}</span>
      </div>
      <div className="w-28 shrink-0">
        <div className="truncate text-sm font-semibold text-ink">{champName(m.me.championId, m.me.championName)}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <RoleIcon role={m.me.role} size={12} />
          {timeAgo(m.gameCreation, t.lang)}
        </div>
      </div>
      <div className="w-24 shrink-0 text-center">
        <div className="text-sm font-semibold tnum" dir="ltr">
          {m.me.kills} / <span className="text-loss">{m.me.deaths}</span> / {m.me.assists}
        </div>
        <div className="text-[11px] text-muted tnum">{m.me.kda.toFixed(2)} KDA</div>
      </div>
      <div className="w-28 shrink-0 text-center" dir="ltr">
        <div className="text-sm font-medium tnum">{m.me.cs} CS</div>
        <div className="text-[11px] text-muted tnum">
          {m.me.csPerMin.toFixed(1)}/m · {Math.round(m.me.killParticipation * 100)}% KP
        </div>
      </div>
      {!compact && (
        <div className="hidden shrink-0 xl:block">
          <ItemRow items={m.me.items} size={22} />
        </div>
      )}
      {!compact && m.opponent && (
        <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted 2xl:flex">
          vs <ChampIcon id={m.opponent.championId} name={m.opponent.championName} size={24} rounded="full" />
          {m.laning?.goldDiffAt15 != null && (
            <span className={clsx('font-semibold tnum', m.laning.goldDiffAt15 >= 0 ? 'text-good' : 'text-bad')} dir="ltr">
              {m.laning.goldDiffAt15 > 0 ? '+' : ''}
              {m.laning.goldDiffAt15}g@15
            </span>
          )}
        </div>
      )}
      <div className="ms-auto flex shrink-0 items-center gap-2">
        {reviewed && <Badge tone="accent">✓</Badge>}
        {lpDelta != null && (
          <span className={clsx('text-xs font-bold tnum', lpDelta >= 0 ? 'text-good' : 'text-bad')} dir="ltr">
            {lpDelta > 0 ? '+' : ''}
            {lpDelta} LP
          </span>
        )}
        {!m.remake && <GradeBadge score={score} />}
        <ChevronRight size={16} className="text-muted opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
      </div>
    </button>
  )
}

export function SkillRadar({ profile, height = 260 }: { profile: Record<SkillDim, number>; height?: number }) {
  const t = useT()
  const data = (Object.keys(profile) as SkillDim[]).map((k) => ({
    dim: t.d(`skill.${k}`),
    value: Math.round(profile[k]),
    target: 80
  }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#243149" />
        <PolarAngleAxis dataKey="dim" tick={{ fill: '#aab5c7', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="target" dataKey="target" stroke={GOLD} strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
        <Radar name="you" dataKey="value" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.22} strokeWidth={2} dot={{ r: 3, fill: SERIES[0] }} />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={payload[0].payload.dim}
                rows={[
                  { label: t('common.you'), value: payload[0].payload.value, color: SERIES[0] },
                  { label: t('common.target'), value: 80, color: GOLD }
                ]}
              />
            ) : null
          }
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/** LP progression on an absolute ladder scale with tier bands. */
export function LpChart({ history, height = 240 }: { history: RankSnapshot[]; height?: number }) {
  const t = useT()
  const series = useMemo(() => lpSeries(history), [history])
  if (series.length < 2) {
    return <div className="flex items-center justify-center text-xs text-muted" style={{ height }}>{t('dash.lpEmpty')}</div>
  }
  const min = Math.min(...series.map((s) => s.abs))
  const max = Math.max(...series.map((s) => s.abs))
  const lo = Math.max(0, Math.floor((min - 40) / 100) * 100)
  const hi = Math.ceil((max + 40) / 100) * 100
  const ticks: number[] = []
  for (let v = lo; v <= hi; v += 100) ticks.push(v)
  const label = (abs: number) => {
    const r = rankFromAbsolute(abs)
    if (abs >= 2800) return `M ${Math.round(abs - 2800)}`
    return `${r.tier.charAt(0)}${r.tier === 'GRANDMASTER' ? 'M' : ''}${['IV', 'III', 'II', 'I'].indexOf(r.division) >= 0 ? ' ' + r.division : ''}`
  }
  const tierStarts = TIERS.slice(0, 8)
    .map((tier, i) => ({ tier, v: i * 400 }))
    .filter((x) => x.v > lo && x.v < hi)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#1f2a3d" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => dateShort(v, t.lang)} {...axisProps} minTickGap={40} />
        <YAxis domain={[lo, hi]} ticks={ticks} tickFormatter={label} width={56} {...axisProps} />
        {tierStarts.map((ts) => (
          <ReferenceLine key={ts.tier} y={ts.v} stroke={TIER_COLORS[ts.tier]} strokeOpacity={0.6} label={{ value: ts.tier, fill: TIER_COLORS[ts.tier], fontSize: 10, position: 'insideTopLeft' }} />
        ))}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as (typeof series)[number]
            return (
              <TooltipBox
                title={dateShort(p.t, t.lang)}
                rows={[{ label: p.tier, value: `${['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(p.tier) ? '' : p.rank + ' · '}${p.lp} LP` }]}
              />
            )
          }}
        />
        <Area type="monotone" dataKey="abs" stroke={SERIES[0]} strokeWidth={2} fill="url(#lpFill)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function InsightCard({ insight, expanded }: { insight: Insight; expanded?: boolean }) {
  const t = useT()
  const champName = useChampName()
  const params: Record<string, string | number> = { ...insight.params }
  if (insight.metric) {
    params.value = fmtMetric(insight.metric, insight.value)
    params.target = fmtMetric(insight.metric, insight.target)
  }
  if (typeof params.champion === 'number') params.champion = champName(params.champion)
  const tone = insight.kind === 'strength' ? 'good' : insight.severity === 3 ? 'bad' : insight.severity === 2 ? 'warn' : 'accent'
  const drills = t.arr(`${insight.key}.drills`, params)
  return (
    <div
      className={clsx(
        'rounded-xl border bg-panel2/60 p-3.5',
        tone === 'good' && 'border-good/25',
        tone === 'bad' && 'border-bad/30',
        tone === 'warn' && 'border-warn/25',
        tone === 'accent' && 'border-line2'
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={clsx(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            tone === 'good' && 'bg-good/15 text-good',
            tone === 'bad' && 'bg-bad/15 text-bad',
            tone === 'warn' && 'bg-warn/15 text-warn',
            tone === 'accent' && 'bg-accent/15 text-accent'
          )}
        >
          {insight.kind === 'strength' ? <Sparkles size={13} /> : insight.kind === 'pattern' ? <TrendingUp size={13} /> : <AlertTriangle size={13} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{t.d(`${insight.key}.title`, params)}</span>
            {insight.metric && (
              <span className="text-[11px] text-muted tnum">
                {params.value} → <span className="text-gold">{params.target}</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{t.d(`${insight.key}.body`, params)}</p>
          {expanded && drills.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {drills.map((d, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export function goalProgress(goal: Goal, matches: MatchSummary[], items?: Parameters<typeof metricValues>[2]) {
  const vals = metricValues(matches.slice(0, goal.window), goal.metric as MetricKey, items)
  const hits = vals.filter((v) => (goal.comparator === 'gte' ? v >= goal.target : v <= goal.target)).length
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  const avgMet = avg != null && (goal.comparator === 'gte' ? avg >= goal.target : avg <= goal.target)
  // last 5 games hit/miss for a streak visual
  const recent = metricValues(matches.slice(0, 10), goal.metric as MetricKey, items).map((v) =>
    goal.comparator === 'gte' ? v >= goal.target : v <= goal.target
  )
  return { games: vals.length, hits, rate: vals.length ? hits / vals.length : 0, avg, avgMet, recent }
}

export function GoalLine({ goal, matches }: { goal: Goal; matches: MatchSummary[] }) {
  const t = useT()
  const items = useApp((s) => s.staticData?.items)
  const p = goalProgress(goal, matches, items)
  const key = goal.metric as MetricKey
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink">
          {t.d(`metric.${key}`)} {goal.comparator === 'gte' ? '≥' : '≤'} <span className="text-gold tnum">{fmtMetric(key, goal.target)}</span>
        </span>
        <span className="text-xs text-muted tnum">
          {p.hits}/{p.games} · {t('goals.avg')} <span className={p.avgMet ? 'text-good' : 'text-bad'}>{METRICS[key] ? fmtMetric(key, p.avg) : '—'}</span>
        </span>
      </div>
      <Progress value={p.rate} tone={p.rate >= 0.7 ? 'good' : p.rate >= 0.45 ? 'warn' : 'bad'} />
    </div>
  )
}

export function MiniBars({ data, height = 120 }: { data: { label: string; value: number; games: number }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 0.01)
  return (
    <div className="flex items-end gap-2" style={{ height }} dir="ltr">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1" title={`${d.games} games`}>
          <span className="text-[10px] text-ink2 tnum">{d.games ? `${Math.round(d.value * 100)}%` : '—'}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px]"
              style={{ height: `${d.games ? Math.max(4, (d.value / max) * 100) : 2}%`, background: d.games ? (d.value >= 0.5 ? SERIES[0] : '#e66767') : AXIS }}
            />
          </div>
          <span className="text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
