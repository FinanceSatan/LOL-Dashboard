import type { ReactNode } from 'react'

export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
export const GRID = '#1f2a3d'
export const AXIS = '#6f7d93'
export const WIN = '#3987e5'
export const LOSS = '#e66767'
export const GOLD = '#c8aa6e'

export const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#243149' }
} as const

export function TooltipBox({
  title,
  rows
}: {
  title?: ReactNode
  rows: { label: ReactNode; value: ReactNode; color?: string }[]
}) {
  return (
    <div className="min-w-36 rounded-lg border border-line2 bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {title && <div className="mb-1 font-semibold text-ink">{title}</div>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-semibold text-ink tnum">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: ReactNode; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink2">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ background: it.dashed ? 'transparent' : it.color, borderTop: it.dashed ? `2px dashed ${it.color}` : undefined }}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}
