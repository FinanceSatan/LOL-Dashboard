import clsx from 'clsx'
import { Activity, Clock, Map as MapIcon, Swords, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts'
import { ROLES } from '@shared/types'
import { GOLD, Legend, SERIES, TooltipBox, axisProps, LOSS, WIN } from '@/components/charts'
import { RoleIcon } from '@/components/game'
import { MiniMap } from '@/components/MiniMap'
import { Card, PageHeader, Segmented, Stat } from '@/components/ui'
import { MiniBars } from '@/components/widgets'
import { useT } from '@/i18n'
import {
  averageCurves,
  deathZones,
  durationBuckets,
  gameScore,
  hourBuckets,
  leadConversion,
  longestStreaks,
  metricAvg,
  roleStats,
  rolling,
  sideStats,
  tiltStats,
  trendDelta,
  weekdayBuckets,
  winrateByGameInSession
} from '@/lib/analytics'
import { pct, weekdayName } from '@/lib/format'
import { METRICS, benchmark, fmtMetric, type MetricKey } from '@/lib/metrics'
import { useAnalysis } from '@/store/analysis'

const TREND_METRICS: MetricKey[] = ['csPerMin', 'csAt10', 'kda', 'kp', 'dpm', 'visionPerMin', 'deaths', 'goldDiffAt15', 'deathsBefore14', 'controlWards', 'firstItemMin']

export function Analytics() {
  const t = useT()
  const a = useAnalysis()
  const [metric, setMetric] = useState<MetricKey>('csPerMin')
  const [scope, setScope] = useState<'window' | 'all'>('all')
  const matches = scope === 'window' ? a.windowed : a.filtered

  const v = useMemo(() => {
    return {
      trend: rolling(matches, metric, 10, a.items),
      scores: [...matches].reverse().map((m, i) => ({ i: i + 1, score: Math.round(gameScore(m, a.tier)), win: m.win })),
      curves: averageCurves(matches),
      zones: deathZones(matches),
      hours: hourBuckets(matches),
      weekdays: weekdayBuckets(matches),
      durations: durationBuckets(matches),
      sessionIdx: winrateByGameInSession(matches),
      sides: sideStats(matches),
      lead: leadConversion(matches),
      roles: roleStats(matches, a.tier),
      tilt: tiltStats(matches),
      streaks: longestStreaks(matches),
      deaths: matches.flatMap((m) => m.deaths),
      kills: matches.flatMap((m) => m.kills)
    }
  }, [matches, metric, a.items, a.tier])

  const bench = benchmark(metric, a.role, a.tier)
  const delta = trendDelta(matches, metric, a.items)
  const def = METRICS[metric]
  const improving = delta == null ? null : def.higherIsBetter ? delta > 0 : delta < 0

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.analytics')}
        subtitle={t('analytics.subtitle', { n: matches.length })}
        actions={
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'window', label: t('analytics.recent', { n: a.windowed.length }) },
              { value: 'all', label: t('analytics.allGames') }
            ]}
          />
        }
      />

      {/* Trend explorer */}
      <Card
        title={t('analytics.trend')}
        icon={<TrendingUp size={15} />}
        subtitle={t('analytics.trendSub')}
        actions={
          delta != null && (
            <span className={clsx('text-xs font-semibold', improving ? 'text-good' : 'text-bad')}>
              {improving ? '▲' : '▼'} {t(improving ? 'analytics.improving' : 'analytics.declining')} ({delta > 0 ? '+' : ''}
              {fmtMetric(metric, delta).replace('+', '')})
            </span>
          )
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TREND_METRICS.map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                metric === k ? 'border-accent bg-accent/15 text-ink' : 'border-line2 text-ink2 hover:bg-panel2'
              )}
            >
              {t.d(`metric.${k}`)}
            </button>
          ))}
        </div>
        <div className="mb-2 flex items-center justify-between">
          <Legend
            items={[
              { label: t('analytics.perGame'), color: '#33445f' },
              { label: t('analytics.avg10'), color: SERIES[0] },
              { label: t('analytics.benchmark', { tier: a.tier.charAt(0) + a.tier.slice(1).toLowerCase() }), color: GOLD, dashed: true }
            ]}
          />
          <span className="text-xs text-muted">
            {t('common.avg')}: <b className="text-ink tnum">{fmtMetric(metric, metricAvg(matches, metric, a.items))}</b>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={v.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="i" {...axisProps} />
            <YAxis {...axisProps} width={46} domain={['auto', 'auto']} tickFormatter={(x) => fmtMetric(metric, x)} />
            {bench != null && <ReferenceLine y={bench} stroke={GOLD} strokeDasharray="5 5" />}
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`#${payload[0].payload.i}`}
                    rows={[
                      { label: t('analytics.perGame'), value: fmtMetric(metric, payload[0].payload.value), color: '#6f7d93' },
                      { label: t('analytics.avg10'), value: fmtMetric(metric, payload[0].payload.avg), color: SERIES[0] }
                    ]}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="value" stroke="#33445f" strokeWidth={1.5} dot={{ r: 2, fill: '#33445f' }} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke={SERIES[0]} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* KPIs row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label={t('analytics.blueSide')} value={pct(v.sides.blue.winrate)} sub={`${v.sides.blue.games} ${t('common.games')}`} />
        <Stat label={t('analytics.redSide')} value={pct(v.sides.red.winrate)} sub={`${v.sides.red.games} ${t('common.games')}`} />
        <Stat
          label={t('analytics.leadConv')}
          value={pct(v.lead.ahead.winrate)}
          tone={v.lead.ahead.winrate >= 0.75 ? 'good' : v.lead.ahead.winrate < 0.6 ? 'bad' : undefined}
          sub={t('analytics.leadConvSub', { n: v.lead.ahead.games })}
        />
        <Stat label={t('analytics.comeback')} value={pct(v.lead.behind.winrate)} sub={t('analytics.comebackSub', { n: v.lead.behind.games })} />
        <Stat label={t('analytics.afterLoss')} value={pct(v.tilt.afterLoss.winrate)} tone={v.tilt.afterLoss.winrate < 0.45 ? 'bad' : undefined} sub={t('analytics.afterWin', { wr: pct(v.tilt.afterWin.winrate) })} />
        <Stat label={t('analytics.streaks')} value={<span dir="ltr">{v.streaks.win}W / {v.streaks.loss}L</span>} sub={t('analytics.longest')} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Laning curves */}
        <Card className="col-span-12 xl:col-span-7" title={t('analytics.curves')} icon={<Swords size={15} />} subtitle={t('analytics.curvesSub')}>
          <div className="mb-2">
            <Legend
              items={[
                { label: t('analytics.teamGold'), color: SERIES[0] },
                { label: t('analytics.laneGold'), color: SERIES[1] }
              ]}
            />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={v.curves}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="minute" {...axisProps} tickFormatter={(x) => `${x}m`} />
              <YAxis {...axisProps} width={48} />
              <ReferenceLine y={0} stroke="#33445f" />
              <ReferenceLine x={14} stroke="#33445f" label={{ value: '14:00', fill: '#6f7d93', fontSize: 10, position: 'top' }} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={`${payload[0].payload.minute}:00`}
                      rows={[
                        { label: t('analytics.teamGold'), value: payload[0].payload.teamGold, color: SERIES[0] },
                        { label: t('analytics.laneGold'), value: payload[0].payload.laneGold ?? '—', color: SERIES[1] },
                        { label: 'CS diff', value: payload[0].payload.csDiff ?? '—' }
                      ]}
                    />
                  ) : null
                }
              />
              <Area type="monotone" dataKey="teamGold" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="laneGold" stroke={SERIES[1]} fill={SERIES[1]} fillOpacity={0.08} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Death heatmap */}
        <Card className="col-span-12 xl:col-span-5" title={t('analytics.deathMap')} icon={<MapIcon size={15} />} subtitle={t('analytics.deathMapSub', { n: v.deaths.length })}>
          <div className="flex flex-wrap items-start gap-4">
            <MiniMap deaths={v.deaths} size={250} heat />
            <div className="min-w-40 flex-1 space-y-3 text-sm">
              <div>
                <div className="text-[11px] text-muted">{t('analytics.enemyHalf')}</div>
                <div className={clsx('text-2xl font-bold tnum', v.zones.enemyShare > 0.55 ? 'text-bad' : 'text-ink')}>{pct(v.zones.enemyShare)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">{t('analytics.earlyDeaths')}</div>
                <div className="text-2xl font-bold tnum">{v.zones.total ? pct(v.zones.early / v.zones.total) : '—'}</div>
              </div>
              <p className="text-xs leading-relaxed text-muted">{t('analytics.deathMapHint')}</p>
            </div>
          </div>
        </Card>

        {/* Performance score scatter */}
        <Card className="col-span-12 xl:col-span-7" title={t('analytics.scoreTitle')} icon={<Activity size={15} />} subtitle={t('analytics.scoreSub')}>
          <div className="mb-2">
            <Legend
              items={[
                { label: t('match.victory'), color: WIN },
                { label: t('match.defeat'), color: LOSS }
              ]}
            />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="i" type="number" {...axisProps} domain={[0, 'dataMax']} />
              <YAxis dataKey="score" type="number" {...axisProps} domain={[0, 100]} width={34} />
              <ZAxis range={[40, 40]} />
              <ReferenceLine y={80} stroke={GOLD} strokeDasharray="5 5" />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox title={`#${payload[0].payload.i}`} rows={[{ label: t('analytics.score'), value: payload[0].payload.score }]} />
                  ) : null
                }
              />
              <Scatter data={v.scores.filter((s) => s.win)} fill={WIN} />
              <Scatter data={v.scores.filter((s) => !s.win)} fill={LOSS} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>

        {/* Roles */}
        <Card className="col-span-12 xl:col-span-5" title={t('analytics.roles')} icon={<Swords size={15} />}>
          <div className="space-y-2.5">
            {ROLES.map((r) => {
              const rs = v.roles.find((x) => x.role === r)
              const wr = rs ? rs.wins / rs.games : NaN
              return (
                <div key={r} className="flex items-center gap-3">
                  <RoleIcon role={r} size={20} />
                  <div className="w-24 text-sm">{t.d(`role.${r}`)}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-panel3">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${rs ? (rs.games / Math.max(1, matches.length)) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="w-14 text-end text-xs text-muted tnum">{rs?.games ?? 0}</div>
                  <div className={clsx('w-12 text-end text-sm font-semibold tnum', wr >= 0.5 ? 'text-good' : rs ? 'text-bad' : 'text-muted')}>{rs ? pct(wr) : '—'}</div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Time patterns */}
        <Card className="col-span-12 md:col-span-6 xl:col-span-3" title={t('analytics.byHour')} icon={<Clock size={15} />}>
          <MiniBars data={v.hours.map((h) => ({ label: h.label, value: h.winrate, games: h.games }))} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-3" title={t('analytics.byWeekday')} icon={<Clock size={15} />}>
          <MiniBars data={v.weekdays.map((d) => ({ label: weekdayName(d.day, t.lang), value: d.winrate, games: d.games }))} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-3" title={t('analytics.byDuration')} icon={<Clock size={15} />}>
          <MiniBars data={v.durations.map((d) => ({ label: d.label, value: d.winrate, games: d.games }))} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-3" title={t('analytics.bySessionGame')} icon={<Clock size={15} />}>
          <MiniBars data={v.sessionIdx.map((d) => ({ label: d.index >= 6 ? '6+' : `#${d.index}`, value: d.winrate, games: d.games }))} />
        </Card>
      </div>
    </div>
  )
}
