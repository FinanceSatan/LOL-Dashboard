// Builds the dashboard's live-game state from the Live Client Data API payload.
import { OBJECTIVE_TIMERS } from './constants'
import type { LiveClientState, LiveObjectiveTimer, LivePlayer } from './types'

const championIdFromRaw = (raw: string | undefined, fallback: string) =>
  raw && raw.startsWith('game_character_displayname_') ? raw.slice('game_character_displayname_'.length) : fallback

const LANE_NAMES: Record<string, string> = { L: 'Top', C: 'Mid', R: 'Bot' }

export function buildLiveState(all: any): LiveClientState {
  const gameTime = Number(all?.gameData?.gameTime ?? 0)
  const active = all?.activePlayer ?? {}
  const myNames = new Set<string>(
    [active.riotId, active.riotIdGameName, active.summonerName].filter(Boolean).map(String)
  )
  const teamByName = new Map<string, 'ORDER' | 'CHAOS'>()
  const players: LivePlayer[] = (all?.allPlayers ?? []).map((p: any) => {
    const names = [p.riotId, p.riotIdGameName, p.summonerName].filter(Boolean).map(String)
    const team = p.team === 'CHAOS' ? 'CHAOS' : 'ORDER'
    names.forEach((n) => teamByName.set(n, team))
    return {
      name: String(p.riotId ?? p.summonerName ?? ''),
      championName: championIdFromRaw(p.rawChampionName, String(p.championName ?? '')),
      team,
      level: Number(p.level ?? 0),
      kills: Number(p.scores?.kills ?? 0),
      deaths: Number(p.scores?.deaths ?? 0),
      assists: Number(p.scores?.assists ?? 0),
      cs: Number(p.scores?.creepScore ?? 0),
      wardScore: Number(p.scores?.wardScore ?? 0),
      items: (p.items ?? []).sort((a: any, b: any) => a.slot - b.slot).map((i: any) => Number(i.itemID)),
      position: String(p.position ?? ''),
      isMe: names.some((n) => myNames.has(n)),
      isDead: Boolean(p.isDead),
      respawnTimer: Number(p.respawnTimer ?? 0)
    } satisfies LivePlayer
  })

  const events: any[] = all?.events?.Events ?? []
  const teamKills = { ORDER: 0, CHAOS: 0 }
  const dragons: { ORDER: string[]; CHAOS: string[] } = { ORDER: [], CHAOS: [] }
  let lastDragon: { t: number; elder: boolean } | null = null
  let lastBaron: number | null = null
  const inhibs = new Map<string, { t: number; owner: 'ORDER' | 'CHAOS'; lane: string }>()

  for (const e of events) {
    const t = Number(e.EventTime ?? 0)
    const killerTeam = teamByName.get(String(e.KillerName ?? ''))
    switch (e.EventName) {
      case 'ChampionKill': {
        const victimTeam = teamByName.get(String(e.VictimName ?? ''))
        if (victimTeam) teamKills[victimTeam === 'ORDER' ? 'CHAOS' : 'ORDER']++
        break
      }
      case 'DragonKill': {
        const elder = String(e.DragonType) === 'Elder'
        if (killerTeam && !elder) dragons[killerTeam].push(String(e.DragonType ?? 'Dragon'))
        lastDragon = { t, elder }
        break
      }
      case 'BaronKill':
        lastBaron = t
        break
      case 'InhibKilled': {
        const id = String(e.InhibKilled ?? '')
        const m = id.match(/T(\d)_([LCR])/)
        if (m) inhibs.set(id, { t, owner: m[1] === '1' ? 'ORDER' : 'CHAOS', lane: LANE_NAMES[m[2]] ?? m[2] })
        break
      }
      case 'InhibRespawned':
        inhibs.delete(String(e.InhibRespawned ?? ''))
        break
    }
  }

  const timers: LiveObjectiveTimer[] = []
  const soul = dragons.ORDER.length >= 4 || dragons.CHAOS.length >= 4
  if (!lastDragon) {
    timers.push({ key: 'dragon', label: 'Dragon', respawnAt: OBJECTIVE_TIMERS.dragonFirst })
  } else {
    const elderNext = soul || lastDragon.elder
    timers.push({
      key: elderNext ? 'elder' : 'dragon',
      label: elderNext ? 'Elder' : 'Dragon',
      respawnAt: lastDragon.t + (elderNext ? OBJECTIVE_TIMERS.elderRespawn : OBJECTIVE_TIMERS.dragonRespawn)
    })
  }
  if (lastBaron != null) {
    timers.push({ key: 'baron', label: 'Baron', respawnAt: lastBaron + OBJECTIVE_TIMERS.baronRespawn })
  }
  for (const [id, inh] of inhibs) {
    const respawnAt = inh.t + OBJECTIVE_TIMERS.inhibitorRespawn
    if (respawnAt > gameTime) {
      timers.push({ key: `inhib-${id}`, label: `Inhib ${inh.lane}`, team: inh.owner, respawnAt })
    }
  }

  const meP = players.find((p) => p.isMe)
  return {
    active: true,
    gameTime,
    gameMode: String(all?.gameData?.gameMode ?? ''),
    me: meP
      ? {
          name: meP.name,
          championName: meP.championName,
          level: Number(active.level ?? meP.level),
          currentGold: Math.floor(Number(active.currentGold ?? 0)),
          cs: meP.cs,
          kills: meP.kills,
          deaths: meP.deaths,
          assists: meP.assists,
          team: meP.team
        }
      : undefined,
    players,
    timers,
    teamKills,
    dragons
  }
}
