import { isSummonersRift } from '@shared/constants'
import { demoLeaderboard, demoScout } from '@shared/demo'
import { normalizeMatchV4, normalizeMatchV5 } from '@shared/normalize'
import type {
  Account,
  Leaderboard,
  LeaderboardEntry,
  ProfileData,
  RankEntry,
  ScoutPlayer,
  ScoutResult,
  SyncProgress,
  SyncResult
} from '@shared/types'
import { RiotApi, RiotApiError } from './riot/client'
import type { LcuClient } from './lcu/lcu'
import { activeAccount, getApiKey, getSettings, loadProfileData, saveProfileData, upsertAccount } from './store'

export const riot = new RiotApi(getApiKey)

type Emit = (channel: string, payload: unknown) => void

function mapEntry(e: any): RankEntry {
  return {
    queueType: e.queueType,
    tier: e.tier,
    rank: e.rank ?? e.division,
    leaguePoints: Number(e.leaguePoints ?? 0),
    wins: Number(e.wins ?? 0),
    losses: Number(e.losses ?? 0),
    hotStreak: Boolean(e.hotStreak),
    veteran: Boolean(e.veteran),
    freshBlood: Boolean(e.freshBlood),
    miniSeries: e.miniSeries
  }
}

function recordRank(data: ProfileData, ranks: RankEntry[]): void {
  for (const r of ranks) {
    if (r.queueType !== 'RANKED_SOLO_5x5' && r.queueType !== 'RANKED_FLEX_SR') continue
    const last = [...data.rankHistory].reverse().find((s) => s.queueType === r.queueType)
    if (
      !last ||
      last.lp !== r.leaguePoints ||
      last.tier !== r.tier ||
      last.rank !== r.rank ||
      last.wins !== r.wins ||
      last.losses !== r.losses
    ) {
      data.rankHistory.push({
        t: Date.now(),
        queueType: r.queueType,
        tier: r.tier,
        rank: r.rank,
        lp: r.leaguePoints,
        wins: r.wins,
        losses: r.losses
      })
    }
  }
}

export function errorCode(err: unknown): string {
  if (err instanceof RiotApiError) return err.message
  const msg = (err as Error)?.message ?? String(err)
  return msg.startsWith('LCU') || msg.includes('ECONNREFUSED') ? 'CLIENT_NOT_RUNNING' : msg
}

let running: Promise<SyncResult> | null = null

export function syncActive(
  emit: Emit,
  getLcu: () => LcuClient | null,
  options: { older?: number; auto?: boolean } = {}
): Promise<SyncResult> {
  if (running) return running
  running = (async () => {
    const account = activeAccount()
    const progress = (p: SyncProgress) => emit('sync:progress', p)
    let result: SyncResult
    if (!account) result = { ok: false, newMatches: 0, error: 'NO_ACCOUNT' }
    else if (account.demo) {
      progress({ stage: 'done', done: 0, total: 0 })
      result = { ok: true, newMatches: 0 }
    } else {
      const data = loadProfileData(account)
      try {
        const n =
          getSettings().dataSource === 'client'
            ? await syncFromClient(data, getLcu(), progress, options.older)
            : await syncFromRiot(data, progress, options.older)
        data.matches.sort((a, b) => b.gameCreation - a.gameCreation)
        data.lastSync = Date.now()
        saveProfileData(data)
        progress({ stage: 'done', done: n, total: n })
        result = { ok: true, newMatches: n }
      } catch (err) {
        saveProfileData(data)
        const code = errorCode(err)
        progress({ stage: 'error', done: 0, total: 0, message: code })
        result = { ok: false, newMatches: 0, error: code }
      }
    }
    emit('sync:done', { ...result, auto: Boolean(options.auto) })
    return result
  })().finally(() => {
    running = null
  })
  return running
}

async function syncFromRiot(
  data: ProfileData,
  progress: (p: SyncProgress) => void,
  older?: number
): Promise<number> {
  const settings = getSettings()
  const { account } = data
  progress({ stage: 'profile', done: 0, total: 1 })
  const [summoner, entries] = await Promise.all([
    riot.summonerByPuuid(account.platform, account.puuid),
    riot.leagueEntries(account.platform, account.puuid)
  ])
  const updated: Account = { ...account, profileIconId: summoner.profileIconId, summonerLevel: summoner.summonerLevel }
  upsertAccount(updated, false)
  data.account = updated
  const ranks = entries.map(mapEntry)
  data.profile = { account: updated, ranks, fetchedAt: Date.now() }
  recordRank(data, ranks)

  progress({ stage: 'ids', done: 0, total: 1 })
  const known = new Set(data.matches.map((m) => m.matchId))
  const ids: string[] = []
  if (older && older > 0) {
    let start = data.matches.length
    const end = start + older
    while (start < end) {
      const batch = await riot.matchIds(account.platform, account.puuid, start, Math.min(100, end - start))
      ids.push(...batch.filter((id) => !known.has(id)))
      if (batch.length < Math.min(100, end - start)) break
      start += batch.length
    }
  } else if (data.matches.length === 0) {
    const target = settings.initialSyncCount
    for (let start = 0; start < target; start += 100) {
      const count = Math.min(100, target - start)
      const batch = await riot.matchIds(account.platform, account.puuid, start, count)
      ids.push(...batch)
      if (batch.length < count) break
    }
  } else {
    for (let start = 0; start < 300; start += 20) {
      const batch = await riot.matchIds(account.platform, account.puuid, start, 20)
      let hitKnown = false
      for (const id of batch) {
        if (known.has(id)) {
          hitKnown = true
          break
        }
        ids.push(id)
      }
      if (hitKnown || batch.length < 20) break
    }
  }

  let added = 0
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    try {
      const match = await riot.match(account.platform, id)
      const timeline = isSummonersRift(Number(match?.info?.queueId))
        ? await riot.timeline(account.platform, id).catch(() => null)
        : null
      const summary = normalizeMatchV5(match, timeline, account.puuid)
      if (summary && !known.has(summary.matchId)) {
        data.matches.push(summary)
        known.add(summary.matchId)
        added++
      }
    } catch (err) {
      if (err instanceof RiotApiError && (err.status === 401 || err.status === 403 || err.status === 0)) throw err
      console.warn('Skipping match', id, err)
    }
    progress({ stage: 'matches', done: i + 1, total: ids.length })
    if ((i + 1) % 10 === 0) saveProfileData(data)
  }
  return added
}

async function syncFromClient(
  data: ProfileData,
  lcu: LcuClient | null,
  progress: (p: SyncProgress) => void,
  older?: number
): Promise<number> {
  if (!lcu) throw new Error('CLIENT_NOT_RUNNING')
  const { account } = data
  progress({ stage: 'profile', done: 0, total: 1 })
  const me = await lcu.get<any>('/lol-summoner/v1/current-summoner')
  if (me?.puuid !== account.puuid) throw new Error('CLIENT_OTHER_ACCOUNT')
  const ranked = await lcu.get<any>('/lol-ranked/v1/current-ranked-stats').catch(() => null)
  const ranks: RankEntry[] = Object.values<any>(ranked?.queueMap ?? {})
    .filter((q) => q.tier && q.tier !== 'NONE' && q.tier !== '')
    .map((q) => mapEntry({ ...q, rank: q.division }))
  const updated: Account = { ...account, profileIconId: me.profileIconId, summonerLevel: me.summonerLevel }
  upsertAccount(updated, false)
  data.account = updated
  data.profile = { account: updated, ranks, fetchedAt: Date.now() }
  recordRank(data, ranks)

  progress({ stage: 'ids', done: 0, total: 1 })
  const known = new Set(data.matches.map((m) => m.matchId))
  const begin = older ? data.matches.length : 0
  const target = older ? begin + older : data.matches.length === 0 ? getSettings().initialSyncCount : 40
  const games: any[] = []
  for (let beg = begin; beg < target; beg += 20) {
    const res = await lcu.get<any>(
      `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${beg}&endIndex=${Math.min(target, beg + 20)}`
    )
    const list: any[] = res?.games?.games ?? []
    games.push(...list)
    if (list.length < 20) break
  }
  const fresh = games.filter((g) => !known.has(`${String(g.platformId).toUpperCase()}_${g.gameId}`))
  let added = 0
  for (let i = 0; i < fresh.length; i++) {
    const g = fresh[i]
    try {
      const full = await lcu.get<any>(`/lol-match-history/v1/games/${g.gameId}`)
      const timeline = isSummonersRift(Number(full?.queueId))
        ? await lcu.get<any>(`/lol-match-history/v1/game-timelines/${g.gameId}`).catch(() => null)
        : null
      const summary = normalizeMatchV4(full, timeline, account.puuid)
      if (summary && !known.has(summary.matchId)) {
        data.matches.push(summary)
        known.add(summary.matchId)
        added++
      }
    } catch (err) {
      console.warn('Skipping client game', g.gameId, err)
    }
    progress({ stage: 'matches', done: i + 1, total: fresh.length })
  }
  return added
}

// ---------------------------------------------------------------------------
// Live game scouting
// ---------------------------------------------------------------------------

export async function scoutLiveGame(
  getLcu: () => LcuClient | null,
  target?: { gameName: string; tagLine: string }
): Promise<ScoutResult | null> {
  const account = activeAccount()
  if (!account) throw new Error('NO_ACCOUNT')
  if (account.demo && !target) return demoScout()
  const settings = getSettings()

  if (settings.dataSource === 'riot' && settings.hasApiKey) {
    let puuid = account.puuid
    if (target) puuid = (await riot.accountByRiotId(account.platform, target.gameName, target.tagLine)).puuid
    let game: any
    try {
      game = await riot.activeGame(account.platform, puuid)
    } catch (err) {
      if (err instanceof RiotApiError && err.status === 404) return null
      throw err
    }
    const players: ScoutPlayer[] = await Promise.all(
      (game.participants ?? []).map(async (p: any): Promise<ScoutPlayer> => {
        const base: ScoutPlayer = {
          puuid: p.puuid,
          name: p.riotId ?? p.summonerName ?? 'Unknown',
          championId: p.championId,
          teamId: p.teamId,
          spells: [p.spell1Id, p.spell2Id],
          keystone: p.perks?.perkIds?.[0],
          isMe: p.puuid === account.puuid
        }
        if (!p.puuid) return base
        try {
          const [entries, mastery] = await Promise.all([
            riot.leagueEntries(account.platform, p.puuid),
            riot.masteryByChampion(account.platform, p.puuid, p.championId).catch(() => null)
          ])
          const ranks = entries.map(mapEntry)
          return {
            ...base,
            solo: ranks.find((r) => r.queueType === 'RANKED_SOLO_5x5') ?? null,
            flex: ranks.find((r) => r.queueType === 'RANKED_FLEX_SR') ?? null,
            masteryPoints: mastery?.championPoints ?? 0,
            masteryLevel: mastery?.championLevel ?? 0
          }
        } catch (err) {
          return { ...base, error: errorCode(err) }
        }
      })
    )
    return {
      gameId: game.gameId,
      queueId: game.gameQueueConfigId,
      gameStart: game.gameStartTime,
      players,
      bans: (game.bannedChampions ?? []).map((b: any) => ({ teamId: b.teamId, championId: b.championId })),
      source: 'riot'
    }
  }

  const lcu = getLcu()
  if (!lcu) throw new Error('CLIENT_NOT_RUNNING')
  const session = await lcu.get<any>('/lol-gameflow/v1/session')
  if (session?.phase !== 'InProgress' && session?.phase !== 'GameStart') return null
  const teams: any[][] = [session.gameData?.teamOne ?? [], session.gameData?.teamTwo ?? []]
  const players: ScoutPlayer[] = []
  for (let ti = 0; ti < 2; ti++) {
    for (const p of teams[ti]) {
      const player: ScoutPlayer = {
        puuid: p.puuid ?? '',
        name: p.gameName ? `${p.gameName}#${p.tagLine}` : p.summonerName ?? 'Unknown',
        championId: p.championId,
        teamId: ti === 0 ? 100 : 200,
        spells: [p.spell1Id ?? 0, p.spell2Id ?? 0],
        isMe: p.puuid === account.puuid
      }
      if (p.puuid) {
        try {
          const ranked = await lcu.get<any>(`/lol-ranked/v1/ranked-stats/${p.puuid}`)
          const q = ranked?.queueMap ?? {}
          const toEntry = (x: any) => (x && x.tier && x.tier !== 'NONE' ? mapEntry({ ...x, rank: x.division }) : null)
          player.solo = toEntry(q.RANKED_SOLO_5x5)
          player.flex = toEntry(q.RANKED_FLEX_SR)
        } catch (err) {
          player.error = errorCode(err)
        }
      }
      players.push(player)
    }
  }
  return {
    gameId: session.gameData?.gameId ?? 0,
    queueId: session.gameData?.queue?.id ?? 0,
    gameStart: Date.now(),
    players,
    bans: [],
    source: 'client'
  }
}

// ---------------------------------------------------------------------------
// Apex ladder
// ---------------------------------------------------------------------------

let ladderCache: Leaderboard | null = null

export async function getLeaderboard(): Promise<Leaderboard> {
  const account = activeAccount()
  if (!account) throw new Error('NO_ACCOUNT')
  if (account.demo || !getSettings().hasApiKey) return demoLeaderboard()
  if (ladderCache && ladderCache.platform === account.platform && Date.now() - ladderCache.fetchedAt < 10 * 60000) {
    return ladderCache
  }
  const [chall, gm] = await Promise.all([
    riot.apexLeague(account.platform, 'challenger'),
    riot.apexLeague(account.platform, 'grandmaster')
  ])
  const toEntry = (tier: 'CHALLENGER' | 'GRANDMASTER') => (e: any): LeaderboardEntry => ({
    puuid: e.puuid,
    lp: e.leaguePoints,
    wins: e.wins,
    losses: e.losses,
    tier,
    hotStreak: Boolean(e.hotStreak)
  })
  const challenger = (chall.entries ?? []).map(toEntry('CHALLENGER')).sort((a, b) => b.lp - a.lp)
  const grandmaster = (gm.entries ?? []).map(toEntry('GRANDMASTER')).sort((a, b) => b.lp - a.lp)
  // Resolve Riot IDs for the very top of the ladder (cheap enough for a dev key).
  await Promise.all(
    challenger.slice(0, 10).map(async (e) => {
      try {
        const acc = await riot.accountByPuuid(account.platform, e.puuid)
        e.name = `${acc.gameName}#${acc.tagLine}`
      } catch {
        /* name stays unknown */
      }
    })
  )
  ladderCache = {
    platform: account.platform,
    queue: 'RANKED_SOLO_5x5',
    fetchedAt: Date.now(),
    entries: [...challenger, ...grandmaster],
    cutoffs: {
      challenger: challenger.length ? challenger[challenger.length - 1].lp : null,
      grandmaster: grandmaster.length ? grandmaster[grandmaster.length - 1].lp : null,
      master: 0
    }
  }
  return ladderCache
}
