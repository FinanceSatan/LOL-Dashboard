import clsx from 'clsx'
import { useEffect } from 'react'
import { useT } from '@/i18n'
import { clock, timerLabel } from '@/lib/format'
import { useApp } from '@/store/app'

/** Compact always-on-top in-game overlay (rendered in its own transparent, click-through window). */
export function Overlay() {
  const live = useApp((s) => s.live)
  const settings = useApp((s) => s.settings)
  const t = useT()

  useEffect(() => {
    document.body.style.background = 'transparent'
  }, [])

  if (!live || !settings) return null
  const o = settings.overlay
  const minutes = live.gameTime / 60
  const expected = Math.max(0, Math.round((minutes - 1.1) * settings.csTargetPerMin))
  const cs = live.me?.cs ?? 0
  const diff = cs - expected
  const timers = [...live.timers].sort((a, b) => a.respawnAt - b.respawnAt).slice(0, 4)

  return (
    <div className="p-2" style={{ zoom: o.scale }} dir="ltr">
      <div className="rounded-xl border border-white/10 bg-[#0b0f17]/85 p-3 text-white shadow-2xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#c8aa6e]">
          <span>RIFT COACH</span>
          <span className="tnum text-white/80">{clock(live.gameTime)}</span>
        </div>
        {o.showCsPace && (
          <div className="mb-2 rounded-lg bg-white/5 px-2.5 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase text-white/50">{t('live.csPace')}</span>
              <span className={clsx('text-sm font-bold tnum', diff >= 0 ? 'text-[#2fbf71]' : 'text-[#e66767]')}>
                {diff > 0 ? '+' : ''}
                {diff}
              </span>
            </div>
            <div className="mt-0.5 text-lg font-bold tnum">
              {cs} <span className="text-xs font-medium text-white/50">/ {expected}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={clsx('h-full rounded-full', diff >= 0 ? 'bg-[#2fbf71]' : 'bg-[#fab219]')}
                style={{ width: `${Math.min(100, expected ? (cs / expected) * 100 : 100)}%` }}
              />
            </div>
          </div>
        )}
        {o.showTimers && (
          <div className="space-y-1">
            {timers.map((tm) => {
              const left = tm.respawnAt - live.gameTime
              return (
                <div key={tm.key} className="flex items-center justify-between text-xs">
                  <span className="text-white/70">{timerLabel(t.d, tm)}</span>
                  <span className={clsx('font-bold tnum', left <= 0 ? 'text-[#2fbf71]' : left < 60 ? 'text-[#fab219]' : 'text-white')}>
                    {left <= 0 ? 'UP' : clock(left)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
