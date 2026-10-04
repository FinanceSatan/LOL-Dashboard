// Data Dragon / CommunityDragon asset helpers.
import type { DDRune, StaticData } from '@shared/types'

export const CDN = 'https://ddragon.leagueoflegends.com'

export function champKey(sd: StaticData | null, championId: number, fallbackName = ''): string {
  return sd?.champions[championId]?.id ?? fallbackName
}

export function champName(sd: StaticData | null, championId: number, fallbackName = ''): string {
  return sd?.champions[championId]?.name ?? (fallbackName || `#${championId}`)
}

/** Finds a champion by its Data Dragon id or display name (live client gives names). */
export function champByName(sd: StaticData | null, name: string) {
  if (!sd || !name) return undefined
  const n = name.toLowerCase().replace(/[^a-z]/g, '')
  return Object.values(sd.champions).find(
    (c) => c.id.toLowerCase() === n || c.name.toLowerCase().replace(/[^a-z]/g, '') === n
  )
}

export const champIconUrl = (sd: StaticData | null, key: string) =>
  sd && key ? `${CDN}/cdn/${sd.version}/img/champion/${key}.png` : ''
export const champSplashUrl = (key: string) => `${CDN}/cdn/img/champion/splash/${key}_0.jpg`
export const champCenteredUrl = (key: string) => `${CDN}/cdn/img/champion/centered/${key}_0.jpg`
export const itemIconUrl = (sd: StaticData | null, id: number) =>
  sd && id ? `${CDN}/cdn/${sd.version}/img/item/${id}.png` : ''
export const spellIconUrl = (sd: StaticData | null, id: number) => {
  const s = sd?.spells[id]
  return s ? `${CDN}/cdn/${sd!.version}/img/spell/${s.image}` : ''
}
export const profileIconUrl = (sd: StaticData | null, id?: number) =>
  sd && id != null ? `${CDN}/cdn/${sd.version}/img/profileicon/${id}.png` : ''
export const abilityIconUrl = (sd: StaticData | null, image: string) =>
  sd ? `${CDN}/cdn/${sd.version}/img/spell/${image}` : ''
export const passiveIconUrl = (sd: StaticData | null, image: string) =>
  sd ? `${CDN}/cdn/${sd.version}/img/passive/${image}` : ''
export const mapUrl = (sd: StaticData | null) => `${CDN}/cdn/${sd?.version ?? '14.1.1'}/img/map/map11.png`
export const runeIconUrl = (icon: string) => `${CDN}/cdn/img/${icon}`

export function findRune(sd: StaticData | null, id: number): DDRune | undefined {
  if (!sd) return undefined
  for (const style of sd.runes) for (const slot of style.slots) for (const r of slot.runes) if (r.id === id) return r
  return undefined
}

export function findStyle(sd: StaticData | null, id: number) {
  return sd?.runes.find((s) => s.id === id)
}

export const STAT_SHARDS: Record<number, string> = {
  5008: 'Adaptive',
  5005: 'Attack Speed',
  5007: 'Ability Haste',
  5001: 'Health Scaling',
  5011: 'Health',
  5013: 'Tenacity',
  5010: 'Move Speed',
  5002: 'Armor',
  5003: 'Magic Resist'
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}
