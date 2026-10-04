import clsx from 'clsx'
import { CalendarDays, CheckSquare, Lightbulb, Plus, Square, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Goal, GoalComparator } from '@shared/types'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Toggle } from '@/components/ui'
import { GoalLine, goalProgress } from '@/components/widgets'
import { useT } from '@/i18n'
import { analyze } from '@/lib/coach'
import { todayKey, uid } from '@/lib/format'
import { METRICS, benchmark, fmtMetric, type MetricKey } from '@/lib/metrics'
import { useAnalysis } from '@/store/analysis'
import { useApp } from '@/store/app'

export const ROUTINE_ITEMS = ['warmup', 'review', 'mental', 'limit', 'focus', 'break', 'journal'] as const

export function Goals() {
  const t = useT()
  const a = useAnalysis()
  const data = useApp((s) => s.data)!
  const setGoals = useApp((s) => s.setGoals)
  const setRoutine = useApp((s) => s.setRoutine)
  const [metric, setMetric] = useState<MetricKey>('csAt10')
  const [comparator, setComparator] = useState<GoalComparator>('gte')
  const [target, setTarget] = useState('80')
  const [windowN, setWindowN] = useState(20)

  const suggestions = useMemo(() => {
    const ins = analyze(a.windowed, a.role, a.tier, a.items).filter((i) => i.kind === 'weakness' && i.metric)
    return ins
      .filter((i) => !data.goals.some((g) => g.metric === i.metric && g.active))
      .slice(0, 4)
      .map((i) => {
        const def = METRICS[i.metric!]
        // a stepping-stone target: halfway between current average and the benchmark
        const mid = i.value! + (i.target! - i.value!) * 0.6
        const rounded = def.format === 'int' || def.format === 'signed' ? Math.round(mid) : Math.round(mid * 10) / 10
        return { metric: i.metric!, comparator: (def.higherIsBetter ? 'gte' : 'lte') as GoalComparator, target: rounded }
      })
  }, [a, data.goals])

  const addGoal = (g: Omit<Goal, 'id' | 'createdAt' | 'active'>) =>
    setGoals([...data.goals, { ...g, id: uid(), createdAt: Date.now(), active: true }])

  const today = todayKey()
  const todayEntry = data.routine.find((r) => r.date === today) ?? { date: today, done: [] }
  const toggleRoutine = (id: string) => {
    const done = todayEntry.done.includes(id) ? todayEntry.done.filter((x) => x !== id) : [...todayEntry.done, id]
    const rest = data.routine.filter((r) => r.date !== today)
    setRoutine([...rest, { date: today, done }].sort((x, y) => x.date.localeCompare(y.date)))
  }

  // last 35 days of routine completion
  const days = useMemo(() => {
    const out: { key: string; ratio: number }[] = []
    for (let i = 34; i >= 0; i--) {
      const d = new Date()
      if (d.getHours() < 5) d.setDate(d.getDate() - 1)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const r = data.routine.find((x) => x.date === key)
      out.push({ key, ratio: r ? r.done.length / ROUTINE_ITEMS.length : 0 })
    }
    return out
  }, [data.routine])
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].ratio >= 0.6) streak++
    else if (i !== days.length - 1) break
  }

  return (
    <div className="fade-in space-y-5">
      <PageHeader title={t('nav.goals')} subtitle={t('goals.subtitle')} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 xl:col-span-7">
          <Card title={t('goals.active')} icon={<Target size={15} />}>
            <div className="space-y-4">
              {data.goals.length === 0 && <div className="text-sm text-muted">{t('goals.empty')}</div>}
              {data.goals.map((g) => {
                const p = goalProgress(g, a.filtered, a.items)
                return (
                  <div key={g.id} className={clsx('rounded-xl border border-line bg-panel2/40 p-3.5', !g.active && 'opacity-50')}>
                    <GoalLine goal={g} matches={a.filtered} />
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex gap-1" dir="ltr">
                        {p.recent.map((hit, i) => (
                          <span key={i} className={clsx('h-2.5 w-2.5 rounded-sm', hit ? 'bg-good' : 'bg-bad/70')} />
                        ))}
                      </div>
                      <span className="text-[11px] text-muted">{t('goals.lastN', { n: g.window })}</span>
                      <div className="ms-auto flex items-center gap-2">
                        <Toggle checked={g.active} onChange={(v) => setGoals(data.goals.map((x) => (x.id === g.id ? { ...x, active: v } : x)))} />
                        <button onClick={() => setGoals(data.goals.filter((x) => x.id !== g.id))} className="rounded p-1 text-muted hover:bg-panel3 hover:text-bad">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title={t('goals.new')} icon={<Plus size={15} />}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="col-span-2">
                <Field label={t('goals.metric')}>
                  <Select<MetricKey>
                    className="w-full"
                    value={metric}
                    onChange={(k) => {
                      setMetric(k)
                      setComparator(METRICS[k].higherIsBetter ? 'gte' : 'lte')
                      const b = benchmark(k, a.role, a.tier)
                      if (b != null) setTarget(String(METRICS[k].format === 'pct' ? Math.round(b * 100) / 100 : Math.round(b * 10) / 10))
                    }}
                    options={(Object.keys(METRICS) as MetricKey[]).map((k) => ({ value: k, label: t.d(`metric.${k}`) }))}
                  />
                </Field>
              </div>
              <Field label={t('goals.comparator')}>
                <Select<GoalComparator>
                  className="w-full"
                  value={comparator}
                  onChange={setComparator}
                  options={[
                    { value: 'gte', label: '≥' },
                    { value: 'lte', label: '≤' }
                  ]}
                />
              </Field>
              <Field label={t('goals.target')} hint={METRICS[metric].format === 'pct' ? t('goals.pctHint') : undefined}>
                <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label={t('goals.window')}>
                <Select<number>
                  className="w-full"
                  value={windowN}
                  onChange={setWindowN}
                  options={[10, 20, 30, 50].map((n) => ({ value: n, label: `${n}` }))}
                />
              </Field>
            </div>
            <Button
              className="mt-3"
              variant="primary"
              icon={<Plus size={15} />}
              disabled={!Number.isFinite(Number(target))}
              onClick={() => addGoal({ metric, comparator, target: Number(target), window: windowN })}
            >
              {t('goals.add')}
            </Button>
          </Card>
        </div>

        <div className="col-span-12 space-y-4 xl:col-span-5">
          <Card title={t('goals.suggested')} icon={<Lightbulb size={15} />} subtitle={t('goals.suggestedSub')}>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.metric} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/40 px-3 py-2.5">
                  <div className="flex-1 text-sm">
                    {t.d(`metric.${s.metric}`)} {s.comparator === 'gte' ? '≥' : '≤'} <b className="text-gold tnum">{fmtMetric(s.metric, s.target)}</b>
                  </div>
                  <Button size="sm" icon={<Plus size={13} />} onClick={() => addGoal({ ...s, window: 20 })}>
                    {t('goals.add')}
                  </Button>
                </div>
              ))}
              {suggestions.length === 0 && <div className="text-sm text-muted">{t('goals.noSuggestions')}</div>}
            </div>
          </Card>

          <Card
            title={t('goals.routine')}
            icon={<CheckSquare size={15} />}
            subtitle={t('goals.routineSub')}
            actions={<Badge tone="gold">{t('goals.streak', { n: streak })}</Badge>}
          >
            <div className="space-y-1.5">
              {ROUTINE_ITEMS.map((id) => {
                const done = todayEntry.done.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleRoutine(id)}
                    className={clsx(
                      'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-panel2',
                      done && 'bg-good/5'
                    )}
                  >
                    {done ? <CheckSquare size={17} className="mt-0.5 shrink-0 text-good" /> : <Square size={17} className="mt-0.5 shrink-0 text-muted" />}
                    <div>
                      <div className={clsx('text-sm font-medium', done ? 'text-ink2 line-through' : 'text-ink')}>{t.d(`routine.${id}`)}</div>
                      <div className="text-[11px] leading-relaxed text-muted">{t.d(`routine.${id}.hint`)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted">
              <CalendarDays size={13} /> {t('goals.last35')}
            </div>
            <div className="mt-2 grid grid-cols-[repeat(35,minmax(0,1fr))] gap-1" dir="ltr">
              {days.map((d) => (
                <span
                  key={d.key}
                  title={d.key}
                  className="aspect-square rounded-sm"
                  style={{ background: d.ratio === 0 ? '#1f2a3d' : `rgba(47,191,113,${0.25 + d.ratio * 0.75})` }}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
