import clsx from 'clsx'
import { AlertTriangle, Ban, Shield, Swords, Users } from 'lucide-react'
import { useMemo } from 'react'
import { demoChampSelect } from '@shared/demo'
import type { ChampSelectPlayer, ChampSelectState, MatchSummary, StaticData } from '@shared/types'
import { ChampIcon, RoleIcon, useChampName } from '@/components/game'
import { Badge, Card, Empty, PageHeader, Toggle } from '@/components/ui'
import { useT } from '@/i18n'
import { championStats } from '@/lib/analytics'
import { pct } from '@/lib/format'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'
import { ChampionDeepDive } from './Champions'

const POS_MAP: Record<string, 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  middle: 'MIDDLE',
  bottom: 'BOTTOM',
  utility: 'UTILITY'
}

function teamProfile(ids: number[], sd: StaticData | null) {
  let ad = 0
  let ap = 0
  const tags = new Map<string, number>()
  for (const id of ids) {
    const c = sd?.champions[id]
    if (!c) continue
    ad += c.info.attack
    ap += c.info.magic
    for (const tg of c.tags) tags.set(tg, (tags.get(tg) ?? 0) + 1)
  }
  const total = ad + ap
  return { adShare: total ? ad / total : 0.5, tags, count: ids.filter((id) => sd?.champions[id]).length }
}

function compWarnings(p: ReturnType<typeof teamProfile>): string[] {
  const w: string[] = []
  if (p.count < 3) return w
  if (p.adShare > 0.72) w.push('cs.warn.allAd')
  if (p.adShare < 0.3) w.push('cs.warn.allAp')
  if (!p.tags.get('Tank') && (p.tags.get('Fighter') ?? 0) < 2) w.push('cs.warn.noFrontline')
  if (!p.tags.get('Marksman') && p.count >= 4) w.push('cs.warn.noMarksman')
  if ((p.tags.get('Assassin') ?? 0) >= 3) w.push('cs.warn.manyAssassins')
  return w
}

function vsHistory(matches: MatchSummary[], enemyChampionId: number) {
  const ms = matches.filter((m) => m.participants.some((p) => p.teamId !== m.me.teamId && p.championId === enemyChampionId))
  return { games: ms.length, wins: ms.filter((m) => m.win).length }
}

function Slot({ p, side, matches }: { p: ChampSelectPlayer; side: 'ally' | 'enemy'; matches: MatchSummary[] }) {
  const t = useT()
  const champName = useChampName()
  const id = p.championId || p.championPickIntent
  const hovering = !p.championId && p.championPickIntent
  const vs = side === 'enemy' && p.championId ? vsHistory(matches, p.championId) : null
  const role = POS_MAP[p.assignedPosition]
  return (
    <div className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2.5', p.isMe ? 'border-gold/50 bg-gold/5' : 'border-line bg-panel2/40')}>
      {id ? (
        <span className={clsx(hovering && 'opacity-45')}>
          <ChampIcon id={id} size={44} rounded="lg" />
        </span>
      ) : (
        <span className="h-11 w-11 rounded-lg border border-dashed border-line2" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {role && <RoleIcon role={role} size={14} />}
          {id ? champName(id) : t('cs.picking')}
          {hovering ? <span className="text-[10px] font-normal text-muted">({t('cs.hovering')})</span> : null}
        </div>
        <div className="truncate text-[11px] text-muted">{p.isMe ? t('common.you') : p.summonerName ?? t('cs.hidden')}</div>
      </div>
      {vs && vs.games > 0 && (
        <div className="text-end text-[11px]">
          <div className={clsx('font-bold tnum', vs.wins / vs.games >= 0.5 ? 'text-good' : 'text-bad')}>{pct(vs.wins / vs.games)}</div>
          <div className="text-muted">
            {vs.games} {t('common.games')}
          </div>
        </div>
      )}
    </div>
  )
}

function CompBar({ label, p }: { label: string; p: ReturnType<typeof teamProfile> }) {
  const t = useT()
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="tnum">
          AD {Math.round(p.adShare * 100)}% · AP {Math.round((1 - p.adShare) * 100)}%
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full" dir="ltr">
        <div className="bg-[#d95926]" style={{ width: `${p.adShare * 100}%` }} />
        <div className="ms-0.5 flex-1 bg-[#9085e9]" />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {[...p.tags.entries()].map(([tag, n]) => (
          <Badge key={tag}>
            {t.d(`champTag.${tag}`)} ×{n}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function ChampSelect() {
  const t = useT()
  const live = useApp((s) => s.champSelect)
  const lcu = useApp((s) => s.lcu)
  const settings = useApp((s) => s.settings)!
  const saveSettings = useApp((s) => s.saveSettings)
  const sd = useApp((s) => s.staticData)
  const data = useApp((s) => s.data)!
  const a = useAnalysis()
  const champName = useChampName()
  const isDemo = !live && data.account.demo
  const state: ChampSelectState | null = live ?? (isDemo ? demoChampSelect() : null)

  const me = state?.myTeam.find((p) => p.isMe)
  const myChamp = me ? me.championId || me.championPickIntent : 0
  const allyIds = state?.myTeam.map((p) => p.championId || p.championPickIntent).filter(Boolean) ?? []
  const enemyIds = state?.theirTeam.map((p) => p.championId).filter(Boolean) ?? []
  const ally = useMemo(() => teamProfile(allyIds, sd), [allyIds.join(','), sd]) // eslint-disable-line react-hooks/exhaustive-deps
  const enemy = useMemo(() => teamProfile(enemyIds, sd), [enemyIds.join(','), sd]) // eslint-disable-line react-hooks/exhaustive-deps
  const myStats = useMemo(() => championStats(a.filtered, a.tier).find((c) => c.championId === myChamp), [a, myChamp])

  const toggles = (
    <div className="flex flex-wrap items-center gap-5">
      <Toggle checked={settings.autoAccept} onChange={(v) => void saveSettings({ autoAccept: v })} label={t('settings.autoAccept')} />
      <Toggle checked={settings.openChampSelect} onChange={(v) => void saveSettings({ openChampSelect: v })} label={t('settings.openChampSelect')} />
    </div>
  )

  if (!state) {
    return (
      <div className="fade-in">
        <PageHeader title={t('nav.champSelect')} subtitle={t('cs.subtitle')} actions={toggles} />
        <Card>
          <Empty
            icon={<Swords size={36} />}
            title={lcu.connected ? t('cs.waiting') : t('cs.noClient')}
            body={lcu.connected ? t('cs.waitingBody') : t('cs.noClientBody')}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.champSelect')}
        subtitle={
          <span className="flex items-center gap-2">
            {isDemo && <Badge tone="gold">DEMO</Badge>}
            {state.phase} · {Math.ceil(state.timeLeftMs / 1000)}s
          </span>
        }
        actions={toggles}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5">
        <Ban size={15} className="text-bad" />
        <span className="text-xs text-muted">{t('cs.bans')}</span>
        <div className="flex gap-1.5">
          {state.bans.myTeam.map((id, i) => (
            <span key={`a${i}`} className="opacity-70 grayscale">
              <ChampIcon id={id} size={26} />
            </span>
          ))}
        </div>
        <span className="text-muted">|</span>
        <div className="flex gap-1.5">
          {state.bans.theirTeam.map((id, i) => (
            <span key={`e${i}`} className="opacity-70 grayscale">
              <ChampIcon id={id} size={26} />
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-3" title={t('cs.yourTeam')} icon={<Users size={15} />}>
          <div className="space-y-2">
            {state.myTeam.map((p) => (
              <Slot key={p.cellId} p={p} side="ally" matches={a.all} />
            ))}
          </div>
        </Card>

        <Card
          className="col-span-12 lg:col-span-6"
          title={myChamp ? t('cs.yourPick', { champ: champName(myChamp) }) : t('cs.noPick')}
          icon={<Shield size={15} />}
          subtitle={
            myStats
              ? t('cs.yourRecord', {
                  games: myStats.games,
                  wr: pct(myStats.wins / myStats.games),
                  kda: ((myStats.kills + myStats.assists) / Math.max(1, myStats.deaths)).toFixed(2)
                })
              : myChamp
                ? t('cs.firstTime')
                : undefined
          }
        >
          {myChamp ? <ChampionDeepDive championId={myChamp} compact /> : <div className="text-sm text-muted">{t('cs.hoverHint')}</div>}
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-4 md:grid-cols-2">
            <CompBar label={t('cs.yourTeam')} p={ally} />
            <CompBar label={t('cs.enemyTeam')} p={enemy} />
          </div>
          {[...compWarnings(ally).map((k) => ({ k, mine: true })), ...compWarnings(enemy).map((k) => ({ k, mine: false }))].length > 0 && (
            <div className="mt-3 space-y-1.5">
              {compWarnings(ally).map((k) => (
                <div key={`a${k}`} className="flex items-center gap-2 text-xs text-warn">
                  <AlertTriangle size={13} /> {t('cs.yourTeam')}: {t.d(k)}
                </div>
              ))}
              {compWarnings(enemy).map((k) => (
                <div key={`e${k}`} className="flex items-center gap-2 text-xs text-accent">
                  <AlertTriangle size={13} /> {t('cs.enemyTeam')}: {t.d(k)}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="col-span-12 lg:col-span-3" title={t('cs.enemyTeam')} icon={<Swords size={15} />} subtitle={t('cs.vsHistoryHint')}>
          <div className="space-y-2">
            {state.theirTeam.map((p) => (
              <Slot key={p.cellId} p={p} side="enemy" matches={a.all} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
