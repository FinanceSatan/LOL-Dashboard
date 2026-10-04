import clsx from 'clsx'
import { BookOpen, Crosshair, Map as MapIcon, Shield, Swords, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { QUEUES } from '@shared/constants'
import type { MatchSummary, PlayerLine } from '@shared/types'
import { useT } from '@/i18n'
import { gameScore } from '@/lib/analytics'
import { ROLE_METRICS } from '@/lib/coach'
import { clock, dateTime } from '@/lib/format'
import { METRICS, benchmark, fmtMetric, metricScore } from '@/lib/metrics'
import { useApp } from '@/store/app'
import { LOSS, SERIES, TooltipBox, WIN, axisProps, Legend } from './charts'
import { ChampIcon, ItemIcon, ItemRow, RunePageView, SpellIcon, useChampName } from './game'
import { MiniMap } from './MiniMap'
import { Badge, Segmented } from './ui'
import { GradeBadge } from './widgets'
import { JournalEditor } from './JournalEditor'

type Tab = 'overview' | 'timeline' | 'map' | 'build' | 'analysis' | 'notes'

function TeamTable({ players, match, maxDamage, title, win }: { players: PlayerLine[]; match: MatchSummary; maxDamage: number; title: string; win: boolean }) {
  const t = useT()
  const champName = useChampName()
  const minutes = match.gameDuration / 60
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className={clsx('flex items-center justify-between px-3 py-2 text-xs font-bold', win ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss')}>
        <span>
          {title} · {win ? t('match.victory') : t('match.defeat')}
        </span>
        <span className="text-muted tnum" dir="ltr">
          {players.reduce((a, p) => a + p.kills, 0)} / {players.reduce((a, p) => a + p.deaths, 0)} / {players.reduce((a, p) => a + p.assists, 0)}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-1.5 text-start font-medium">{t('match.player')}</th>
            <th className="px-2 text-center font-medium">KDA</th>
            <th className="px-2 text-center font-medium">{t('match.damage')}</th>
            <th className="px-2 text-center font-medium">CS</th>
            <th className="px-2 text-center font-medium">{t('match.gold')}</th>
            <th className="px-2 text-center font-medium">{t('match.vision')}</th>
            <th className="px-2 text-start font-medium">{t('match.items')}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const isMe = p.puuid === match.me.puuid
            return (
              <tr key={p.puuid + p.championId} className={clsx('border-b border-line/60 last:border-0', isMe && 'bg-gold/5')}>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <ChampIcon id={p.championId} name={p.championName} size={30} />
                      <span className="absolute -bottom-1 -end-1 rounded bg-bg px-0.5 text-[9px] font-bold tnum">{p.level}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <SpellIcon id={p.spells[0]} size={13} />
                      <SpellIcon id={p.spells[1]} size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className={clsx('max-w-36 truncate font-semibold', isMe ? 'text-gold' : 'text-ink')}>{p.name.split('#')[0]}</div>
                      <div className="text-[10px] text-muted">{champName(p.championId, p.championName)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 text-center tnum" dir="ltr">
                  <div className="font-semibold">
                    {p.kills}/{p.deaths}/{p.assists}
                  </div>
                  <div className="text-[10px] text-muted">{((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(1)}</div>
                </td>
                <td className="w-28 px-2">
                  <div className="text-center tnum">{p.damage.toLocaleString('en-US')}</div>
                  <div className="mt-0.5 h-1 rounded-full bg-panel3">
                    <div className="h-full rounded-full" style={{ width: `${(p.damage / maxDamage) * 100}%`, background: p.teamId === match.me.teamId ? WIN : LOSS }} />
                  </div>
                </td>
                <td className="px-2 text-center tnum">
                  <div>{p.cs}</div>
                  <div className="text-[10px] text-muted">{(p.cs / minutes).toFixed(1)}</div>
                </td>
                <td className="px-2 text-center tnum">{(p.gold / 1000).toFixed(1)}k</td>
                <td className="px-2 text-center tnum">{p.visionScore}</td>
                <td className="px-2">
                  <ItemRow items={p.items} size={20} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function MatchDetail({ match: m, lpDelta }: { match: MatchSummary; lpDelta?: number }) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('overview')
  const tier = useApp((s) => s.settings?.targetTier ?? 'CHALLENGER')
  const items = useApp((s) => s.staticData?.items)
  const champName = useChampName()
  const score = gameScore(m, tier)
  const my = m.participants.filter((p) => p.teamId === m.me.teamId)
  const enemy = m.participants.filter((p) => p.teamId !== m.me.teamId)
  const maxDamage = Math.max(...m.participants.map((p) => p.damage), 1)
  const q = QUEUES[m.queueId]
  const role = m.me.role || 'MIDDLE'

  const evals = useMemo(
    () =>
      ROLE_METRICS[role]
        .map((k) => {
          const v = METRICS[k].get(m, items)
          const b = benchmark(k, role, tier)
          const s = v == null ? null : metricScore(k, v, role, tier)
          return { k, v, b, s }
        })
        .filter((e) => e.v != null),
    [m, role, tier, items]
  )

  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: t('match.tab.overview') },
    { value: 'timeline', label: t('match.tab.timeline') },
    { value: 'map', label: t('match.tab.map') },
    { value: 'build', label: t('match.tab.build') },
    { value: 'analysis', label: t('match.tab.analysis') },
    { value: 'notes', label: t('match.tab.notes') }
  ]

  return (
    <div>
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <ChampIcon id={m.me.championId} name={m.me.championName} size={56} rounded="lg" />
        <div>
          <div className="flex items-center gap-2">
            <span className={clsx('text-lg font-bold', m.win ? 'text-win' : 'text-loss')}>{m.remake ? t('match.remake') : m.win ? t('match.victory') : t('match.defeat')}</span>
            <GradeBadge score={score} />
            {lpDelta != null && (
              <Badge tone={lpDelta >= 0 ? 'good' : 'bad'}>
                <span dir="ltr">
                  {lpDelta > 0 ? '+' : ''}
                  {lpDelta} LP
                </span>
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {champName(m.me.championId, m.me.championName)} · {q ? (t.lang === 'fa' ? q.fa : q.en) : m.queueId} · {dateTime(m.gameCreation, t.lang)} · {clock(m.gameDuration)} ·{' '}
            {m.side === 'blue' ? t('match.blueSide') : t('match.redSide')} · {t('match.patch')} {m.gameVersion.split('.').slice(0, 2).join('.')}
          </div>
        </div>
        <div className="ms-auto grid grid-cols-4 gap-5 text-center">
          <div>
            <div className="text-base font-bold tnum" dir="ltr">
              {m.me.kills}/{m.me.deaths}/{m.me.assists}
            </div>
            <div className="text-[10px] text-muted">KDA {m.me.kda.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-base font-bold tnum">{m.me.csPerMin.toFixed(1)}</div>
            <div className="text-[10px] text-muted">CS/min</div>
          </div>
          <div>
            <div className="text-base font-bold tnum">{Math.round(m.me.killParticipation * 100)}%</div>
            <div className="text-[10px] text-muted">KP</div>
          </div>
          <div>
            <div className="text-base font-bold tnum">{Math.round(m.me.damageShare * 100)}%</div>
            <div className="text-[10px] text-muted">{t('match.dmgShare')}</div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>

      {tab === 'overview' && (
        <div className="space-y-3">
          <TeamTable players={my} match={m} maxDamage={maxDamage} title={t('match.yourTeam')} win={m.win} />
          <TeamTable players={enemy} match={m} maxDamage={maxDamage} title={t('match.enemyTeam')} win={!m.win} />
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[m.teamStats.myTeam, m.teamStats.enemyTeam].map((ts, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2 text-ink2">
                <span className="font-semibold text-ink">{i === 0 ? t('match.yourTeam') : t('match.enemyTeam')}</span>
                {(
                  [
                    ['DRAGON', ts.dragons],
                    ['HORDE', ts.hordes],
                    ['HERALD', ts.heralds],
                    ['BARON', ts.barons],
                    ['TOWER', ts.towers],
                    ['INHIBITOR', ts.inhibitors]
                  ] as const
                ).map(([k, n]) => (
                  <span key={k}>
                    {t.d(`obj.${k}`)} <b className="text-ink tnum">{n}</b>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-5">
          {m.timeline.length > 1 ? (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">{t('match.teamGoldDiff')}</div>
                  <Legend items={[{ label: t('match.teamGoldDiff'), color: SERIES[0] }]} />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={m.timeline}>
                    <defs>
                      <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={WIN} stopOpacity={0.4} />
                        <stop offset="50%" stopColor={WIN} stopOpacity={0.05} />
                        <stop offset="50%" stopColor={LOSS} stopOpacity={0.05} />
                        <stop offset="100%" stopColor={LOSS} stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="minute" {...axisProps} tickFormatter={(v) => `${v}m`} />
                    <YAxis {...axisProps} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                    <ReferenceLine y={0} stroke="#33445f" />
                    {m.objectives
                      .filter((o) => ['DRAGON', 'BARON', 'HERALD', 'ELDER'].includes(o.type))
                      .map((o, i) => (
                        <ReferenceLine
                          key={i}
                          x={Math.round(o.t / 60)}
                          stroke={o.team === m.me.teamId ? WIN : LOSS}
                          strokeOpacity={0.5}
                          label={{ value: o.type[0], fill: o.team === m.me.teamId ? WIN : LOSS, fontSize: 10, position: 'top' }}
                        />
                      ))}
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <TooltipBox
                            title={`${payload[0].payload.minute}:00`}
                            rows={[{ label: t('match.teamGoldDiff'), value: payload[0].payload.teamGoldDiff.toLocaleString('en-US'), color: SERIES[0] }]}
                          />
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="teamGoldDiff" stroke={SERIES[0]} strokeWidth={2} fill="url(#gd)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {m.opponent && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">{t('match.laneDuel', { champ: champName(m.opponent.championId, m.opponent.championName) })}</div>
                    <Legend
                      items={[
                        { label: t('common.you'), color: SERIES[0] },
                        { label: t('match.opponent'), color: SERIES[1] }
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(['myGold', 'myCs'] as const).map((key) => (
                      <ResponsiveContainer key={key} width="100%" height={180}>
                        <LineChart data={m.timeline.slice(0, 21)}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="minute" {...axisProps} tickFormatter={(v) => `${v}m`} />
                          <YAxis {...axisProps} width={44} />
                          <Tooltip
                            content={({ active, payload }) =>
                              active && payload?.length ? (
                                <TooltipBox
                                  title={`${payload[0].payload.minute}:00 · ${key === 'myGold' ? t('match.gold') : 'CS'}`}
                                  rows={[
                                    { label: t('common.you'), value: payload[0].payload[key], color: SERIES[0] },
                                    { label: t('match.opponent'), value: payload[0].payload[key === 'myGold' ? 'oppGold' : 'oppCs'] ?? '—', color: SERIES[1] }
                                  ]}
                                />
                              ) : null
                            }
                          />
                          <Line type="monotone" dataKey={key} stroke={SERIES[0]} strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey={key === 'myGold' ? 'oppGold' : 'oppCs'} stroke={SERIES[1]} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-2 text-sm font-semibold">{t('match.objectives')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {m.objectives
                    .filter((o) => o.type !== 'TOWER')
                    .map((o, i) => (
                      <span
                        key={i}
                        className={clsx('rounded-md border px-2 py-1 text-[11px] tnum', o.team === m.me.teamId ? 'border-win/30 text-win' : 'border-loss/30 text-loss')}
                      >
                        {clock(o.t)} · {t.d(`obj.${o.type}`)}
                        {o.subType && o.type === 'DRAGON' ? ` (${o.subType.replace('_DRAGON', '').toLowerCase()})` : ''}
                      </span>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-muted">{t('match.noTimeline')}</div>
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="flex flex-wrap gap-6">
          <MiniMap deaths={m.deaths} kills={m.kills} size={380} />
          <div className="min-w-64 flex-1 space-y-3 text-sm">
            <Legend
              items={[
                { label: t('map.kill'), color: WIN },
                { label: t('map.death'), color: LOSS }
              ]}
            />
            <div className="text-xs leading-relaxed text-muted">{t('match.mapHint')}</div>
            <div className="space-y-1.5">
              {m.deaths.map((d, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-panel2 px-3 py-1.5 text-xs">
                  <Crosshair size={12} className="text-loss" />
                  <span className="tnum">{clock(d.t)}</span>
                  <span className="text-muted">{d.t < 840 ? t('match.laningDeath') : t('match.midLateDeath')}</span>
                </div>
              ))}
              {m.deaths.length === 0 && <div className="text-xs text-muted">{t('match.noDeathsTracked')}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'build' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Shield size={14} className="text-gold" /> {t('match.itemOrder')}
            </div>
            {m.me.itemPurchases.length ? (
              <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                {m.me.itemPurchases
                  .filter((p) => items?.[p.id] ? !items[p.id].tags.includes('Consumable') : true)
                  .map((p, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <ItemIcon id={p.id} size={30} />
                      <span className="mt-0.5 text-[9px] text-muted tnum">{clock(p.t)}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <ItemRow items={m.me.items} size={30} />
            )}
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Swords size={14} className="text-gold" /> {t('match.runes')}
            </div>
            {m.me.runes ? <RunePageView page={m.me.runes} /> : <span className="text-xs text-muted">—</span>}
          </div>
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp size={14} className="text-gold" /> {t('match.skillOrder')}
            </div>
            {m.me.skillOrder ? (
              <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(18, minmax(0, 1fr))' }} dir="ltr">
                {(['Q', 'W', 'E', 'R'] as const).map((k) => (
                  <div key={k} className="contents">
                    <div className="pe-2 text-xs font-bold text-ink2">{k}</div>
                    {Array.from({ length: 18 }, (_, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'flex h-6 items-center justify-center rounded text-[10px] font-bold',
                          m.me.skillOrder[i] === k ? (k === 'R' ? 'bg-gold text-bg' : 'bg-accent text-white') : 'bg-panel2 text-transparent'
                        )}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted">—</span>
            )}
          </div>
        </div>
      )}

      {tab === 'analysis' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            {evals.map(({ k, v, b, s }) => (
              <div key={k} className="flex items-center gap-3 rounded-lg bg-panel2/60 px-3 py-2">
                <div className="w-40 text-xs text-ink2">{t.d(`metric.${k}`)}</div>
                <div className="w-16 text-sm font-semibold tnum">{fmtMetric(k, v)}</div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-panel3">
                    <div
                      className={clsx('h-full rounded-full', (s ?? 0) >= 78 ? 'bg-good' : (s ?? 0) >= 62 ? 'bg-warn' : 'bg-bad')}
                      style={{ width: `${s ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-end text-[11px] text-muted tnum">{fmtMetric(k, b)}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-ink2">
            <div className="rounded-xl border border-line p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-ink">
                <MapIcon size={14} className="text-gold" /> {t('match.keyFacts')}
              </div>
              <ul className="list-inside list-disc space-y-1 text-[13px]">
                {m.laning && <li>{t('match.fact.cs10', { cs: m.laning.csAt10, diff: m.laning.csDiffAt10 ?? '—' })}</li>}
                {m.laning?.goldDiffAt15 != null && <li>{t('match.fact.gold15', { diff: m.laning.goldDiffAt15 })}</li>}
                {m.laning && <li>{t('match.fact.earlyDeaths', { n: m.laning.deathsBefore14 })}</li>}
                {m.laning?.firstBloodInvolved && <li>{t('match.fact.firstBlood')}</li>}
                <li>{t('match.fact.deadTime', { pct: Math.round((m.me.timeDead / Math.max(1, m.gameDuration)) * 100) })}</li>
                {m.me.soloKills != null && <li>{t('match.fact.soloKills', { n: m.me.soloKills })}</li>}
                {m.me.skillshotsHit != null && m.me.skillshotsDodged != null && (
                  <li>{t('match.fact.skillshots', { hit: m.me.skillshotsHit, dodged: m.me.skillshotsDodged })}</li>
                )}
                <li>{t('match.fact.vision', { score: m.me.visionScore, cw: m.me.controlWards })}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-line p-4 text-xs text-muted">{t('match.analysisHint')}</div>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookOpen size={14} className="text-gold" /> {t('match.reviewNotes')}
          </div>
          <JournalEditor match={m} />
        </div>
      )}
    </div>
  )
}
