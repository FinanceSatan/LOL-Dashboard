import clsx from 'clsx'
import { BarChart2, ListChecks, NotebookPen, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { JournalEntry, MatchSummary } from '@shared/types'
import { ChampIcon, useChampName } from '@/components/game'
import { JournalEditor } from '@/components/JournalEditor'
import { Badge, Button, Card, Empty, Modal, PageHeader } from '@/components/ui'
import { GradeBadge } from '@/components/widgets'
import { useT } from '@/i18n'
import { gameScore, mean } from '@/lib/analytics'
import { dateTime, timeAgo } from '@/lib/format'
import { isGoodTag } from '@/lib/journal'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'

const MENTAL = ['😣', '😕', '😐', '🙂', '😎']

export function Journal() {
  const t = useT()
  const a = useAnalysis()
  const data = useApp((s) => s.data)!
  const champName = useChampName()
  const [editing, setEditing] = useState<{ match?: MatchSummary; entry?: JournalEntry } | null>(null)

  const reviewedIds = useMemo(() => new Set(data.journal.map((j) => j.matchId).filter(Boolean)), [data.journal])
  const queue = useMemo(
    () =>
      a.filtered
        .slice(0, 25)
        .filter((m) => !reviewedIds.has(m.matchId))
        .map((m) => ({ m, score: gameScore(m, a.tier) }))
        // losses and poor games first: they hold the most lessons
        .sort((x, y) => Number(x.m.win) - Number(y.m.win) || x.score - y.score)
        .slice(0, 6),
    [a.filtered, a.tier, reviewedIds]
  )

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const j of data.journal) for (const tag of j.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)
  }, [data.journal])
  const maxTag = Math.max(1, ...tagStats.map((x) => x[1]))
  const mentalWin = mean(data.journal.filter((j) => j.win === true).map((j) => j.mental))
  const mentalLoss = mean(data.journal.filter((j) => j.win === false).map((j) => j.mental))
  const matchById = (id?: string) => (id ? data.matches.find((m) => m.matchId === id) : undefined)

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.journal')}
        subtitle={t('journal.subtitle')}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing({})}>
            {t('journal.newEntry')}
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 xl:col-span-4">
          <Card title={t('journal.reviewQueue')} icon={<ListChecks size={15} />} subtitle={t('journal.reviewQueueSub')}>
            <div className="space-y-2">
              {queue.map(({ m, score }) => (
                <div key={m.matchId} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/40 px-3 py-2">
                  <ChampIcon id={m.me.championId} name={m.me.championName} size={34} rounded="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className={m.win ? 'text-win' : 'text-loss'}>{m.win ? 'W' : 'L'}</span>
                      {champName(m.me.championId, m.me.championName)}
                    </div>
                    <div className="text-[11px] text-muted tnum" dir="ltr">
                      {m.me.kills}/{m.me.deaths}/{m.me.assists} · {timeAgo(m.gameCreation, t.lang)}
                    </div>
                  </div>
                  <GradeBadge score={score} />
                  <Button size="sm" onClick={() => setEditing({ match: m })}>
                    {t('journal.review')}
                  </Button>
                </div>
              ))}
              {queue.length === 0 && <div className="text-sm text-muted">{t('journal.queueEmpty')}</div>}
            </div>
          </Card>
          <Card title={t('journal.insights')} icon={<BarChart2 size={15} />}>
            {tagStats.length ? (
              <div className="space-y-2">
                {tagStats.map(([tag, n]) => (
                  <div key={tag} className="flex items-center gap-2 text-xs">
                    <span className="w-36 truncate text-ink2">{t.d(`tag.${tag}`)}</span>
                    <div className="h-2 flex-1 rounded-full bg-panel3">
                      <div className={clsx('h-full rounded-full', isGoodTag(tag) ? 'bg-good' : 'bg-bad')} style={{ width: `${(n / maxTag) * 100}%` }} />
                    </div>
                    <span className="w-6 text-end text-muted tnum">{n}</span>
                  </div>
                ))}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-panel2/60 py-2">
                    <div className="text-[11px] text-muted">{t('journal.mentalWins')}</div>
                    <div className="text-lg font-bold tnum">{Number.isFinite(mentalWin) ? mentalWin.toFixed(1) : '—'}</div>
                  </div>
                  <div className="rounded-lg bg-panel2/60 py-2">
                    <div className="text-[11px] text-muted">{t('journal.mentalLosses')}</div>
                    <div className="text-lg font-bold tnum">{Number.isFinite(mentalLoss) ? mentalLoss.toFixed(1) : '—'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted">{t('journal.noStats')}</div>
            )}
          </Card>
        </div>

        <Card className="col-span-12 xl:col-span-8" title={t('journal.entries', { n: data.journal.length })} icon={<NotebookPen size={15} />}>
          {data.journal.length === 0 ? (
            <Empty icon={<NotebookPen size={30} />} title={t('journal.empty')} body={t('journal.emptyBody')} />
          ) : (
            <div className="space-y-2.5">
              {data.journal.map((j) => {
                const m = matchById(j.matchId)
                return (
                  <button
                    key={j.id}
                    onClick={() => setEditing({ entry: j, match: m })}
                    className="w-full rounded-xl border border-line bg-panel2/30 p-3.5 text-start hover:bg-panel2/70"
                  >
                    <div className="flex items-center gap-3">
                      {j.championId ? <ChampIcon id={j.championId} size={32} rounded="lg" /> : <NotebookPen size={20} className="text-muted" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {j.win != null && <span className={j.win ? 'text-win' : 'text-loss'}>{j.win ? t('match.victory') : t('match.defeat')}</span>}
                          {j.championId ? champName(j.championId) : t('journal.freeEntry')}
                          {j.reviewed && <Badge tone="accent">VOD ✓</Badge>}
                        </div>
                        <div className="text-[11px] text-muted">{dateTime(j.createdAt, t.lang)}</div>
                      </div>
                      <span className="text-xl" title={t('journal.mental')}>
                        {MENTAL[j.mental - 1]}
                      </span>
                    </div>
                    {j.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {j.tags.map((tag) => (
                          <Badge key={tag} tone={isGoodTag(tag) ? 'good' : 'bad'}>
                            {t.d(`tag.${tag}`)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(j.improve || j.went_well) && (
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs leading-relaxed md:grid-cols-2">
                        {j.went_well && (
                          <div className="text-ink2" dir="auto">
                            <span className="font-semibold text-good">+ </span>
                            {j.went_well}
                          </div>
                        )}
                        {j.improve && (
                          <div className="text-ink2" dir="auto">
                            <span className="font-semibold text-warn">→ </span>
                            {j.improve}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal open={editing != null} onClose={() => setEditing(null)} title={t('journal.editor')} wide>
        {editing && <JournalEditor match={editing.match} entry={editing.entry} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}
