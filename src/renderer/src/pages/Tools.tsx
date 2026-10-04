import clsx from 'clsx'
import { BellRing, Calculator, Pause, Play, RotateCcw, Search, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DIVISIONS, OBJECTIVE_TIMERS, TIERS, absoluteLp, isApexTier, rankFromAbsolute } from '@shared/constants'
import type { Division, Tier } from '@shared/types'
import { ChampIcon, RankEmblem, SpellIcon, TierText } from '@/components/game'
import { Card, Field, Input, PageHeader, Segmented, Select } from '@/components/ui'
import { useT } from '@/i18n'
import { averageLpChange, gamesToClimb, lpDeltaByMatch, requiredWinrate, winrate } from '@/lib/analytics'
import { clock, ltr, pct } from '@/lib/format'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'
import { ChampionDeepDive } from './Champions'

type Tab = 'climb' | 'timers' | 'champs'

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.value = 0.08
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.25)
  } catch {
    /* audio unavailable */
  }
}

function ClimbPlanner() {
  const t = useT()
  const a = useAnalysis()
  const data = useApp((s) => s.data)!
  const solo = a.solo
  const deltas = useMemo(() => averageLpChange(lpDeltaByMatch(data.matches, data.rankHistory)), [data])
  const recentWr = winrate(a.filtered.slice(0, 50))

  const [curTier, setCurTier] = useState<Tier>(solo?.tier ?? 'GOLD')
  const [curDiv, setCurDiv] = useState<Division>(solo?.rank ?? 'IV')
  const [curLp, setCurLp] = useState(String(solo?.leaguePoints ?? 0))
  const [target, setTarget] = useState<Tier>('CHALLENGER')
  const [chalCutoff, setChalCutoff] = useState('900')
  const [wr, setWr] = useState(Number.isFinite(recentWr) ? Math.round(recentWr * 100) : 53)
  const [gain, setGain] = useState(String(Math.round(deltas.gain ?? 23)))
  const [loss, setLoss] = useState(String(Math.round(Math.abs(deltas.loss ?? 19))))

  useEffect(() => {
    void window.api.getLeaderboard().then((r) => {
      if (r.ok && r.data.cutoffs.challenger) setChalCutoff(String(r.data.cutoffs.challenger))
    })
  }, [])

  const from = absoluteLp(curTier, curDiv, Number(curLp) || 0)
  const targetAbs =
    target === 'CHALLENGER' ? 2800 + (Number(chalCutoff) || 0) : target === 'GRANDMASTER' ? 2800 + 250 : absoluteLp(target, 'IV', 0)
  const need = Math.max(0, targetAbs - from)
  const g = Number(gain) || 20
  const l = Number(loss) || 20
  const games = gamesToClimb(need, wr / 100, g, l)
  const steps = [50, 52, 54, 56, 58, 60]

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 xl:col-span-5" title={t('tools.climbInputs')} icon={<Calculator size={15} />}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Field label={t('tools.currentTier')}>
              <Select<Tier> className="w-full" value={curTier} onChange={setCurTier} options={TIERS.map((x) => ({ value: x, label: x.charAt(0) + x.slice(1).toLowerCase() }))} />
            </Field>
            <Field label={t('tools.division')}>
              <Select<Division>
                className="w-full"
                value={curDiv}
                onChange={setCurDiv}
                options={[...DIVISIONS].reverse().map((d) => ({ value: d, label: d }))}
              />
            </Field>
            <Field label="LP">
              <Input value={curLp} onChange={(e) => setCurLp(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('tools.target')}>
              <Select<Tier>
                className="w-full"
                value={target}
                onChange={setTarget}
                options={TIERS.slice(1).map((x) => ({ value: x, label: x.charAt(0) + x.slice(1).toLowerCase() }))}
              />
            </Field>
            {target === 'CHALLENGER' && (
              <Field label={t('tools.chalCutoff')} hint={t('tools.chalCutoffHint')}>
                <Input value={chalCutoff} onChange={(e) => setChalCutoff(e.target.value)} inputMode="numeric" />
              </Field>
            )}
          </div>
          <Field label={`${t('tools.winrate')}: ${ltr(`${wr}%`)}`} hint={t('tools.winrateHint', { wr: pct(recentWr) })}>
            <input type="range" min={40} max={75} value={wr} onChange={(e) => setWr(Number(e.target.value))} className="no-drag w-full accent-[#c8aa6e]" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('tools.lpGain')} hint={deltas.gain ? t('tools.fromHistory') : t('tools.estimate')}>
              <Input value={gain} onChange={(e) => setGain(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label={t('tools.lpLoss')} hint={deltas.loss ? t('tools.fromHistory') : t('tools.estimate')}>
              <Input value={loss} onChange={(e) => setLoss(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
        </div>
      </Card>
      <Card className="col-span-12 xl:col-span-7" title={t('tools.climbResult')} icon={<RankEmblem tier={target} size={18} />}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <RankEmblem tier={curTier} size={52} />
            <div>
              <div className="text-xs text-muted">{t('tools.from')}</div>
              <div className="font-semibold">
                <TierText tier={curTier} /> {!isApexTier(curTier) && curDiv} · {curLp} LP
              </div>
            </div>
          </div>
          <span className="text-2xl text-muted rtl:rotate-180">→</span>
          <div className="flex items-center gap-3">
            <RankEmblem tier={target} size={52} />
            <div>
              <div className="text-xs text-muted">{t('tools.to')}</div>
              <div className="font-semibold">
                <TierText tier={target} /> {target === 'CHALLENGER' ? `${chalCutoff} LP` : ''}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-line bg-panel2/50 px-4 py-3">
            <div className="text-[11px] text-muted">{t('tools.lpNeeded')}</div>
            <div className="text-2xl font-bold tnum">{need.toLocaleString('en-US')}</div>
          </div>
          <div className="rounded-xl border border-line bg-panel2/50 px-4 py-3">
            <div className="text-[11px] text-muted">{t('tools.gamesNeeded')}</div>
            <div className={clsx('text-2xl font-bold tnum', games == null ? 'text-bad' : 'text-gold')}>{games == null ? '∞' : games}</div>
          </div>
          <div className="rounded-xl border border-line bg-panel2/50 px-4 py-3">
            <div className="text-[11px] text-muted">{t('tools.wrFor200')}</div>
            <div className="text-2xl font-bold tnum">{pct(Math.min(1, requiredWinrate(need, 200, g, l)))}</div>
          </div>
        </div>
        {games == null && <div className="mt-3 text-sm text-bad">{t('tools.cantClimb')}</div>}
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold text-ink2">{t('tools.scenarios')}</div>
          <div className="grid grid-cols-6 gap-2">
            {steps.map((s) => {
              const n = gamesToClimb(need, s / 100, g, l)
              return (
                <div key={s} className={clsx('rounded-lg border px-2 py-2 text-center', s === wr ? 'border-gold/50 bg-gold/5' : 'border-line')}>
                  <div className="text-xs text-muted tnum">{s}%</div>
                  <div className="text-base font-bold tnum">{n ?? '∞'}</div>
                </div>
              )
            })}
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">{t('tools.climbNote')}</p>
        <div className="mt-3 text-[11px] text-muted">
          {t('tools.milestones')}:{' '}
          {[2000, 2400, 2800].filter((x) => x > from && x <= targetAbs).map((x) => {
            const r = rankFromAbsolute(x)
            const n = gamesToClimb(x - from, wr / 100, g, l)
            return (
              <span key={x} className="me-3">
                {r.tier.charAt(0) + r.tier.slice(1).toLowerCase()} → <b className="text-ink2 tnum">{n ?? '∞'}</b>
              </span>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

interface ManualTimer {
  key: string
  label: string
  duration: number
}

function ObjectiveTimers() {
  const t = useT()
  const sd = useApp((s) => s.staticData)
  const timers: ManualTimer[] = [
    { key: 'dragon', label: t('obj.DRAGON'), duration: OBJECTIVE_TIMERS.dragonRespawn },
    { key: 'elder', label: t('obj.ELDER'), duration: OBJECTIVE_TIMERS.elderRespawn },
    { key: 'baron', label: t('obj.BARON'), duration: OBJECTIVE_TIMERS.baronRespawn },
    { key: 'inhib', label: t('obj.INHIBITOR'), duration: OBJECTIVE_TIMERS.inhibitorRespawn },
    { key: 'blue', label: t('tools.blueBuff'), duration: OBJECTIVE_TIMERS.blueRedBuff },
    { key: 'red', label: t('tools.redBuff'), duration: OBJECTIVE_TIMERS.blueRedBuff },
    { key: 'scuttle', label: t('tools.scuttle'), duration: OBJECTIVE_TIMERS.scuttle },
    { key: 'camp', label: t('tools.camps'), duration: OBJECTIVE_TIMERS.campRespawn }
  ]
  const [ends, setEnds] = useState<Record<string, number>>({})
  const [now, setNow] = useState(Date.now())
  const warned = useRef<Set<string>>(new Set())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    for (const [k, end] of Object.entries(ends)) {
      const left = (end - now) / 1000
      if (left <= 30 && left > 0 && !warned.current.has(k)) {
        warned.current.add(k)
        beep()
      }
    }
  }, [now, ends])

  return (
    <div className="space-y-4">
      <Card title={t('tools.timers')} icon={<Timer size={15} />} subtitle={t('tools.timersSub')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {timers.map((tm) => {
            const end = ends[tm.key]
            const left = end ? Math.max(0, (end - now) / 1000) : null
            const running = left != null && left > 0
            return (
              <div
                key={tm.key}
                className={clsx(
                  'rounded-xl border p-3',
                  running && left! < 30 ? 'border-warn/50 bg-warn/5' : left === 0 ? 'border-good/50 bg-good/5' : 'border-line bg-panel2/40'
                )}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  {tm.label}
                  <span className="text-[11px] font-normal text-muted tnum">{clock(tm.duration)}</span>
                </div>
                <div className={clsx('my-2 text-3xl font-bold tnum', left === 0 ? 'text-good' : running && left! < 30 ? 'text-warn' : 'text-ink')}>
                  {left == null ? '—' : left === 0 ? t('live.up') : clock(left)}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      warned.current.delete(tm.key)
                      setEnds((e) => ({ ...e, [tm.key]: Date.now() + tm.duration * 1000 }))
                    }}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-accent/15 text-xs font-semibold text-accent hover:bg-accent/25"
                  >
                    {running ? <RotateCcw size={12} /> : <Play size={12} />} {running ? t('tools.restart') : t('tools.start')}
                  </button>
                  {end && (
                    <button
                      onClick={() =>
                        setEnds((e) => {
                          const n = { ...e }
                          delete n[tm.key]
                          return n
                        })
                      }
                      className="flex h-7 w-8 items-center justify-center rounded-md bg-panel3 text-muted hover:text-ink"
                    >
                      <Pause size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
          <BellRing size={12} /> {t('tools.timerBeep')}
        </div>
      </Card>
      <Card title={t('tools.spellCds')}>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {Object.values(sd?.spells ?? {})
            .filter((s) => s.cooldown > 0 && [4, 14, 12, 11, 7, 3, 21, 1, 6].includes(s.key))
            .map((s) => (
              <div key={s.key} className="flex items-center gap-2 rounded-lg bg-panel2/50 px-2.5 py-2">
                <SpellIcon id={s.key} size={26} />
                <div>
                  <div className="text-xs font-semibold">{s.name}</div>
                  <div className="text-[11px] text-muted tnum">{s.cooldown}s</div>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}

function ChampionExplorer() {
  const t = useT()
  const sd = useApp((s) => s.staticData)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<number | null>(103)
  const list = useMemo(
    () =>
      Object.values(sd?.champions ?? {})
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [sd, q]
  )
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 lg:col-span-4" title={t('tools.champList')} icon={<Search size={15} />}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tools.searchChamp')} />
        <div className="mt-3 grid max-h-[560px] grid-cols-5 gap-2 overflow-y-auto pe-1">
          {list.map((c) => (
            <button
              key={c.key}
              onClick={() => setSel(c.key)}
              title={c.name}
              className={clsx('rounded-lg p-0.5', sel === c.key ? 'ring-2 ring-gold' : 'hover:ring-1 hover:ring-line2')}
            >
              <ChampIcon id={c.key} size={48} rounded="lg" />
            </button>
          ))}
        </div>
      </Card>
      <Card className="col-span-12 lg:col-span-8">{sel && <ChampionDeepDive championId={sel} />}</Card>
    </div>
  )
}

export function Tools() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('climb')
  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.tools')}
        subtitle={t('tools.subtitle')}
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'climb', label: t('tools.tab.climb') },
              { value: 'timers', label: t('tools.tab.timers') },
              { value: 'champs', label: t('tools.tab.champs') }
            ]}
          />
        }
      />
      {tab === 'climb' && <ClimbPlanner />}
      {tab === 'timers' && <ObjectiveTimers />}
      {tab === 'champs' && <ChampionExplorer />}
    </div>
  )
}
