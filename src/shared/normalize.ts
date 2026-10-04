// Converts raw match payloads (Riot match-v5 + timeline, or the League client's
// match-history format) into the compact MatchSummary the dashboard works with.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  LaningStats,
  MapEvent,
  MatchSummary,
  MyStats,
  ObjectiveEvent,
  PlayerLine,
  Role,
  RunePage,
  TeamObjectives,
  TimelinePoint
} from './types'

interface RawPlayer {
  pid: number // participantId (1..10)
  line: PlayerLine
  ext: Partial<MyStats> & { totalTimeSpentDead?: number; ch?: any }
}

interface RawTeam {
  teamId: 100 | 200
  win: boolean
  dragons: number
  barons: number
  heralds: number
  hordes: number
  towers: number
  inhibitors: number
  firstDragon: boolean
  firstTower: boolean
  firstBlood: boolean
  bans: number[]
}

const num = (v: any, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const optNum = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function normRole(v: any): Role | '' {
  const s = String(v ?? '').toUpperCase()
  if (s === 'TOP' || s === 'JUNGLE' || s === 'MIDDLE' || s === 'BOTTOM' || s === 'UTILITY') return s
  if (s === 'MID') return 'MIDDLE'
  if (s === 'SUPPORT') return 'UTILITY'
  if (s === 'ADC' || s === 'BOT') return 'BOTTOM'
  return ''
}

function runesFromV5(perks: any): RunePage | null {
  const styles = perks?.styles
  if (!Array.isArray(styles) || styles.length < 2) return null
  const primary = styles.find((s: any) => s.description === 'primaryStyle') ?? styles[0]
  const sub = styles.find((s: any) => s.description === 'subStyle') ?? styles[1]
  return {
    primaryStyle: num(primary.style),
    subStyle: num(sub.style),
    perks: [...(primary.selections ?? []), ...(sub.selections ?? [])].map((s: any) => num(s.perk)),
    statPerks: [num(perks.statPerks?.offense), num(perks.statPerks?.flex), num(perks.statPerks?.defense)]
  }
}

// ---------------------------------------------------------------------------
// Match-v5
// ---------------------------------------------------------------------------

export function normalizeMatchV5(match: any, timeline: any | null, puuid: string): MatchSummary | null {
  const info = match?.info
  if (!info || !Array.isArray(info.participants)) return null
  const parts: any[] = info.participants
  if (!parts.some((p) => p.puuid === puuid)) return null

  let duration = num(info.gameDuration)
  if (!info.gameEndTimestamp && duration > 30000) duration = Math.round(duration / 1000)

  const players: RawPlayer[] = parts.map((p, i) => {
    const ch = p.challenges ?? {}
    const name = p.riotIdGameName
      ? `${p.riotIdGameName}#${p.riotIdTagline ?? ''}`
      : String(p.summonerName ?? 'Unknown')
    const runes = runesFromV5(p.perks)
    const line: PlayerLine = {
      puuid: String(p.puuid ?? ''),
      name,
      championId: num(p.championId),
      championName: String(p.championName ?? ''),
      teamId: p.teamId === 200 ? 200 : 100,
      role: normRole(p.teamPosition) || normRole(p.individualPosition),
      kills: num(p.kills),
      deaths: num(p.deaths),
      assists: num(p.assists),
      cs: num(p.totalMinionsKilled) + num(p.neutralMinionsKilled),
      gold: num(p.goldEarned),
      damage: num(p.totalDamageDealtToChampions),
      damageTaken: num(p.totalDamageTaken),
      visionScore: num(p.visionScore),
      wardsPlaced: num(p.wardsPlaced),
      wardsKilled: num(p.wardsKilled),
      controlWards: num(p.visionWardsBoughtInGame, num(ch.controlWardsPlaced)),
      level: num(p.champLevel),
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((x) => num(x)),
      spells: [num(p.summoner1Id), num(p.summoner2Id)],
      keystone: runes?.perks[0] ?? 0,
      primaryStyle: runes?.primaryStyle ?? 0,
      subStyle: runes?.subStyle ?? 0,
      win: Boolean(p.win)
    }
    return {
      pid: num(p.participantId, i + 1),
      line,
      ext: {
        runes,
        timeDead: num(p.totalTimeSpentDead),
        soloKills: optNum(ch.soloKills),
        skillshotsHit: optNum(ch.skillshotsHit),
        skillshotsDodged: optNum(ch.skillshotsDodged),
        turretPlates: optNum(ch.turretPlatesTaken),
        damageToObjectives: num(p.damageDealtToObjectives),
        damageToBuildings: num(p.damageDealtToBuildings),
        objectiveTakedowns:
          num(ch.dragonTakedowns) + num(ch.baronTakedowns) + num(ch.riftHeraldTakedowns),
        largestMultiKill: num(p.largestMultiKill),
        firstBloodKill: Boolean(p.firstBloodKill),
        firstTowerKill: Boolean(p.firstTowerKill || p.firstTowerAssist),
        ch
      }
    }
  })

  const teams: RawTeam[] = (info.teams ?? []).map((t: any) => ({
    teamId: t.teamId === 200 ? 200 : 100,
    win: Boolean(t.win),
    dragons: num(t.objectives?.dragon?.kills),
    barons: num(t.objectives?.baron?.kills),
    heralds: num(t.objectives?.riftHerald?.kills),
    hordes: num(t.objectives?.horde?.kills),
    towers: num(t.objectives?.tower?.kills),
    inhibitors: num(t.objectives?.inhibitor?.kills),
    firstDragon: Boolean(t.objectives?.dragon?.first),
    firstTower: Boolean(t.objectives?.tower?.first),
    firstBlood: Boolean(t.objectives?.champion?.first),
    bans: (t.bans ?? []).map((b: any) => num(b.championId)).filter((c: number) => c > 0)
  }))

  const remake =
    parts.some((p) => p.gameEndedInEarlySurrender) || (duration > 0 && duration < 300)
  const surrender = parts.some((p) => p.gameEndedInSurrender)

  const frames = timeline?.info?.frames ?? null
  return buildSummary({
    matchId: String(match.metadata?.matchId ?? `${info.platformId}_${info.gameId}`),
    platform: String(info.platformId ?? ''),
    queueId: num(info.queueId),
    gameCreation: num(info.gameStartTimestamp, num(info.gameCreation)),
    gameDuration: duration,
    gameVersion: String(info.gameVersion ?? ''),
    remake,
    surrender,
    players,
    teams,
    puuid,
    frames,
    source: 'riot'
  })
}

// ---------------------------------------------------------------------------
// League client match history (match-v4 like payloads)
// ---------------------------------------------------------------------------

function roleFromV4(timeline: any): Role | '' {
  const lane = String(timeline?.lane ?? '').toUpperCase()
  const role = String(timeline?.role ?? '').toUpperCase()
  if (lane === 'TOP') return 'TOP'
  if (lane === 'JUNGLE') return 'JUNGLE'
  if (lane === 'MIDDLE' || lane === 'MID') return 'MIDDLE'
  if (lane === 'BOTTOM' || lane === 'BOT') return role === 'DUO_SUPPORT' ? 'UTILITY' : 'BOTTOM'
  return ''
}

export function normalizeMatchV4(game: any, timeline: any | null, puuid: string): MatchSummary | null {
  if (!game || !Array.isArray(game.participants)) return null
  const identities: any[] = game.participantIdentities ?? []
  const idOf = (pid: number) => identities.find((x) => x.participantId === pid)?.player ?? {}
  const parts: any[] = game.participants
  if (!parts.some((p) => idOf(p.participantId).puuid === puuid)) return null

  const players: RawPlayer[] = parts.map((p) => {
    const s = p.stats ?? {}
    const pl = idOf(p.participantId)
    const name = pl.gameName ? `${pl.gameName}#${pl.tagLine ?? ''}` : String(pl.summonerName ?? 'Unknown')
    const perks = [s.perk0, s.perk1, s.perk2, s.perk3, s.perk4, s.perk5].map((x: any) => num(x))
    const runes: RunePage | null = perks[0]
      ? {
          primaryStyle: num(s.perkPrimaryStyle),
          subStyle: num(s.perkSubStyle),
          perks,
          statPerks: [num(s.statPerk0), num(s.statPerk1), num(s.statPerk2)]
        }
      : null
    const line: PlayerLine = {
      puuid: String(pl.puuid ?? ''),
      name,
      championId: num(p.championId),
      championName: '',
      teamId: p.teamId === 200 ? 200 : 100,
      role: normRole(p.teamPosition) || roleFromV4(p.timeline),
      kills: num(s.kills),
      deaths: num(s.deaths),
      assists: num(s.assists),
      cs: num(s.totalMinionsKilled) + num(s.neutralMinionsKilled),
      gold: num(s.goldEarned),
      damage: num(s.totalDamageDealtToChampions),
      damageTaken: num(s.totalDamageTaken),
      visionScore: num(s.visionScore),
      wardsPlaced: num(s.wardsPlaced),
      wardsKilled: num(s.wardsKilled),
      controlWards: num(s.visionWardsBoughtInGame),
      level: num(s.champLevel),
      items: [s.item0, s.item1, s.item2, s.item3, s.item4, s.item5, s.item6].map((x: any) => num(x)),
      spells: [num(p.spell1Id), num(p.spell2Id)],
      keystone: perks[0] ?? 0,
      primaryStyle: runes?.primaryStyle ?? 0,
      subStyle: runes?.subStyle ?? 0,
      win: Boolean(s.win)
    }
    return {
      pid: num(p.participantId),
      line,
      ext: {
        runes,
        timeDead: num(s.totalTimeSpentDead),
        soloKills: null,
        skillshotsHit: null,
        skillshotsDodged: null,
        turretPlates: null,
        damageToObjectives: num(s.damageDealtToObjectives),
        damageToBuildings: num(s.damageDealtToTurrets),
        objectiveTakedowns: 0,
        largestMultiKill: num(s.largestMultiKill),
        firstBloodKill: Boolean(s.firstBloodKill),
        firstTowerKill: Boolean(s.firstTowerKill || s.firstTowerAssist)
      }
    }
  })

  const teams: RawTeam[] = (game.teams ?? []).map((t: any) => ({
    teamId: t.teamId === 200 ? 200 : 100,
    win: t.win === 'Win' || t.win === true,
    dragons: num(t.dragonKills),
    barons: num(t.baronKills),
    heralds: num(t.riftHeraldKills),
    hordes: num(t.hordeKills),
    towers: num(t.towerKills),
    inhibitors: num(t.inhibitorKills),
    firstDragon: Boolean(t.firstDargon ?? t.firstDragon),
    firstTower: Boolean(t.firstTower),
    firstBlood: Boolean(t.firstBlood),
    bans: (t.bans ?? []).map((b: any) => num(b.championId)).filter((c: number) => c > 0)
  }))

  let duration = num(game.gameDuration)
  if (duration > 30000) duration = Math.round(duration / 1000)
  const platform = String(game.platformId ?? '').toUpperCase()

  return buildSummary({
    matchId: `${platform}_${game.gameId}`,
    platform,
    queueId: num(game.queueId),
    gameCreation: num(game.gameCreation),
    gameDuration: duration,
    gameVersion: String(game.gameVersion ?? ''),
    remake: duration > 0 && duration < 300,
    surrender: false,
    players,
    teams,
    puuid,
    frames: timeline?.frames ?? null,
    source: 'client'
  })
}

// ---------------------------------------------------------------------------
// Shared builder
// ---------------------------------------------------------------------------

interface BuildInput {
  matchId: string
  platform: string
  queueId: number
  gameCreation: number
  gameDuration: number
  gameVersion: string
  remake: boolean
  surrender: boolean
  players: RawPlayer[]
  teams: RawTeam[]
  puuid: string
  frames: any[] | null
  source: 'riot' | 'client'
}

function teamObjectives(t: RawTeam | undefined, kills: number): TeamObjectives {
  return {
    kills,
    dragons: t?.dragons ?? 0,
    barons: t?.barons ?? 0,
    heralds: t?.heralds ?? 0,
    hordes: t?.hordes ?? 0,
    towers: t?.towers ?? 0,
    inhibitors: t?.inhibitors ?? 0,
    firstDragon: t?.firstDragon ?? false,
    firstTower: t?.firstTower ?? false,
    firstBlood: t?.firstBlood ?? false
  }
}

function buildSummary(input: BuildInput): MatchSummary | null {
  const { players, teams, puuid, gameDuration } = input
  const meRaw = players.find((p) => p.line.puuid === puuid)
  if (!meRaw) return null
  const myTeam = meRaw.line.teamId
  const minutes = Math.max(gameDuration / 60, 1)

  const teamSum = (teamId: number, f: (l: PlayerLine) => number) =>
    players.filter((p) => p.line.teamId === teamId).reduce((a, p) => a + f(p.line), 0)
  const teamKills = teamSum(myTeam, (l) => l.kills)
  const teamDamage = teamSum(myTeam, (l) => l.damage)
  const teamGold = teamSum(myTeam, (l) => l.gold)
  const enemyTeam = myTeam === 100 ? 200 : 100
  const enemyKills = teamSum(enemyTeam, (l) => l.kills)

  const meLine = meRaw.line
  const oppRaw = meLine.role
    ? players.find((p) => p.line.teamId !== myTeam && p.line.role === meLine.role) ?? null
    : null

  const ch = meRaw.ext.ch ?? {}
  const kda = (meLine.kills + meLine.assists) / Math.max(1, meLine.deaths)
  const me: MyStats = {
    ...meLine,
    killParticipation:
      typeof ch.killParticipation === 'number'
        ? ch.killParticipation
        : teamKills > 0
          ? (meLine.kills + meLine.assists) / teamKills
          : 0,
    damageShare:
      typeof ch.teamDamagePercentage === 'number'
        ? ch.teamDamagePercentage
        : teamDamage > 0
          ? meLine.damage / teamDamage
          : 0,
    goldShare: teamGold > 0 ? meLine.gold / teamGold : 0,
    csPerMin: meLine.cs / minutes,
    goldPerMin: meLine.gold / minutes,
    dpm: meLine.damage / minutes,
    visionPerMin: meLine.visionScore / minutes,
    kda,
    timeDead: meRaw.ext.timeDead ?? 0,
    soloKills: meRaw.ext.soloKills ?? null,
    skillshotsHit: meRaw.ext.skillshotsHit ?? null,
    skillshotsDodged: meRaw.ext.skillshotsDodged ?? null,
    turretPlates: meRaw.ext.turretPlates ?? null,
    damageToObjectives: meRaw.ext.damageToObjectives ?? 0,
    damageToBuildings: meRaw.ext.damageToBuildings ?? 0,
    objectiveTakedowns: meRaw.ext.objectiveTakedowns ?? 0,
    largestMultiKill: meRaw.ext.largestMultiKill ?? 0,
    firstBloodKill: meRaw.ext.firstBloodKill ?? false,
    firstTowerKill: meRaw.ext.firstTowerKill ?? false,
    runes: meRaw.ext.runes ?? null,
    skillOrder: '',
    itemPurchases: []
  }

  const myT = teams.find((t) => t.teamId === myTeam)
  const enT = teams.find((t) => t.teamId === enemyTeam)
  const summary: MatchSummary = {
    matchId: input.matchId,
    platform: input.platform,
    queueId: input.queueId,
    gameCreation: input.gameCreation,
    gameDuration,
    gameVersion: input.gameVersion,
    remake: input.remake,
    surrender: input.surrender,
    win: meLine.win,
    side: myTeam === 100 ? 'blue' : 'red',
    me,
    opponent: oppRaw?.line ?? null,
    participants: players.map((p) => p.line),
    bans: teams.flatMap((t) => t.bans.map((c) => ({ teamId: t.teamId, championId: c }))),
    laning: null,
    timeline: [],
    deaths: [],
    kills: [],
    objectives: [],
    teamStats: {
      myTeam: teamObjectives(myT, teamKills),
      enemyTeam: teamObjectives(enT, enemyKills)
    },
    source: input.source
  }

  if (input.frames && input.frames.length > 1) {
    applyTimeline(summary, input.frames, players, meRaw.pid, oppRaw?.pid ?? null)
  } else if (typeof ch.laneMinionsFirst10Minutes === 'number') {
    // No timeline: fall back on what the challenges block gives us.
    const cs10 = num(ch.laneMinionsFirst10Minutes) + num(ch.jungleCsBefore10Minutes)
    summary.laning = {
      csAt10: cs10,
      csAt15: 0,
      goldAt10: 0,
      goldAt15: 0,
      xpAt10: 0,
      xpAt15: 0,
      csDiffAt10: null,
      csDiffAt15: null,
      goldDiffAt10: null,
      goldDiffAt15: null,
      xpDiffAt10: null,
      xpDiffAt15: null,
      deathsBefore10: 0,
      deathsBefore14: 0,
      killsBefore14: 0,
      firstBloodInvolved: me.firstBloodKill
    }
  }
  return summary
}

function frameStat(frames: any[], minute: number, pid: number | null, f: (pf: any) => number): number {
  if (pid == null) return 0
  const frame = frames[Math.min(minute, frames.length - 1)]
  const pf = frame?.participantFrames?.[String(pid)] ?? frame?.participantFrames?.[pid]
  return pf ? f(pf) : 0
}

const csOf = (pf: any) => num(pf.minionsKilled) + num(pf.jungleMinionsKilled)
const goldOf = (pf: any) => num(pf.totalGold)
const xpOf = (pf: any) => num(pf.xp)

function applyTimeline(
  s: MatchSummary,
  frames: any[],
  players: RawPlayer[],
  myPid: number,
  oppPid: number | null
): void {
  const teamOfPid = new Map<number, 100 | 200>()
  for (const p of players) teamOfPid.set(p.pid, p.line.teamId)
  const myTeam = teamOfPid.get(myPid) ?? 100

  // Per-minute curves
  const points: TimelinePoint[] = []
  frames.forEach((frame, minute) => {
    const pfs = frame?.participantFrames ?? {}
    let mine = 0
    let theirs = 0
    for (const [k, pf] of Object.entries<any>(pfs)) {
      const pid = num(pf?.participantId, Number(k))
      if (teamOfPid.get(pid) === myTeam) mine += goldOf(pf)
      else theirs += goldOf(pf)
    }
    const me = pfs[String(myPid)] ?? pfs[myPid]
    const opp = oppPid != null ? pfs[String(oppPid)] ?? pfs[oppPid] : null
    points.push({
      minute,
      teamGoldDiff: mine - theirs,
      myGold: me ? goldOf(me) : 0,
      oppGold: opp ? goldOf(opp) : null,
      myCs: me ? csOf(me) : 0,
      oppCs: opp ? csOf(opp) : null,
      myXp: me ? xpOf(me) : 0
    })
  })
  s.timeline = points

  // Events
  const deaths: MapEvent[] = []
  const kills: MapEvent[] = []
  const objectives: ObjectiveEvent[] = []
  const skills: string[] = []
  const purchases: { t: number; id: number }[] = []
  let firstKillSeen = false
  let firstBloodInvolved = false
  let deathsBefore10 = 0
  let deathsBefore14 = 0
  let killsBefore14 = 0

  for (const frame of frames) {
    for (const e of frame?.events ?? []) {
      const t = Math.round(num(e.timestamp) / 1000)
      switch (e.type) {
        case 'CHAMPION_KILL': {
          const assists: number[] = e.assistingParticipantIds ?? []
          if (!firstKillSeen) {
            firstKillSeen = true
            firstBloodInvolved = e.killerId === myPid || assists.includes(myPid)
          }
          const pos = { t, x: num(e.position?.x), y: num(e.position?.y) }
          if (e.victimId === myPid) {
            deaths.push(pos)
            if (t < 600) deathsBefore10++
            if (t < 840) deathsBefore14++
          } else if (e.killerId === myPid) {
            kills.push(pos)
            if (t < 840) killsBefore14++
          }
          break
        }
        case 'ELITE_MONSTER_KILL': {
          const team: 100 | 200 =
            e.killerTeamId === 100 || e.killerTeamId === 200
              ? e.killerTeamId
              : teamOfPid.get(num(e.killerId)) ?? 100
          const mt = String(e.monsterType ?? '')
          const sub = String(e.monsterSubType ?? '')
          const type: ObjectiveEvent['type'] | null =
            mt === 'DRAGON'
              ? sub === 'ELDER_DRAGON'
                ? 'ELDER'
                : 'DRAGON'
              : mt === 'BARON_NASHOR'
                ? 'BARON'
                : mt === 'RIFTHERALD'
                  ? 'HERALD'
                  : mt === 'HORDE'
                    ? 'HORDE'
                    : mt === 'ATAKHAN'
                      ? 'ATAKHAN'
                      : null
          if (type) objectives.push({ t, type, subType: sub || undefined, team })
          break
        }
        case 'BUILDING_KILL': {
          // teamId is the owner of the destroyed building.
          const owner = e.teamId === 200 ? 200 : 100
          const type = e.buildingType === 'INHIBITOR_BUILDING' ? 'INHIBITOR' : 'TOWER'
          objectives.push({ t, type, team: owner === 100 ? 200 : 100 })
          break
        }
        case 'SKILL_LEVEL_UP': {
          if (e.participantId === myPid && (e.levelUpType ?? 'NORMAL') === 'NORMAL') {
            const slot = num(e.skillSlot)
            if (slot >= 1 && slot <= 4) skills.push('QWER'[slot - 1])
          }
          break
        }
        case 'ITEM_PURCHASED': {
          if (e.participantId === myPid) purchases.push({ t, id: num(e.itemId) })
          break
        }
        case 'ITEM_UNDO': {
          if (e.participantId === myPid && e.beforeId) {
            const idx = purchases.map((p) => p.id).lastIndexOf(num(e.beforeId))
            if (idx >= 0) purchases.splice(idx, 1)
          }
          break
        }
      }
    }
  }

  s.deaths = deaths
  s.kills = kills
  s.objectives = objectives
  s.me.skillOrder = skills.join('')
  s.me.itemPurchases = purchases

  const has = (m: number) => frames.length > m
  const diff = (m: number, f: (pf: any) => number): number | null =>
    oppPid != null && has(m) ? frameStat(frames, m, myPid, f) - frameStat(frames, m, oppPid, f) : null

  const laning: LaningStats = {
    csAt10: frameStat(frames, 10, myPid, csOf),
    csAt15: frameStat(frames, 15, myPid, csOf),
    goldAt10: frameStat(frames, 10, myPid, goldOf),
    goldAt15: frameStat(frames, 15, myPid, goldOf),
    xpAt10: frameStat(frames, 10, myPid, xpOf),
    xpAt15: frameStat(frames, 15, myPid, xpOf),
    csDiffAt10: diff(10, csOf),
    csDiffAt15: diff(15, csOf),
    goldDiffAt10: diff(10, goldOf),
    goldDiffAt15: diff(15, goldOf),
    xpDiffAt10: diff(10, xpOf),
    xpDiffAt15: diff(15, xpOf),
    deathsBefore10,
    deathsBefore14,
    killsBefore14,
    firstBloodInvolved
  }
  s.laning = laning
}
