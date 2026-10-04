/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal Riot match-v5 / timeline payloads used by the tests.
export const ME = 'puuid-me'
const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export function makeMatchV5(opts: { win?: boolean; duration?: number; earlySurrender?: boolean } = {}): any {
  const win = opts.win ?? true
  const participants = Array.from({ length: 10 }, (_, i) => {
    const team = i < 5 ? 100 : 200
    const isMe = i === 2
    return {
      participantId: i + 1,
      puuid: isMe ? ME : `p${i}`,
      riotIdGameName: isMe ? 'Me' : `Player${i}`,
      riotIdTagline: 'EUW',
      championId: 100 + i,
      championName: `Champ${i}`,
      teamId: team,
      teamPosition: roles[i % 5],
      kills: isMe ? 6 : 2,
      deaths: isMe ? 2 : 3,
      assists: isMe ? 4 : 5,
      totalMinionsKilled: isMe ? 200 : 150,
      neutralMinionsKilled: isMe ? 10 : 0,
      goldEarned: 10000,
      totalDamageDealtToChampions: isMe ? 30000 : 15000,
      totalDamageTaken: 20000,
      visionScore: 30,
      wardsPlaced: 10,
      wardsKilled: 2,
      visionWardsBoughtInGame: 2,
      champLevel: 16,
      item0: 6655, item1: 3020, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
      summoner1Id: 4,
      summoner2Id: 14,
      perks: {
        statPerks: { offense: 5008, flex: 5008, defense: 5011 },
        styles: [
          { description: 'primaryStyle', style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8140 }, { perk: 8106 }] },
          { description: 'subStyle', style: 8200, selections: [{ perk: 8226 }, { perk: 8210 }] }
        ]
      },
      win: team === 100 ? win : !win,
      gameEndedInEarlySurrender: Boolean(opts.earlySurrender),
      challenges: { soloKills: 2, skillshotsHit: 50, skillshotsDodged: 20, dragonTakedowns: 2, baronTakedowns: 1 }
    }
  })
  return {
    metadata: { matchId: 'EUW1_123', participants: participants.map((p) => p.puuid) },
    info: {
      gameId: 123,
      platformId: 'EUW1',
      queueId: 420,
      gameStartTimestamp: 1_700_000_000_000,
      gameEndTimestamp: 1_700_001_800_000,
      gameDuration: opts.duration ?? 1800,
      gameVersion: '15.19.1.1',
      participants,
      teams: [
        { teamId: 100, win, bans: [{ championId: 1 }], objectives: { dragon: { kills: 3, first: true }, baron: { kills: 1, first: true }, tower: { kills: 8, first: true }, champion: { kills: 14, first: true } } },
        { teamId: 200, win: !win, bans: [{ championId: 2 }], objectives: { dragon: { kills: 1, first: false }, tower: { kills: 3, first: false } } }
      ]
    }
  }
}

export function makeTimeline(): any {
  const frames = Array.from({ length: 31 }, (_, m) => {
    const participantFrames: Record<string, any> = {}
    for (let pid = 1; pid <= 10; pid++) {
      participantFrames[String(pid)] = {
        participantId: pid,
        totalGold: 500 + m * (pid <= 5 ? 420 : 400),
        xp: m * 400,
        // me = pid 3, my lane opponent = pid 8
        minionsKilled: pid === 3 ? m * 8 : m * 7,
        jungleMinionsKilled: 0,
        position: { x: 0, y: 0 }
      }
    }
    return { timestamp: m * 60000, participantFrames, events: [] as any[] }
  })
  frames[3].events.push({ type: 'CHAMPION_KILL', timestamp: 190000, killerId: 8, victimId: 3, assistingParticipantIds: [7], position: { x: 9000, y: 9000 } })
  frames[6].events.push({ type: 'CHAMPION_KILL', timestamp: 370000, killerId: 3, victimId: 8, assistingParticipantIds: [], position: { x: 7000, y: 7000 } })
  frames[12].events.push({ type: 'CHAMPION_KILL', timestamp: 720000, killerId: 9, victimId: 3, position: { x: 3000, y: 3000 } })
  frames[6].events.push({ type: 'ELITE_MONSTER_KILL', timestamp: 330000, killerTeamId: 100, monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON' })
  frames[20].events.push({ type: 'BUILDING_KILL', timestamp: 1200000, teamId: 200, buildingType: 'TOWER_BUILDING' })
  frames[1].events.push(
    { type: 'SKILL_LEVEL_UP', timestamp: 70000, participantId: 3, skillSlot: 1, levelUpType: 'NORMAL' },
    { type: 'SKILL_LEVEL_UP', timestamp: 80000, participantId: 3, skillSlot: 3, levelUpType: 'NORMAL' },
    { type: 'SKILL_LEVEL_UP', timestamp: 81000, participantId: 4, skillSlot: 2, levelUpType: 'NORMAL' },
    { type: 'ITEM_PURCHASED', timestamp: 10000, participantId: 3, itemId: 1056 },
    { type: 'ITEM_PURCHASED', timestamp: 11000, participantId: 3, itemId: 2003 },
    { type: 'ITEM_UNDO', timestamp: 12000, participantId: 3, beforeId: 2003, afterId: 0 }
  )
  return { info: { frames } }
}
