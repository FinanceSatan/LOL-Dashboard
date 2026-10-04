import clsx from 'clsx'
import { BookMarked, Brain, CalendarCheck, Crosshair, GraduationCap, Sparkles, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { TIERS, TIER_COLORS } from '@shared/constants'
import type { Tier } from '@shared/types'
import { TierText } from '@/components/game'
import { Card, Empty, PageHeader, Select } from '@/components/ui'
import { InsightCard, SkillRadar } from '@/components/widgets'
import { useT } from '@/i18n'
import { skillProfile } from '@/lib/analytics'
import { DIM_METRICS, analyze, estimateTier } from '@/lib/coach'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'

export function Coach() {
  const t = useT()
  const a = useAnalysis()
  const saveSettings = useApp((s) => s.saveSettings)
  const v = useMemo(() => {
    const roleGames = a.windowed.filter((m) => m.me.role === a.role)
    const base = roleGames.length >= 5 ? roleGames : a.windowed
    const insights = analyze(a.windowed, a.role, a.tier, a.items)
    const dims = Object.fromEntries(
      Object.entries(DIM_METRICS).map(([dim, keys]) => [dim, estimateTier(base, a.role, keys, a.items)])
    ) as Record<string, Tier | null>
    return {
      insights,
      weaknesses: insights.filter((i) => i.kind === 'weakness'),
      patterns: insights.filter((i) => i.kind === 'pattern'),
      strengths: insights.filter((i) => i.kind === 'strength'),
      overall: estimateTier(base, a.role, undefined, a.items),
      dims,
      profile: skillProfile(base, a.role, a.tier)
    }
  }, [a])

  if (a.windowed.length < 3) {
    return (
      <Card>
        <Empty icon={<Brain size={36} />} title={t('coach.needGames')} body={t('coach.needGamesBody')} />
      </Card>
    )
  }

  const focus = [...v.weaknesses, ...v.patterns.filter((p) => p.severity >= 2)].slice(0, 3)

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title={t('nav.coach')}
        subtitle={t('coach.subtitle', { n: a.windowed.length, role: t.d(`role.${a.role}`) })}
        actions={
          <div className="flex items-center gap-2 text-xs text-muted">
            {t('coach.compareTo')}
            <Select<Tier>
              value={a.tier}
              onChange={(tier) => void saveSettings({ targetTier: tier })}
              options={TIERS.map((x) => ({ value: x, label: x.charAt(0) + x.slice(1).toLowerCase() }))}
            />
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-7" title={t('coach.levelTitle')} icon={<GraduationCap size={15} />} subtitle={t('coach.levelSub')}>
          <div className="flex flex-wrap items-center gap-6">
            <div className="rounded-2xl border border-line bg-bg/40 px-6 py-5 text-center">
              <div className="text-[11px] uppercase tracking-wider text-muted">{t('coach.overallLevel')}</div>
              <div className="mt-1 text-3xl font-black">{v.overall ? <TierText tier={v.overall} /> : '—'}</div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3">
              {Object.entries(v.dims).map(([dim, tier]) => (
                <div key={dim} className="rounded-xl border border-line bg-panel2/50 px-3 py-2.5">
                  <div className="text-[11px] text-muted">{t.d(`skill.${dim}`)}</div>
                  <div className="text-lg font-bold">{tier ? <TierText tier={tier} /> : '—'}</div>
                  <div className="mt-1.5 flex gap-0.5">
                    {TIERS.map((x, i) => (
                      <span
                        key={x}
                        className="h-1 flex-1 rounded-full"
                        style={{ background: tier && i <= TIERS.indexOf(tier) ? TIER_COLORS[x] : '#1f2a3d' }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">{t('coach.levelHint')}</p>
        </Card>
        <Card className="col-span-12 xl:col-span-5" title={t('dash.skillProfile')} icon={<Crosshair size={15} />}>
          <SkillRadar profile={v.profile} height={250} />
        </Card>
      </div>

      <Card title={t('coach.weeklyFocus')} icon={<CalendarCheck size={15} />} subtitle={t('coach.weeklyFocusSub')}>
        {focus.length ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {focus.map((i, idx) => (
              <div key={i.id} className="relative">
                <div className="absolute -top-2 start-3 z-10 rounded-md bg-gold px-2 py-0.5 text-[10px] font-black text-bg">
                  {t('coach.focusN', { n: idx + 1 })}
                </div>
                <InsightCard insight={i} expanded />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">{t('coach.none')}</div>
        )}
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-6" title={t('coach.weaknesses')} icon={<TrendingUp size={15} />}>
          <div className="space-y-2.5">
            {v.weaknesses.map((i) => (
              <InsightCard key={i.id} insight={i} expanded />
            ))}
            {v.weaknesses.length === 0 && <div className="text-sm text-muted">{t('coach.noWeak')}</div>}
          </div>
        </Card>
        <div className="col-span-12 space-y-4 xl:col-span-6">
          <Card title={t('coach.patterns')} icon={<Brain size={15} />}>
            <div className="space-y-2.5">
              {v.patterns.map((i) => (
                <InsightCard key={i.id} insight={i} expanded />
              ))}
              {v.patterns.length === 0 && <div className="text-sm text-muted">{t('coach.noPatterns')}</div>}
            </div>
          </Card>
          <Card title={t('coach.strengths')} icon={<Sparkles size={15} />}>
            <div className="space-y-2.5">
              {v.strengths.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
              {v.strengths.length === 0 && <div className="text-sm text-muted">{t('coach.noStrengths')}</div>}
            </div>
          </Card>
        </div>
      </div>

      <Card title={t('coach.principles')} icon={<BookMarked size={15} />} subtitle={t('coach.principlesSub')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {t.arr('coach.principleList').map((p, i) => {
            const [title, ...rest] = p.split('|')
            return (
              <div key={i} className={clsx('rounded-xl border border-line bg-panel2/40 p-3.5')}>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gold2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-gold/15 text-[10px] font-black text-gold tnum">{i + 1}</span>
                  {title}
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink2">{rest.join('|')}</p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
