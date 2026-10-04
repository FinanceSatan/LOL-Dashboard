import clsx from 'clsx'
import { Eye, Flame, Gauge, Radio, Search, Timer, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { QUEUES, isApexTier } from '@shared/constants'
import type { LiveClientState, ScoutPlayer, ScoutResult } from '@shared/types'
import { ChampIcon, ItemRow, RankEmblem, SpellIcon, TierText, useChampName } from '@/components/game'
import { Badge, Button, Card, Empty, Input, PageHeader, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { champByName } from '@/lib/dd'
import { clock, pct, timerLabel } from '@/lib/format'
import { useApp } from '@/store/app'

function ScoutCard({ p }: { p: ScoutPlayer }) {
  const t = useT()
  const champName = useChampName()
  const solo = p.solo
  const games = solo ? solo.wins + solo.losses : 0
  const wr = solo && games ? solo.wins / games : null
  const tags: { label: string; tone: 'good' | 'bad' | 'warn' | 'gold' }[] = []
  if (solo?.hotStreak) tags.push({ label: t('live.hotStreak'), tone: 'warn' })
  if (p.masteryPoints != null && p.masteryPoints > 300000) tags.push({ label: t('live.oneTrick'), tone: 'gold' })
  if (p.masteryPoints != null && p.masteryPoints < 15000) tags.push({ label: t('live.newOnChamp'), tone: 'good' })
  if (wr != null && games >= 30 && wr >= 0.58) tags.push({ label: t('live.highWr'), tone: 'bad' })
  return (
    <div className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2.5', p.isMe ? 'border-gold/50 bg-gold/5' : 'border-line bg-panel2/40')}>
      <ChampIcon id={p.championId} size={42} rounded="lg" />
      <div className="flex flex-col gap-0.5">
        <SpellIcon id={p.spells[0]} size={16} />
        <SpellIcon id={p.spells[1]} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{p.name}</div>
        <div className="text-[11px] text-muted">
          {champName(p.championId)}
          {p.masteryPoints != null && <span className="tnum"> · {Math.round(p.masteryPoints / 1000)}k {t('live.mastery')}</span>}
        </div>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tg) => (
              <Badge key={tg.label} tone={tg.tone}>
                {tg.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-end">
          {solo ? (
            <>
              <div className="text-xs">
                <TierText tier={solo.tier} /> {!isApexTier(solo.tier) && solo.rank} <span className="text-muted tnum">{solo.leaguePoints}LP</span>
              </div>
              <div className={clsx('text-[11px] tnum', wr! >= 0.5 ? 'text-good' : 'text-bad')}>
                {pct(wr)} · {games} {t('common.games')}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">{p.error ? '—' : t('rank.unranked')}</div>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center">
          <RankEmblem tier={solo?.tier} size={34} />
        </div>
      </div>
    </div>
  )
}

function LivePanel({ live }: { live: LiveClientState }) {
  const t = useT()
  const settings = useApp((s) => s.settings)!
  const sd = useApp((s) => s.staticData)
  const minutes = live.gameTime / 60
  const target = settings.csTargetPerMin
  const expected = Math.max(0, Math.round((minutes - 1.1) * target))
  const me = live.me
  const csDiff = me ? me.cs - expected : 0
  const csm = me && minutes > 1.5 ? me.cs / minutes : 0
  const order = live.players.filter((p) => p.team === 'ORDER')
  const chaos = live.players.filter((p) => p.team === 'CHAOS')
  const iconId = (name: string, id?: number) => id ?? champByName(sd, name)?.key ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-muted">
            <Timer size={12} /> {t('live.gameTime')}
          </div>
          <div className="mt-1 text-2xl font-bold tnum">{clock(live.gameTime)}</div>
        </div>
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-muted">
            <Gauge size={12} /> {t('live.csPace')}
          </div>
          <div className={clsx('mt-1 text-2xl font-bold tnum', csDiff >= 0 ? 'text-good' : 'text-bad')} dir="ltr">
            {me?.cs ?? 0} <span className="text-sm text-muted">/ {expected}</span>
          </div>
          <div className="text-[11px] text-muted tnum">
            {csm.toFixed(1)} CS/m · {t('common.target')} {target}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="text-[11px] uppercase text-muted">KDA</div>
          <div className="mt-1 text-2xl font-bold tnum" dir="ltr">
            {me ? `${me.kills}/${me.deaths}/${me.assists}` : '—'}
          </div>
          <div className="text-[11px] text-muted tnum">
            {t('live.gold')}: {me?.currentGold ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="text-[11px] uppercase text-muted">{t('live.score')}</div>
          <div className="mt-1 text-2xl font-bold tnum" dir="ltr">
            <span className="text-win">{live.teamKills.ORDER}</span> <span className="text-muted">-</span> <span className="text-loss">{live.teamKills.CHAOS}</span>
          </div>
          <div className="text-[11px] text-muted">
            {t('obj.DRAGON')} {live.dragons.ORDER.length} - {live.dragons.CHAOS.length}
          </div>
        </div>
      </div>

      <Card title={t('live.timers')} icon={<Timer size={15} />} subtitle={t('live.timersSub')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {live.timers.map((tm) => {
            const left = tm.respawnAt - live.gameTime
            const up = left <= 0
            return (
              <div key={tm.key} className={clsx('rounded-xl border px-3 py-2.5', up ? 'border-good/40 bg-good/5' : left < 60 ? 'border-warn/40 bg-warn/5' : 'border-line bg-panel2/40')}>
                <div className="text-xs text-ink2">
                  {timerLabel(t.d, tm)}
                  {tm.team && <span className="text-muted"> ({tm.team === live.me?.team ? t('live.ours') : t('live.theirs')})</span>}
                </div>
                <div className={clsx('text-xl font-bold tnum', up ? 'text-good' : left < 60 ? 'text-warn' : 'text-ink')}>{up ? t('live.up') : clock(left)}</div>
                <div className="text-[10px] text-muted tnum">@ {clock(tm.respawnAt)}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[order, chaos].map((team, ti) => (
          <Card key={ti} title={ti === 0 ? t('live.blueTeam') : t('live.redTeam')} icon={<Users size={15} />}>
            <div className="space-y-1.5">
              {team.map((p) => (
                <div key={p.name} className={clsx('flex items-center gap-3 rounded-lg px-2 py-1.5', p.isMe && 'bg-gold/5 ring-1 ring-gold/40')}>
                  <div className="relative">
                    <ChampIcon id={iconId(p.championName, p.championId)} name={p.championName} size={32} />
                    {p.isDead && <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/70 text-[10px] font-bold text-bad">{Math.ceil(p.respawnTimer)}</span>}
                  </div>
                  <div className="w-36 min-w-0">
                    <div className="truncate text-xs font-semibold">{p.name.split('#')[0]}</div>
                    <div className="text-[10px] text-muted">Lv {p.level}</div>
                  </div>
                  <div className="w-20 text-center text-xs font-semibold tnum" dir="ltr">
                    {p.kills}/{p.deaths}/{p.assists}
                  </div>
                  <div className="w-14 text-center text-xs text-ink2 tnum" dir="ltr">
                    {p.cs} CS
                  </div>
                  <div className="ms-auto">
                    <ItemRow items={[...p.items.slice(0, 6), ...Array(Math.max(0, 7 - p.items.length)).fill(0)]} size={18} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function LiveGame() {
  const t = useT()
  const live = useApp((s) => s.live)
  const settings = useApp((s) => s.settings)!
  const saveSettings = useApp((s) => s.saveSettings)
  const toast = useApp((s) => s.toast)
  const [scout, setScout] = useState<ScoutResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [query, setQuery] = useState('')

  const runScout = async (target?: { gameName: string; tagLine: string }) => {
    setLoading(true)
    setNotFound(false)
    const res = await window.api.scoutLiveGame(target)
    setLoading(false)
    if (!res.ok) {
      toast(t.err(res.error), 'error')
      return
    }
    setScout(res.data)
    setNotFound(res.data == null)
  }

  useEffect(() => {
    if (live && !scout) void runScout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(live)])

  const blue = scout?.players.filter((p) => p.teamId === 100) ?? []
  const red = scout?.players.filter((p) => p.teamId === 200) ?? []
  const avgWr = (ps: ScoutPlayer[]) => {
    const w = ps.filter((p) => p.solo).map((p) => p.solo!.wins / Math.max(1, p.solo!.wins + p.solo!.losses))
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null
  }

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.live')}
        subtitle={t('live.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<Eye size={15} />}
              onClick={async () => {
                await window.api.previewOverlay()
                if (!settings.overlay.enabled) await saveSettings({ overlay: { ...settings.overlay, enabled: true } })
                toast(t('live.overlayPreview'), 'info')
              }}
            >
              {t('live.previewOverlay')}
            </Button>
            <Button variant="primary" icon={<Radio size={15} />} loading={loading} onClick={() => void runScout()}>
              {t('live.scoutMe')}
            </Button>
          </div>
        }
      />

      {live ? (
        <LivePanel live={live} />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink2">
            <Flame size={18} className="text-muted" />
            <span className="flex-1">{t('live.notInGame')}</span>
          </div>
        </Card>
      )}

      <Card
        title={t('live.scout')}
        icon={<Search size={15} />}
        subtitle={t('live.scoutSub')}
        actions={
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const [gameName, tagLine] = query.split('#')
              if (gameName && tagLine) void runScout({ gameName, tagLine })
            }}
          >
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name#TAG" className="w-52" />
            <Button type="submit" size="md" disabled={!query.includes('#')}>
              {t('live.lookup')}
            </Button>
          </form>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10 text-gold">
            <Spinner size={24} />
          </div>
        ) : scout ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {scout.source === 'demo' && <Badge tone="gold">DEMO</Badge>}
              <span>{QUEUES[scout.queueId] ? (t.lang === 'fa' ? QUEUES[scout.queueId].fa : QUEUES[scout.queueId].en) : scout.queueId}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {[blue, red].map((team, i) => (
                <div key={i}>
                  <div className={clsx('mb-2 flex items-center justify-between text-xs font-bold', i === 0 ? 'text-win' : 'text-loss')}>
                    <span>{i === 0 ? t('live.blueTeam') : t('live.redTeam')}</span>
                    <span className="text-muted">
                      {t('live.avgWr')}: {pct(avgWr(team))}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {team.map((p) => (
                      <ScoutCard key={p.puuid || p.name} p={p} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : notFound ? (
          <Empty icon={<Radio size={28} />} title={t('live.noGame')} body={t('live.noGameBody')} />
        ) : (
          <Empty icon={<Search size={28} />} title={t('live.scoutEmpty')} body={t('live.scoutEmptyBody')} />
        )}
      </Card>

    </div>
  )
}
