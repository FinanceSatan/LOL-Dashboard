import type { Division, PlatformId, Role, Tier } from './types'

export const PLATFORMS: { id: PlatformId; label: string; region: 'americas' | 'europe' | 'asia' | 'sea' }[] = [
  { id: 'euw1', label: 'EUW', region: 'europe' },
  { id: 'eun1', label: 'EUNE', region: 'europe' },
  { id: 'me1', label: 'ME', region: 'europe' },
  { id: 'tr1', label: 'TR', region: 'europe' },
  { id: 'ru', label: 'RU', region: 'europe' },
  { id: 'na1', label: 'NA', region: 'americas' },
  { id: 'br1', label: 'BR', region: 'americas' },
  { id: 'la1', label: 'LAN', region: 'americas' },
  { id: 'la2', label: 'LAS', region: 'americas' },
  { id: 'kr', label: 'KR', region: 'asia' },
  { id: 'jp1', label: 'JP', region: 'asia' },
  { id: 'oc1', label: 'OCE', region: 'sea' },
  { id: 'ph2', label: 'PH', region: 'sea' },
  { id: 'sg2', label: 'SG', region: 'sea' },
  { id: 'th2', label: 'TH', region: 'sea' },
  { id: 'tw2', label: 'TW', region: 'sea' },
  { id: 'vn2', label: 'VN', region: 'sea' }
]

export function regionOf(platform: PlatformId): 'americas' | 'europe' | 'asia' | 'sea' {
  return PLATFORMS.find((p) => p.id === platform)?.region ?? 'europe'
}

/** Account-v1 is served by americas/europe/asia only. */
export function accountRegionOf(platform: PlatformId): 'americas' | 'europe' | 'asia' {
  const r = regionOf(platform)
  return r === 'sea' ? 'asia' : r
}

/** Maps the League client's region string (e.g. "EUW") to a platform id. */
export function platformFromClientRegion(region: string): PlatformId | null {
  const map: Record<string, PlatformId> = {
    EUW: 'euw1',
    EUNE: 'eun1',
    NA: 'na1',
    KR: 'kr',
    JP: 'jp1',
    BR: 'br1',
    LA1: 'la1',
    LAN: 'la1',
    LA2: 'la2',
    LAS: 'la2',
    OC1: 'oc1',
    OCE: 'oc1',
    TR: 'tr1',
    RU: 'ru',
    ME1: 'me1',
    ME: 'me1',
    PH2: 'ph2',
    SG2: 'sg2',
    TH2: 'th2',
    TW2: 'tw2',
    VN2: 'vn2'
  }
  return map[region.toUpperCase()] ?? null
}

export const QUEUES: Record<number, { short: string; fa: string; en: string; ranked?: boolean; sr?: boolean }> = {
  420: { short: 'SOLO', fa: 'رنکد سولو/دو', en: 'Ranked Solo/Duo', ranked: true, sr: true },
  440: { short: 'FLEX', fa: 'رنکد فلکس', en: 'Ranked Flex', ranked: true, sr: true },
  400: { short: 'DRAFT', fa: 'نرمال درفت', en: 'Normal Draft', sr: true },
  430: { short: 'BLIND', fa: 'نرمال بلایند', en: 'Normal Blind', sr: true },
  490: { short: 'QUICK', fa: 'کوئیک‌پلی', en: 'Quickplay', sr: true },
  480: { short: 'SWIFT', fa: 'سوییفت‌پلی', en: 'Swiftplay', sr: true },
  450: { short: 'ARAM', fa: 'آرام', en: 'ARAM' },
  1700: { short: 'ARENA', fa: 'آرنا', en: 'Arena' },
  1900: { short: 'URF', fa: 'URF', en: 'URF' },
  900: { short: 'URF', fa: 'ARURF', en: 'ARURF' },
  0: { short: 'CUSTOM', fa: 'کاستوم', en: 'Custom' }
}

export function isSummonersRift(queueId: number): boolean {
  return QUEUES[queueId]?.sr === true
}

export const TIERS: Tier[] = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER'
]

export const DIVISIONS: Division[] = ['IV', 'III', 'II', 'I']

export const TIER_COLORS: Record<Tier, string> = {
  IRON: '#7c7472',
  BRONZE: '#a0694a',
  SILVER: '#9aa6b2',
  GOLD: '#d6a940',
  PLATINUM: '#3fb3a8',
  EMERALD: '#2fbf71',
  DIAMOND: '#6f8bf2',
  MASTER: '#b05be0',
  GRANDMASTER: '#e0484b',
  CHALLENGER: '#f2c94c'
}

export function isApexTier(tier: Tier): boolean {
  return tier === 'MASTER' || tier === 'GRANDMASTER' || tier === 'CHALLENGER'
}

/** Linear "ladder points" scale: Iron IV 0 LP = 0, each division = 100, Master 0 LP = 2800. */
export function absoluteLp(tier: Tier, division: Division, lp: number): number {
  const ti = TIERS.indexOf(tier)
  if (ti >= 7) return 2800 + lp
  const di = DIVISIONS.indexOf(division)
  return ti * 400 + Math.max(0, di) * 100 + lp
}

export function rankFromAbsolute(abs: number): { tier: Tier; division: Division; lp: number } {
  if (abs >= 2800) return { tier: 'MASTER', division: 'I', lp: Math.round(abs - 2800) }
  const ti = Math.max(0, Math.floor(abs / 400))
  const rem = abs - ti * 400
  const di = Math.min(3, Math.floor(rem / 100))
  return { tier: TIERS[ti], division: DIVISIONS[di], lp: Math.round(rem - di * 100) }
}

export const RANK_EMBLEM = (tier: Tier): string =>
  `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`

export const ROLE_ICON = (role: Role): string => {
  const map: Record<Role, string> = {
    TOP: 'top',
    JUNGLE: 'jungle',
    MIDDLE: 'middle',
    BOTTOM: 'bottom',
    UTILITY: 'utility'
  }
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${map[role]}.png`
}

/** Objective respawn timers (seconds). */
export const OBJECTIVE_TIMERS = {
  dragonFirst: 5 * 60,
  dragonRespawn: 5 * 60,
  elderRespawn: 6 * 60,
  baronFirst: 20 * 60,
  baronRespawn: 6 * 60,
  heraldFirst: 14 * 60,
  grubsFirst: 5 * 60,
  atakhanFirst: 20 * 60,
  inhibitorRespawn: 5 * 60,
  blueRedBuff: 5 * 60,
  scuttle: 150,
  campRespawn: 135
}

export const RIOT_DISCLAIMER =
  "Rift Coach isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc."

// Summoner's Rift map bounds used to convert game coordinates to minimap coordinates.
export const MAP_BOUNDS = { minX: -120, minY: -120, maxX: 14870, maxY: 14980 }
