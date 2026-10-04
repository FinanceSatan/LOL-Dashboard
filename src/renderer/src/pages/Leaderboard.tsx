import clsx from 'clsx'
import { Flame, RefreshCw, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PLATFORMS, absoluteLp } from '@shared/constants'
import type { Leaderboard as LB } from '@shared/types'
import { RankEmblem, TierText } from '@/components/game'
import { Badge, Button, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui'
import { useT } from '@/i18n'
import { pct, timeAgo } from '@/lib/format'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'

export function Leaderboard() {
  const t = useT()
  const a = useAnalysis()
  const settings = useApp((s) => s.settings)!
  const data = useApp((s) => s.data)!
  const [lb, setLb] = useState<LB | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(100)

  const load = async () => {
    setLoading(true)
    const r = await window.api.getLeaderboard()
    setLoading(false)
    if (r.ok) {
      setLb(r.data)
      setError(null)
    } else setError(r.error)
  }
  useEffect(() => {
    void load()
  }, [])

  const myAbs = a.solo ? absoluteLp(a.solo.tier, a.solo.rank, a.solo.leaguePoints) : null
  const chal = lb?.cutoffs.challenger
  const gm = lb?.cutoffs.grandmaster
  const toChal = myAbs != null && chal != null ? Math.max(0, 2800 + chal - myAbs) : null
  const toGm = myAbs != null && gm != null ? Math.max(0, 2800 + gm - myAbs) : null
  const isDemo = data.account.demo || !settings.hasApiKey

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.leaderboard')}
        subtitle={t('lb.subtitle', { region: PLATFORMS.find((p) => p.id === (lb?.platform ?? data.account.platform))?.label ?? '' })}
        actions={
          <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void load()}>
            {t('common.refresh')}
          </Button>
        }
      />
      {isDemo && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-2.5 text-xs text-gold2">{t('lb.demoNote')}</div>
      )}
      {error && <div className="rounded-xl border border-bad/30 bg-bad/5 px-4 py-2.5 text-xs text-bad">{t.err(error)}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label={t('lb.chalCutoff')} value={chal != null ? `${chal} LP` : '—'} icon={<RankEmblem tier="CHALLENGER" size={18} />} tone="gold" />
        <Stat label={t('lb.gmCutoff')} value={gm != null ? `${gm} LP` : '—'} icon={<RankEmblem tier="GRANDMASTER" size={18} />} />
        <Stat label={t('lb.toChal')} value={toChal != null ? `${toChal.toLocaleString('en-US')} LP` : '—'} sub={a.solo ? <TierText tier={a.solo.tier} /> : undefined} />
        <Stat label={t('lb.toGm')} value={toGm != null ? `${toGm.toLocaleString('en-US')} LP` : '—'} />
      </div>

      <Card
        title={t('lb.ladder')}
        icon={<Trophy size={15} />}
        subtitle={lb ? t('lb.updated', { ago: timeAgo(lb.fetchedAt, t.lang) }) : undefined}
        bodyClass="p-0"
      >
        {loading && !lb ? (
          <div className="flex justify-center py-12 text-gold">
            <Spinner size={24} />
          </div>
        ) : !lb ? (
          <Empty title={t('lb.empty')} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-start font-medium">#</th>
                  <th className="text-start font-medium">{t('match.player')}</th>
                  <th className="text-start font-medium">{t('lb.tier')}</th>
                  <th className="text-center font-medium">LP</th>
                  <th className="text-center font-medium">{t('common.games')}</th>
                  <th className="text-center font-medium">WR</th>
                </tr>
              </thead>
              <tbody>
                {lb.entries.slice(0, limit).map((e, i) => {
                  const games = e.wins + e.losses
                  const wr = e.wins / Math.max(1, games)
                  return (
                    <tr key={e.puuid} className="border-b border-line/50 hover:bg-panel2/50">
                      <td className="px-4 py-2 text-muted tnum">{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={clsx('font-medium', e.name ? 'text-ink' : 'text-muted')}>{e.name ?? `${e.puuid.slice(0, 10)}…`}</span>
                          {e.hotStreak && (
                            <Badge tone="warn">
                              <Flame size={10} />
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <TierText tier={e.tier} className="text-xs" />
                      </td>
                      <td className="text-center font-semibold tnum">{e.lp}</td>
                      <td className="text-center text-ink2 tnum">{games}</td>
                      <td className={clsx('text-center tnum', wr >= 0.55 ? 'text-good' : 'text-ink2')}>{pct(wr)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {lb.entries.length > limit && (
              <div className="p-3 text-center">
                <Button onClick={() => setLimit((l) => l + 100)}>{t('common.showMore')}</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
