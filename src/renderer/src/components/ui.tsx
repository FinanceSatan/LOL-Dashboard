import clsx from 'clsx'
import { X } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from 'react'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClass,
  icon
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClass?: string
  icon?: ReactNode
}) {
  return (
    <section className={clsx('rounded-xl border border-line bg-panel card-glow', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink">
                {icon && <span className="text-gold">{icon}</span>}
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4', bodyClass)}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
  className
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: 'good' | 'bad' | 'warn' | 'gold' | 'accent'
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('rounded-xl border border-line bg-panel px-4 py-3 card-glow', className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-muted">
        <span className="truncate">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div
        className={clsx(
          'mt-1.5 text-2xl font-semibold leading-tight tnum',
          tone === 'good' && 'text-good',
          tone === 'bad' && 'text-bad',
          tone === 'warn' && 'text-warn',
          tone === 'gold' && 'text-gold',
          tone === 'accent' && 'text-accent'
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink2">{sub}</div>}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'subtle' | 'danger' | 'gold'

export function Button({
  variant = 'subtle',
  size = 'md',
  icon,
  children,
  className,
  loading,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  loading?: boolean
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'no-drag inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-7 px-2.5 text-xs',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-11 px-5 text-sm',
        variant === 'primary' && 'bg-accent text-white hover:bg-[#4a95ee]',
        variant === 'gold' && 'bg-gold text-[#1a1408] hover:bg-[#d6ba80]',
        variant === 'subtle' && 'border border-line2 bg-panel2 text-ink hover:bg-panel3',
        variant === 'ghost' && 'text-ink2 hover:bg-panel2 hover:text-ink',
        variant === 'danger' && 'border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20',
        className
      )}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'gold' | 'accent'
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        tone === 'neutral' && 'bg-panel3 text-ink2',
        tone === 'good' && 'bg-good/15 text-good',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'gold' && 'bg-gold/15 text-gold',
        tone === 'accent' && 'bg-accent/15 text-accent',
        className
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'no-drag h-9 w-full rounded-lg border border-line2 bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none',
        props.className
      )}
    />
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      dir="auto"
      {...props}
      className={clsx(
        'no-drag w-full rounded-lg border border-line2 bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none',
        props.className
      )}
    />
  )
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  className
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value
        const opt = options.find((o) => String(o.value) === raw)
        if (opt) onChange(opt.value)
      }}
      className={clsx(
        'no-drag h-9 rounded-lg border border-line2 bg-bg px-2.5 text-sm text-ink focus:border-accent focus:outline-none',
        className
      )}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {typeof o.label === 'string' || typeof o.label === 'number' ? o.label : String(o.value)}
        </option>
      ))}
    </select>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="no-drag inline-flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-panel3'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'start-[18px]' : 'start-0.5'
          )}
        />
      </button>
      {label && <span className="text-sm text-ink2">{label}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md'
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="no-drag inline-flex rounded-lg border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'bg-panel3 text-ink shadow' : 'text-muted hover:text-ink2'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({
  value,
  max = 1,
  tone = 'accent',
  className
}: {
  value: number
  max?: number
  tone?: 'accent' | 'good' | 'bad' | 'warn' | 'gold'
  className?: string
}) {
  const p = Math.max(0, Math.min(1, max ? value / max : 0))
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-panel3', className)}>
      <div
        className={clsx(
          'h-full rounded-full transition-all',
          tone === 'accent' && 'bg-accent',
          tone === 'good' && 'bg-good',
          tone === 'bad' && 'bg-bad',
          tone === 'warn' && 'bg-warn',
          tone === 'gold' && 'bg-gold'
        )}
        style={{ width: `${p * 100}%` }}
      />
    </div>
  )
}

export function Empty({
  icon,
  title,
  body,
  action,
  className
}: {
  icon?: ReactNode
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {body && <div className="max-w-md text-xs leading-relaxed text-muted">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6 pt-16 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx('fade-in w-full rounded-2xl border border-line2 bg-panel shadow-2xl', wide ? 'max-w-6xl' : 'max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-panel2 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-ink2">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</div>}
    </label>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Delta chip comparing a value with a target. */
export function DeltaChip({ value, target, higherIsBetter = true, format }: { value: number | null; target: number | null; higherIsBetter?: boolean; format: (v: number) => string }) {
  if (value == null || target == null || !Number.isFinite(value) || !Number.isFinite(target)) return null
  const good = higherIsBetter ? value >= target : value <= target
  const close = Math.abs(value - target) <= Math.abs(target) * 0.05
  return (
    <span className={clsx('text-[11px] font-semibold tnum', good ? 'text-good' : close ? 'text-warn' : 'text-bad')}>
      {good ? '▲' : '▼'} {format(target)}
    </span>
  )
}

export function WinLossPills({ results, size = 18 }: { results: boolean[]; size?: number }) {
  return (
    <div className="flex flex-wrap gap-1" dir="ltr">
      {results.map((w, i) => (
        <span
          key={i}
          className={clsx(
            'inline-flex items-center justify-center rounded text-[10px] font-bold',
            w ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'
          )}
          style={{ width: size, height: size }}
        >
          {w ? 'W' : 'L'}
        </span>
      ))}
    </div>
  )
}
