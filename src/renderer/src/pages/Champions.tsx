import clsx from 'clsx'
import { ArrowDownUp, Award, Send, Shield, Star, Swords, ThumbsDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ChampionDetail } from '@shared/types'
import { ChampIcon, ItemIcon, RunePageView, useChampName } from '@/components/game'
import { Badge, Button, Card, Empty, PageHeader, Segmented } from '@/components/ui'
import { GradeBadge } from '@/components/widgets'
import { useT } from '@/i18n'
import { championStats, commonSkillOrder, coreItems, grade, matchupStats, maxOrder, runePages, type ChampAgg } from '@/lib/analytics'
import { abilityIconUrl, champCenteredUrl, champKey, passiveIconUrl, stripHtml } from '@/lib/dd'
import { pct, signed, timeAgo } from '@/lib/format'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'

type SortKey = 'games' | 'wr' | 'kda' | 'cs' | 'dpm' | 'score'

export function ChampionDeepDive({ championId, compact }: { championId: number; compact?: boolean }) {
  const t = useT()
  const a = useAnalysis()
  const sd = useApp((s) => s.staticData)
  const lcu = useApp((s) => s.lcu)
  const toast = useApp((s) => s.toast)
  const champName = useChampName()
  const [detail, setDetail] = useState<ChampionDetail | null>(null)
  const key = champKey(sd, championId)

  useEffect(() => {
    let alive = true
    setDetail(null)
    if (!key) return
    void window.api.getChampionDetail(key).then((r) => alive && r.ok && setDetail(r.data))
    return () => {
      alive = false
    }
  }, [key])

  const pages = useMemo(() => runePages(a.all, championId).slice(0, 3), [a.all, championId])
  const build = useMemo(() => coreItems(a.all, championId, sd?.items).slice(0, 8), [a.all, championId, sd])
  const skills = useMemo(() => commonSkillOrder(a.all, championId), [a.all, championId])
  const matchups = useMemo(() => matchupStats(a.filtered, championId).slice(0, 8), [a.filtered, championId])

  const push = async (idx: number) => {
    const res = await window.api.pushRunePage(pages[idx].page, champName(championId))
    toast(res.ok ? t('champs.runesPushed') : t.err(res.error), res.ok ? 'success' : 'error')
  }

  return (
    <div className="space-y-4">
      {!compact && key && (
        <div className="relative h-36 overflow-hidden rounded-xl border border-line">
          <img src={champCenteredUrl(key)} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/40 to-transparent" />
          <div className="absolute bottom-3 start-4">
            <div className="text-2xl font-bold">{champName(championId)}</div>
            <div className="text-xs text-ink2">{detail?.title}</div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Star size={14} className="text-gold" /> {t('champs.bestRunes')}
        </div>
        {pages.length === 0 && <div className="text-xs text-muted">{t('champs.noRunes')}</div>}
        <div className="space-y-2">
          {pages.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel2/50 p-2.5">
              <RunePageView page={p.page} compact={compact} />
              <div className="ms-auto flex items-center gap-2">
                <span className="text-xs text-muted tnum">
                  {p.games} {t('common.games')} · <b className={p.wins / p.games >= 0.5 ? 'text-good' : 'text-bad'}>{pct(p.wins / p.games)}</b>
                </span>
                <Button size="sm" icon={<Send size={13} />} disabled={!lcu.connected} title={!lcu.connected ? t('champs.needClient') : undefined} onClick={() => void push(i)}>
                  {t('champs.pushRunes')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Shield size={14} className="text-gold" /> {t('champs.coreItems')}
          </div>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {build.map((b) => (
              <div key={b.id} className="flex flex-col items-center" title={`${b.games} games`}>
                <ItemIcon id={b.id} size={34} />
                <span className="mt-0.5 text-[10px] text-muted tnum">{pct(b.wins / b.games)}</span>
              </div>
            ))}
            {build.length === 0 && <span className="text-xs text-muted">—</span>}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Swords size={14} className="text-gold" /> {t('champs.skillOrder')}
          </div>
          {skills ? (
            <div>
              <div className="text-sm font-bold text-gold2" dir="ltr">
                {maxOrder(skills)}
              </div>
              <div className="mt-1 font-mono text-xs tracking-widest text-muted" dir="ltr">
                {skills}
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Swords size={14} className="text-gold" /> {t('champs.matchups')}
        </div>
        {matchups.length ? (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted">
              <tr className="border-b border-line">
                <th className="py-1.5 text-start font-medium">{t('champs.vs')}</th>
                <th className="text-center font-medium">{t('common.games')}</th>
                <th className="text-center font-medium">WR</th>
                <th className="text-center font-medium">CS@10</th>
                <th className="text-center font-medium">Gold@15</th>
                <th className="text-center font-medium">{t('champs.laneDeaths')}</th>
              </tr>
            </thead>
            <tbody>
              {matchups.map((mu) => (
                <tr key={mu.enemyChampionId} className="border-b border-line/50">
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <ChampIcon id={mu.enemyChampionId} name={mu.enemyChampionName} size={24} />
                      {champName(mu.enemyChampionId, mu.enemyChampionName)}
                    </div>
                  </td>
                  <td className="text-center tnum">{mu.games}</td>
                  <td className={clsx('text-center font-semibold tnum', mu.wins / mu.games >= 0.5 ? 'text-good' : 'text-bad')}>{pct(mu.wins / mu.games)}</td>
                  <td className={clsx('text-center tnum', (mu.csDiff10 ?? 0) >= 0 ? 'text-good' : 'text-bad')}>{signed(mu.csDiff10, 1)}</td>
                  <td className={clsx('text-center tnum', (mu.goldDiff15 ?? 0) >= 0 ? 'text-good' : 'text-bad')}>{signed(mu.goldDiff15)}</td>
                  <td className="text-center tnum">{mu.laneDeaths?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-xs text-muted">{t('champs.noMatchups')}</div>
        )}
      </div>

      {detail && !compact && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Award size={14} className="text-gold" /> {t('champs.abilities')}
          </div>
          <div className="space-y-2">
            <div className="flex gap-3 rounded-lg bg-panel2/50 p-2.5">
              <img src={passiveIconUrl(sd, detail.passive.image)} alt="" className="h-9 w-9 rounded" />
              <div>
                <div className="text-xs font-semibold">
                  {detail.passive.name} <span className="text-muted">(P)</span>
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted" dir="ltr">
                  {stripHtml(detail.passive.description)}
                </div>
              </div>
            </div>
            {detail.spells.map((s, i) => (
              <div key={s.id} className="flex gap-3 rounded-lg bg-panel2/50 p-2.5">
                <img src={abilityIconUrl(sd, s.image)} alt="" className="h-9 w-9 rounded" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {s.name} <span className="text-muted">({'QWER'[i]})</span>
                    <Badge tone="accent">CD {s.cooldownBurn}s</Badge>
                    {s.costBurn && s.costBurn !== '0' && <Badge>{s.costBurn}</Badge>}
                  </div>
                  <div className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-muted" dir="ltr">
                    {stripHtml(s.description)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(detail.allytips.length > 0 || detail.enemytips.length > 0) && (
            <div className="mt-3 grid grid-cols-1 gap-3 text-[11px] leading-relaxed text-ink2 md:grid-cols-2" dir="ltr">
              <div className="rounded-lg border border-line p-2.5">
                <div className="mb-1 font-semibold text-good">Playing as</div>
                {detail.allytips.slice(0, 3).map((x, i) => (
                  <p key={i}>• {x}</p>
                ))}
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <div className="mb-1 font-semibold text-bad">Playing against</div>
                {detail.enemytips.slice(0, 3).map((x, i) => (
                  <p key={i}>• {x}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Champions() {
  const t = useT()
  const a = useAnalysis()
  const champName = useChampName()
  const [sort, setSort] = useState<SortKey>('games')
  const [scope, setScope] = useState<'analysis' | 'all'>('analysis')
  const list = scope === 'all' ? a.all.filter((m) => !m.remake) : a.filtered
  const stats = useMemo(() => championStats(list, a.tier), [list, a.tier])
  const [selected, setSelected] = useState<number | null>(null)
  const sel = selected ?? stats[0]?.championId ?? null

  const sorted = useMemo(() => {
    const val = (c: ChampAgg) =>
      sort === 'games' ? c.games : sort === 'wr' ? c.confidenceWr : sort === 'kda' ? (c.kills + c.assists) / Math.max(1, c.deaths) : sort === 'cs' ? c.csPerMin : sort === 'dpm' ? c.dpm : c.avgScore
    return [...stats].sort((x, y) => val(y) - val(x))
  }, [stats, sort])

  const pool = useMemo(() => {
    const ok = stats.filter((c) => c.games >= 5).sort((x, y) => y.confidenceWr - x.confidenceWr)
    return {
      core: ok.slice(0, 3),
      drop: stats.filter((c) => c.games >= 6 && c.wins / c.games < 0.45).slice(0, 3)
    }
  }, [stats])

  if (!stats.length) {
    return (
      <Card>
        <Empty title={t('dash.noData')} />
      </Card>
    )
  }

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-2 py-2 text-center font-medium">
      <button onClick={() => setSort(k)} className={clsx('inline-flex items-center gap-1', sort === k ? 'text-gold' : 'hover:text-ink2')}>
        {children}
        <ArrowDownUp size={11} />
      </button>
    </th>
  )

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.champions')}
        subtitle={t('champs.subtitle')}
        actions={
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'analysis', label: t('champs.scopeAnalysis') },
              { value: 'all', label: t('champs.scopeAll') }
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title={t('champs.recommendedPool')} icon={<Star size={15} />} subtitle={t('champs.recommendedPoolSub')}>
          <div className="flex flex-wrap gap-3">
            {pool.core.map((c, i) => (
              <button key={c.championId} onClick={() => setSelected(c.championId)} className="flex items-center gap-2.5 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2">
                <ChampIcon id={c.championId} name={c.championName} size={36} rounded="lg" />
                <div className="text-start">
                  <div className="text-[10px] font-semibold uppercase text-gold">{t.d(`champs.poolRole${i}`)}</div>
                  <div className="text-sm font-semibold">{champName(c.championId, c.championName)}</div>
                  <div className="text-[11px] text-muted tnum">
                    {pct(c.wins / c.games)} · {c.games} {t('common.games')}
                  </div>
                </div>
              </button>
            ))}
            {pool.core.length === 0 && <div className="text-sm text-muted">{t('champs.needMoreGames')}</div>}
          </div>
        </Card>
        <Card title={t('champs.considerDropping')} icon={<ThumbsDown size={15} />} subtitle={t('champs.considerDroppingSub')}>
          <div className="flex flex-wrap gap-3">
            {pool.drop.map((c) => (
              <button key={c.championId} onClick={() => setSelected(c.championId)} className="flex items-center gap-2.5 rounded-xl border border-bad/30 bg-bad/5 px-3 py-2">
                <ChampIcon id={c.championId} name={c.championName} size={36} rounded="lg" />
                <div className="text-start">
                  <div className="text-sm font-semibold">{champName(c.championId, c.championName)}</div>
                  <div className="text-[11px] text-muted tnum">
                    {pct(c.wins / c.games)} · {c.games} {t('common.games')}
                  </div>
                </div>
              </button>
            ))}
            {pool.drop.length === 0 && <div className="text-sm text-muted">{t('champs.noDrops')}</div>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 2xl:col-span-7" bodyClass="p-0">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-start font-medium">{t('champs.champion')}</th>
                <SortHead k="games">{t('common.games')}</SortHead>
                <SortHead k="wr">WR</SortHead>
                <SortHead k="kda">KDA</SortHead>
                <SortHead k="cs">CS/m</SortHead>
                <SortHead k="dpm">DPM</SortHead>
                <SortHead k="score">{t('champs.grade')}</SortHead>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const wr = c.wins / c.games
                return (
                  <tr
                    key={c.championId}
                    onClick={() => setSelected(c.championId)}
                    className={clsx('cursor-pointer border-b border-line/50 hover:bg-panel2', sel === c.championId && 'bg-panel2')}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <ChampIcon id={c.championId} name={c.championName} size={32} />
                        <div>
                          <div className="font-semibold">{champName(c.championId, c.championName)}</div>
                          <div className="text-[11px] text-muted">{timeAgo(c.lastPlayed, t.lang)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center tnum">{c.games}</td>
                    <td className="px-2">
                      <div className={clsx('text-center font-semibold tnum', wr >= 0.55 ? 'text-good' : wr < 0.47 ? 'text-bad' : 'text-ink')}>{pct(wr)}</div>
                      <div className="mx-auto mt-1 h-1 w-14 rounded-full bg-panel3">
                        <div className={clsx('h-full rounded-full', wr >= 0.5 ? 'bg-win' : 'bg-loss')} style={{ width: `${wr * 100}%` }} />
                      </div>
                    </td>
                    <td className="text-center tnum">{((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(2)}</td>
                    <td className="text-center tnum">{c.csPerMin.toFixed(1)}</td>
                    <td className="text-center tnum">{Math.round(c.dpm)}</td>
                    <td className="text-center">
                      <GradeBadge score={c.avgScore} />
                      <span className="sr-only">{grade(c.avgScore)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        <Card className="col-span-12 2xl:col-span-5" title={sel ? champName(sel) : ''} subtitle={t('champs.deepDive')}>
          {sel && <ChampionDeepDive championId={sel} />}
        </Card>
      </div>
    </div>
  )
}
