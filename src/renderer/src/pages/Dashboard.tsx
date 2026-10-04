import clsx from 'clsx'
import { ArrowUpRight, Brain, Coffee, Flame, History, Target, Trophy, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PLATFORMS, absoluteLp, isApexTier } from '@shared/constants'
import { ChampIcon, ProfileIcon, RankEmblem, TierText, rankText, useChampName } from '@/components/game'
import { Badge, Button, Card, DeltaChip, Empty, Progress, Stat, WinLossPills } from '@/components/ui'
import { GoalLine, InsightCard, LpChart, MatchRow, SkillRadar } from '@/components/widgets'
import { useT } from '@/i18n'
import {
  championStats,
  currentStreak,
  gamesToday,
  lpDeltaByMatch,
  metricAvg,
  skillProfile,
  winrate
} from '@/lib/analytics'
import { analyze, estimateTier } from '@/lib/coach'
import { pct, timeAgo } from '@/lib/format'
import { METRICS, benchmark, fmtMetric, type MetricKey } from '@/lib/metrics'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'

const KPI: MetricKey[] = ['kda', 'csPerMin', 'csAt10', 'kp', 'visionPerMin', 'deathsBefore14']

export function Dashboard() {
  const t = useT()
  const navigate = useNavigate()
  const data = useApp((s) => s.data)!
  const settings = useApp((s) => s.settings)!
  const runSync = useApp((s) => s.runSync)
  const syncing = useApp((s) => s.syncing)
  const champName = useChampName()
  const a = useAnalysis()

  const view = useMemo(() => {
    const w = a.windowed
    const insights = analyze(w, a.role, a.tier, a.items)
    const profile = skillProfile(w.filter((m) => m.me.role === a.role).length >= 5 ? w.filter((m) => m.me.role === a.role) : w, a.role, a.tier)
    const today = gamesToday(a.filtered)
    const lpDeltas = lpDeltaByMatch(data.matches, data.rankHistory)
    const todayLp = today.reduce((s, m) => s + (lpDeltas.get(m.matchId) ?? 0), 0)
    const est = estimateTier(w, a.role, undefined, a.items)
    const champs = championStats(w, a.tier).slice(0, 5)
    return { insights, profile, today, todayLp, lpDeltas, est, champs, streak: currentStreak(a.filtered) }
  }, [a, data])

  if (!a.all.length) {
    return (
      <Card>
        <Empty
          icon={<History size={36} />}
          title={t('dash.noData')}
          body={t('dash.noDataBody')}
          action={
            <Button variant="primary" loading={syncing} onClick={() => void runSync()}>
              {t('layout.sync')}
            </Button>
          }
        />
      </Card>
    )
  }

  const solo = a.solo
  const acc = data.account
  const wr = winrate(a.windowed)
  const soloWr = solo ? solo.wins / Math.max(1, solo.wins + solo.losses) : null
  const abs = solo ? absoluteLp(solo.tier, solo.rank, solo.leaguePoints) : null
  const toMaster = abs != null ? Math.max(0, 2800 - abs) : null
  const divisionProgress = solo ? (isApexTier(solo.tier) ? Math.min(1, solo.leaguePoints / 1000) : solo.leaguePoints / 100) : 0
  const lossStreak = view.streak.type === 'L' ? view.streak.count : 0
  const tiltLevel = Math.min(3, Math.floor(lossStreak / Math.max(1, settings.tilt.lossStreak - 1)) + (view.today.length >= settings.tilt.maxGamesPerDay ? 1 : 0))

  return (
    <div className="fade-in space-y-5">
      {/* Hero */}
      <div className="grid grid-cols-12 gap-4">
        <section className="relative col-span-12 overflow-hidden rounded-2xl border border-line bg-panel card-glow xl:col-span-8">
          <div className="absolute inset-0 bg-gradient-to-l from-accent/10 via-transparent to-gold/10" />
          <div className="relative flex flex-wrap items-center gap-6 p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <ProfileIcon id={acc.profileIconId} size={76} className="ring-2 ring-gold/60" />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-gold/50 bg-bg px-2 py-0.5 text-[10px] font-bold text-gold2 tnum">
                  {acc.summonerLevel ?? '—'}
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight">
                  <bdi>
                    {acc.gameName}
                    <span className="ms-1 text-base font-medium text-muted">#{acc.tagLine}</span>
                  </bdi>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge>{acc.demo ? 'DEMO' : PLATFORMS.find((p) => p.id === acc.platform)?.label}</Badge>
                  <Badge tone="accent">{t.d(`role.${a.role}`)}</Badge>
                  {view.est && (
                    <Badge tone="gold">
                      {t('dash.statsLevel')}: {view.est.charAt(0) + view.est.slice(1).toLowerCase()}
                    </Badge>
                  )}
                  {data.lastSync && <span>{t('layout.lastSync', { ago: timeAgo(data.lastSync, t.lang) })}</span>}
                </div>
                <div className="mt-3">
                  <WinLossPills results={a.filtered.slice(0, 15).map((m) => m.win).reverse()} />
                </div>
              </div>
            </div>
            <div className="ms-auto flex items-center gap-5 rounded-xl border border-line bg-bg/40 px-5 py-4">
              <div className="flex h-20 w-20 items-center justify-center">
                <RankEmblem tier={solo?.tier} size={72} />
              </div>
              <div className="min-w-48">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('rank.soloDuo')}</div>
                {solo ? (
                  <>
                    <div className="mt-0.5 text-xl font-bold">
                      <bdi>
                        <TierText tier={solo.tier} /> {!isApexTier(solo.tier) && <span className="text-ink">{solo.rank}</span>}
                      </bdi>
                    </div>
                    <div className="text-sm text-ink2 tnum">
                      <bdi>
                        {solo.leaguePoints} LP · {solo.wins}W {solo.losses}L ·{' '}
                        <span className={soloWr! >= 0.5 ? 'text-good' : 'text-bad'}>{pct(soloWr)}</span>
                      </bdi>
                    </div>
                    <Progress value={divisionProgress} tone="gold" className="mt-2" />
                    {toMaster != null && toMaster > 0 && (
                      <div className="mt-1.5 text-[11px] text-muted tnum">{t('dash.toMaster', { lp: toMaster })}</div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted">{t('rank.unranked')}</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Session / tilt */}
        <Card
          className="col-span-12 xl:col-span-4"
          title={t('dash.session')}
          icon={tiltLevel >= 2 ? <Coffee size={15} /> : <Zap size={15} />}
          actions={<Badge tone={tiltLevel >= 2 ? 'bad' : tiltLevel === 1 ? 'warn' : 'good'}>{t.d(`dash.tilt${tiltLevel}`)}</Badge>}
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold tnum">{view.today.length}</div>
              <div className="text-[11px] text-muted">{t('dash.gamesToday')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold tnum" dir="ltr">
                <span className="text-win">{view.today.filter((m) => m.win).length}</span>
                <span className="text-muted">-</span>
                <span className="text-loss">{view.today.filter((m) => !m.win).length}</span>
              </div>
              <div className="text-[11px] text-muted">{t('dash.record')}</div>
            </div>
            <div>
              <div className={clsx('text-2xl font-bold tnum', view.todayLp >= 0 ? 'text-good' : 'text-bad')} dir="ltr">
                {view.todayLp > 0 ? '+' : ''}
                {view.todayLp}
              </div>
              <div className="text-[11px] text-muted">{t('dash.lpToday')}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-line bg-bg/50 p-3 text-[12.5px] leading-relaxed text-ink2">
            {view.streak.type === 'W' && view.streak.count >= 2 && (
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-good">
                <Flame size={14} /> {t('dash.winStreak', { count: view.streak.count })}
              </div>
            )}
            {t.d(`dash.tiltAdvice${tiltLevel}`, { max: settings.tilt.maxGamesPerDay })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
            <span>{t('dash.dailyLimit')}</span>
            <span className="tnum">
              {view.today.length}/{settings.tilt.maxGamesPerDay}
            </span>
          </div>
          <Progress
            value={view.today.length}
            max={settings.tilt.maxGamesPerDay}
            tone={view.today.length >= settings.tilt.maxGamesPerDay ? 'bad' : 'accent'}
            className="mt-1.5"
          />
        </Card>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <Stat
          label={t('dash.winrate', { n: a.windowed.length })}
          value={pct(wr)}
          tone={wr >= 0.55 ? 'good' : wr < 0.47 ? 'bad' : undefined}
          sub={`${a.windowed.filter((m) => m.win).length}W ${a.windowed.filter((m) => !m.win).length}L`}
        />
        {KPI.map((k) => {
          const v = metricAvg(a.windowed, k, a.items)
          const b = benchmark(k, a.role, a.tier)
          return (
            <Stat
              key={k}
              label={t.d(`metric.${k}`)}
              value={fmtMetric(k, v)}
              sub={
                <span className="flex items-center gap-1.5">
                  <span className="text-muted">{t('common.target')}</span>
                  <DeltaChip value={v} target={b} higherIsBetter={METRICS[k].higherIsBetter} format={(x) => fmtMetric(k, x)} />
                </span>
              }
            />
          )
        })}
      </div>

      {/* LP + radar */}
      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 xl:col-span-8"
          title={t('dash.lpProgress')}
          icon={<Trophy size={15} />}
          subtitle={solo ? rankText(solo.tier, solo.rank, solo.leaguePoints) : undefined}
          actions={
            <Link to="/tools" className="flex items-center gap-1 text-xs text-accent hover:underline">
              {t('dash.climbPlanner')} <ArrowUpRight size={13} />
            </Link>
          }
        >
          <LpChart history={a.rankHistory} height={250} />
        </Card>
        <Card
          className="col-span-12 xl:col-span-4"
          title={t('dash.skillProfile')}
          icon={<Target size={15} />}
          subtitle={t('dash.skillProfileSub', { tier: a.tier.charAt(0) + a.tier.slice(1).toLowerCase() })}
        >
          <SkillRadar profile={view.profile} height={250} />
        </Card>
      </div>

      {/* Coach + goals + champs */}
      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 xl:col-span-5"
          title={t('dash.coachTop')}
          icon={<Brain size={15} />}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/coach')}>
              {t('common.viewAll')}
            </Button>
          }
        >
          <div className="space-y-2.5">
            {view.insights.filter((i) => i.kind !== 'strength').slice(0, 3).map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
            {view.insights.filter((i) => i.kind !== 'strength').length === 0 && <div className="text-sm text-muted">{t('coach.none')}</div>}
          </div>
        </Card>
        <Card
          className="col-span-12 md:col-span-6 xl:col-span-3"
          title={t('dash.goals')}
          icon={<Target size={15} />}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/goals')}>
              {t('common.manage')}
            </Button>
          }
        >
          <div className="space-y-4">
            {data.goals.filter((g) => g.active).map((g) => (
              <GoalLine key={g.id} goal={g} matches={a.filtered} />
            ))}
            {data.goals.filter((g) => g.active).length === 0 && <div className="text-sm text-muted">{t('goals.empty')}</div>}
          </div>
        </Card>
        <Card
          className="col-span-12 md:col-span-6 xl:col-span-4"
          title={t('dash.topChamps')}
          icon={<Flame size={15} />}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/champions')}>
              {t('common.viewAll')}
            </Button>
          }
        >
          <div className="space-y-2">
            {view.champs.map((c) => {
              const cwr = c.wins / c.games
              return (
                <div key={c.championId} className="flex items-center gap-3">
                  <ChampIcon id={c.championId} name={c.championName} size={34} rounded="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{champName(c.championId, c.championName)}</div>
                    <div className="text-[11px] text-muted tnum">
                      {c.games} {t('common.games')} · {((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(2)} KDA · {c.csPerMin.toFixed(1)} CS/m
                    </div>
                  </div>
                  <div className={clsx('text-sm font-bold tnum', cwr >= 0.55 ? 'text-good' : cwr < 0.47 ? 'text-bad' : 'text-ink')}>{pct(cwr)}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Recent games */}
      <Card
        title={t('dash.recent')}
        icon={<History size={15} />}
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('/matches')}>
            {t('common.viewAll')}
          </Button>
        }
      >
        <div className="space-y-2">
          {data.matches.slice(0, 6).map((m) => (
            <MatchRow key={m.matchId} m={m} lpDelta={view.lpDeltas.get(m.matchId)} onClick={() => navigate(`/matches/${m.matchId}`)} />
          ))}
        </div>
      </Card>
    </div>
  )
}
