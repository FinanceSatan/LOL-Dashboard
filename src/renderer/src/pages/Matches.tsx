import { DownloadCloud, Filter, History } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QUEUES } from '@shared/constants'
import { ROLES, type Role } from '@shared/types'
import { MatchDetail } from '@/components/MatchDetail'
import { useChampName } from '@/components/game'
import { Button, Card, Empty, Modal, PageHeader, Select } from '@/components/ui'
import { MatchRow } from '@/components/widgets'
import { useT } from '@/i18n'
import { lpDeltaByMatch, winrate } from '@/lib/analytics'
import { pct } from '@/lib/format'
import { useApp } from '@/store/app'

type QueueFilter = 'all' | 'solo' | 'flex' | 'normal' | 'aram' | 'other'

export function Matches() {
  const t = useT()
  const navigate = useNavigate()
  const { matchId } = useParams()
  const data = useApp((s) => s.data)!
  const runSync = useApp((s) => s.runSync)
  const syncing = useApp((s) => s.syncing)
  const toast = useApp((s) => s.toast)
  const champName = useChampName()
  const [queue, setQueue] = useState<QueueFilter>('all')
  const [result, setResult] = useState<'all' | 'win' | 'loss'>('all')
  const [champ, setChamp] = useState<number>(0)
  const [role, setRole] = useState<Role | 'all'>('all')
  const [limit, setLimit] = useState(40)

  const lpDeltas = useMemo(() => lpDeltaByMatch(data.matches, data.rankHistory), [data])
  const reviewed = useMemo(() => new Set(data.journal.filter((j) => j.matchId).map((j) => j.matchId)), [data.journal])

  const champs = useMemo(() => {
    const map = new Map<number, { id: number; name: string; n: number }>()
    for (const m of data.matches) {
      const e = map.get(m.me.championId) ?? { id: m.me.championId, name: m.me.championName, n: 0 }
      e.n++
      map.set(m.me.championId, e)
    }
    return [...map.values()].sort((a, b) => b.n - a.n)
  }, [data.matches])

  const filtered = useMemo(
    () =>
      data.matches.filter((m) => {
        if (queue === 'solo' && m.queueId !== 420) return false
        if (queue === 'flex' && m.queueId !== 440) return false
        if (queue === 'normal' && ![400, 430, 490, 480].includes(m.queueId)) return false
        if (queue === 'aram' && m.queueId !== 450) return false
        if (queue === 'other' && QUEUES[m.queueId]?.sr) return false
        if (result === 'win' && !m.win) return false
        if (result === 'loss' && (m.win || m.remake)) return false
        if (champ && m.me.championId !== champ) return false
        if (role !== 'all' && m.me.role !== role) return false
        return true
      }),
    [data.matches, queue, result, champ, role]
  )

  const selected = matchId ? data.matches.find((m) => m.matchId === matchId) : undefined
  const wr = winrate(filtered.filter((m) => !m.remake))

  return (
    <div className="fade-in">
      <PageHeader
        title={t('nav.matches')}
        subtitle={t('matches.subtitle', { count: data.matches.length })}
        actions={
          !data.account.demo && (
            <Button
              icon={<DownloadCloud size={15} />}
              loading={syncing}
              onClick={async () => {
                const r = await runSync({ older: 50 })
                toast(r.ok ? t('layout.syncDone', { count: r.newMatches }) : t.err(r.error), r.ok ? 'success' : 'error')
              }}
            >
              {t('matches.loadOlder')}
            </Button>
          )
        }
      />
      <Card bodyClass="p-3" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={15} className="text-muted" />
          <Select<QueueFilter>
            value={queue}
            onChange={setQueue}
            options={[
              { value: 'all', label: t('matches.allQueues') },
              { value: 'solo', label: t.lang === 'fa' ? QUEUES[420].fa : QUEUES[420].en },
              { value: 'flex', label: t.lang === 'fa' ? QUEUES[440].fa : QUEUES[440].en },
              { value: 'normal', label: t('matches.normals') },
              { value: 'aram', label: 'ARAM' },
              { value: 'other', label: t('matches.otherModes') }
            ]}
          />
          <Select<'all' | 'win' | 'loss'>
            value={result}
            onChange={setResult}
            options={[
              { value: 'all', label: t('matches.allResults') },
              { value: 'win', label: t('match.victory') },
              { value: 'loss', label: t('match.defeat') }
            ]}
          />
          <Select<Role | 'all'>
            value={role}
            onChange={setRole}
            options={[{ value: 'all', label: t('matches.allRoles') }, ...ROLES.map((r) => ({ value: r, label: t.d(`role.${r}`) }))]}
          />
          <Select<number>
            value={champ}
            onChange={setChamp}
            options={[
              { value: 0, label: t('matches.allChamps') },
              ...champs.map((c) => ({ value: c.id, label: `${champName(c.id, c.name)} (${c.n})` }))
            ]}
          />
          <div className="ms-auto text-sm text-ink2 tnum">
            {filtered.length} {t('common.games')} ·{' '}
            <span className={wr >= 0.5 ? 'text-good' : 'text-bad'}>{pct(wr)}</span> WR
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <Empty icon={<History size={32} />} title={t('matches.empty')} />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, limit).map((m) => (
            <MatchRow
              key={m.matchId}
              m={m}
              lpDelta={lpDeltas.get(m.matchId)}
              reviewed={reviewed.has(m.matchId)}
              onClick={() => navigate(`/matches/${m.matchId}`)}
            />
          ))}
          {filtered.length > limit && (
            <div className="pt-2 text-center">
              <Button onClick={() => setLimit((l) => l + 40)}>{t('common.showMore')}</Button>
            </div>
          )}
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => navigate('/matches')} wide title={t('matches.detail')}>
        {selected && <MatchDetail match={selected} lpDelta={lpDeltas.get(selected.matchId)} />}
      </Modal>
    </div>
  )
}
