import clsx from 'clsx'
import { useState } from 'react'
import { ROLE_ICON, TIER_COLORS, RANK_EMBLEM, isApexTier } from '@shared/constants'
import type { Division, Role, RunePage, Tier } from '@shared/types'
import { useApp } from '@/store/app'
import {
  STAT_SHARDS,
  champIconUrl,
  champKey,
  champName,
  findRune,
  findStyle,
  itemIconUrl,
  profileIconUrl,
  runeIconUrl,
  spellIconUrl,
  stripHtml
} from '@/lib/dd'

function Img({
  src,
  size,
  alt,
  className,
  fallback,
  title
}: {
  src: string
  size: number
  alt: string
  className?: string
  fallback?: string
  title?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span
        title={title ?? alt}
        className={clsx('inline-flex shrink-0 items-center justify-center bg-panel3 text-[10px] font-bold text-muted', className)}
        style={{ width: size, height: size }}
      >
        {(fallback ?? alt).slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      title={title ?? alt}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={clsx('shrink-0 object-cover', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function ChampIcon({
  id,
  name,
  size = 32,
  className,
  rounded = 'md'
}: {
  id: number
  name?: string
  size?: number
  className?: string
  rounded?: 'md' | 'full' | 'lg'
}) {
  const sd = useApp((s) => s.staticData)
  const fallback = useApp((s) => s.champNames[id])
  const key = champKey(sd, id, name || fallback)
  const label = champName(sd, id, name || fallback)
  return (
    <Img
      src={champIconUrl(sd, key)}
      size={size}
      alt={label || '?'}
      className={clsx(rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-lg' : 'rounded-md', className)}
    />
  )
}

export function useChampName() {
  const sd = useApp((s) => s.staticData)
  const names = useApp((s) => s.champNames)
  return (id: number, fallback = '') => champName(sd, id, fallback || names[id]) || fallback || names[id] || `#${id}`
}

export function ItemIcon({ id, size = 24, className }: { id: number; size?: number; className?: string }) {
  const sd = useApp((s) => s.staticData)
  if (!id) return <span className={clsx('inline-block shrink-0 rounded bg-panel3/70', className)} style={{ width: size, height: size }} />
  const it = sd?.items[id]
  const title = it ? `${it.name} — ${it.gold.total}g\n${stripHtml(it.plaintext || '')}` : `#${id}`
  return <Img src={itemIconUrl(sd, id)} size={size} alt={it?.name ?? String(id)} title={title} className={clsx('rounded', className)} />
}

export function ItemRow({ items, size = 22 }: { items: number[]; size?: number }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {items.slice(0, 6).map((id, i) => (
        <ItemIcon key={i} id={id} size={size} />
      ))}
      <ItemIcon id={items[6] ?? 0} size={size} className="ms-1 rounded-full" />
    </div>
  )
}

export function SpellIcon({ id, size = 20 }: { id: number; size?: number }) {
  const sd = useApp((s) => s.staticData)
  const sp = sd?.spells[id]
  return <Img src={spellIconUrl(sd, id)} size={size} alt={sp?.name ?? String(id)} className="rounded" />
}

export function RuneIcon({ id, size = 20, className }: { id: number; size?: number; className?: string }) {
  const sd = useApp((s) => s.staticData)
  const rune = findRune(sd, id)
  const style = rune ? undefined : findStyle(sd, id)
  const icon = rune?.icon ?? style?.icon
  return (
    <Img
      src={icon ? runeIconUrl(icon) : ''}
      size={size}
      alt={rune?.name ?? style?.name ?? String(id)}
      title={rune ? `${rune.name}\n${stripHtml(rune.shortDesc)}` : style?.name}
      className={clsx('rounded-full', className)}
    />
  )
}

export function RunePageView({ page, compact }: { page: RunePage; compact?: boolean }) {
  const sd = useApp((s) => s.staticData)
  const primary = findStyle(sd, page.primaryStyle)
  const sub = findStyle(sd, page.subStyle)
  return (
    <div className={clsx('flex items-center gap-3', compact && 'gap-2')} dir="ltr">
      <div className="flex items-center gap-1">
        <RuneIcon id={page.perks[0]} size={compact ? 26 : 34} className="bg-black/40" />
        {page.perks.slice(1, 4).map((p) => (
          <RuneIcon key={p} id={p} size={compact ? 18 : 22} />
        ))}
      </div>
      <div className="flex items-center gap-1 border-s border-line ps-2">
        {page.perks.slice(4, 6).map((p) => (
          <RuneIcon key={p} id={p} size={compact ? 18 : 22} />
        ))}
      </div>
      {!compact && (
        <div className="flex flex-col text-[10px] leading-tight text-muted">
          <span>
            {primary?.name ?? page.primaryStyle} / {sub?.name ?? page.subStyle}
          </span>
          <span>{page.statPerks.map((s) => STAT_SHARDS[s] ?? s).join(' · ')}</span>
        </div>
      )}
    </div>
  )
}

export function ProfileIcon({ id, size = 48, className }: { id?: number; size?: number; className?: string }) {
  const sd = useApp((s) => s.staticData)
  return <Img src={profileIconUrl(sd, id)} size={size} alt="icon" className={clsx('rounded-full', className)} />
}

export function RankEmblem({ tier, size = 48 }: { tier?: Tier | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!tier) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border border-line2 bg-panel2 text-[10px] font-bold text-muted"
        style={{ width: size, height: size }}
      >
        UNR
      </span>
    )
  }
  if (failed) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full text-xs font-black"
        style={{ width: size, height: size, background: `${TIER_COLORS[tier]}22`, color: TIER_COLORS[tier], border: `1px solid ${TIER_COLORS[tier]}66` }}
      >
        {tier.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={RANK_EMBLEM(tier)}
      alt={tier}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size, transform: 'scale(1.5)' }}
      draggable={false}
    />
  )
}

export function rankText(tier?: Tier | null, rank?: Division, lp?: number): string {
  if (!tier) return 'Unranked'
  const t = tier.charAt(0) + tier.slice(1).toLowerCase()
  return isApexTier(tier) ? `${t} ${lp ?? 0} LP` : `${t} ${rank ?? ''} · ${lp ?? 0} LP`
}

export function TierText({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span className={clsx('font-semibold', className)} style={{ color: TIER_COLORS[tier] }}>
      {tier.charAt(0) + tier.slice(1).toLowerCase()}
    </span>
  )
}

export function RoleIcon({ role, size = 18, className }: { role: Role | ''; size?: number; className?: string }) {
  if (!role) return null
  return <Img src={ROLE_ICON(role)} size={size} alt={role} className={clsx('opacity-80', className)} />
}
