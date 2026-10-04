import { net } from 'electron'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChampionDetail, DDChampion, DDItem, DDRuneStyle, DDSummonerSpell, StaticData } from '@shared/types'
import { cacheDir } from '../store'

const CDN = 'https://ddragon.leagueoflegends.com'

async function getJson<T>(url: string): Promise<T> {
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`Data Dragon ${res.status} for ${url}`)
  return (await res.json()) as T
}

let memo: StaticData | null = null
let pending: Promise<StaticData> | null = null

function cachedVersions(): string[] {
  const dir = cacheDir('ddragon')
  return readdirSync(dir)
    .filter((f) => /^static-.+\.json$/.test(f))
    .map((f) => f.slice(7, -5))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
}

function readCached(version: string): StaticData | null {
  const file = join(cacheDir('ddragon'), `static-${version}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as StaticData
  } catch {
    return null
  }
}

async function download(version: string): Promise<StaticData> {
  const base = `${CDN}/cdn/${version}/data/en_US`
  const [champs, items, runes, spells] = await Promise.all([
    getJson<any>(`${base}/champion.json`),
    getJson<any>(`${base}/item.json`),
    getJson<any[]>(`${base}/runesReforged.json`),
    getJson<any>(`${base}/summoner.json`)
  ])
  const champions: Record<number, DDChampion> = {}
  for (const c of Object.values<any>(champs.data)) {
    champions[Number(c.key)] = {
      id: c.id,
      key: Number(c.key),
      name: c.name,
      title: c.title,
      tags: c.tags,
      info: c.info,
      partype: c.partype
    }
  }
  const itemMap: Record<number, DDItem> = {}
  for (const [id, it] of Object.entries<any>(items.data)) {
    if (it.maps && it.maps['11'] === false && it.maps['12'] === false) continue
    itemMap[Number(id)] = {
      id: Number(id),
      name: it.name,
      plaintext: it.plaintext ?? '',
      description: it.description ?? '',
      gold: it.gold,
      tags: it.tags ?? [],
      into: it.into ?? [],
      from: it.from ?? [],
      depth: it.depth
    }
  }
  const spellMap: Record<number, DDSummonerSpell> = {}
  for (const s of Object.values<any>(spells.data)) {
    spellMap[Number(s.key)] = {
      id: s.id,
      key: Number(s.key),
      name: s.name,
      cooldown: Array.isArray(s.cooldown) ? s.cooldown[0] : 0,
      image: s.image?.full ?? `${s.id}.png`
    }
  }
  const data: StaticData = {
    version,
    champions,
    items: itemMap,
    runes: runes as DDRuneStyle[],
    spells: spellMap
  }
  writeFileSync(join(cacheDir('ddragon'), `static-${version}.json`), JSON.stringify(data))
  return data
}

export async function getStaticData(): Promise<StaticData> {
  if (memo) return memo
  if (pending) return pending
  pending = (async () => {
    try {
      const versions = await getJson<string[]>(`${CDN}/api/versions.json`)
      const latest = versions[0]
      memo = readCached(latest) ?? (await download(latest))
    } catch (err) {
      console.warn('Data Dragon unavailable, using cache', err)
      const v = cachedVersions()[0]
      memo = v ? readCached(v) : null
      if (!memo) throw err
    }
    return memo
  })()
  try {
    return await pending
  } finally {
    pending = null
  }
}

const detailMemo = new Map<string, ChampionDetail>()

export async function getChampionDetail(id: string): Promise<ChampionDetail> {
  const data = await getStaticData()
  const key = `${data.version}:${id}`
  const hit = detailMemo.get(key)
  if (hit) return hit
  const file = join(cacheDir('ddragon'), `champ-${data.version}-${id.replace(/\W/g, '')}.json`)
  let raw: any
  if (existsSync(file)) raw = JSON.parse(readFileSync(file, 'utf8'))
  else {
    raw = await getJson<any>(`${CDN}/cdn/${data.version}/data/en_US/champion/${encodeURIComponent(id)}.json`)
    writeFileSync(file, JSON.stringify(raw))
  }
  const c = raw.data[id]
  const detail: ChampionDetail = {
    id: c.id,
    key: Number(c.key),
    name: c.name,
    title: c.title,
    lore: c.lore,
    allytips: c.allytips ?? [],
    enemytips: c.enemytips ?? [],
    tags: c.tags ?? [],
    stats: c.stats ?? {},
    passive: { name: c.passive?.name, description: c.passive?.description, image: c.passive?.image?.full },
    spells: (c.spells ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      cooldownBurn: s.cooldownBurn,
      costBurn: s.costBurn,
      rangeBurn: s.rangeBurn,
      image: s.image?.full,
      maxrank: s.maxrank
    }))
  }
  detailMemo.set(key, detail)
  return detail
}
