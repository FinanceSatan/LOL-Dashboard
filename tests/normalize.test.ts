import { describe, expect, it } from 'vitest'
import { normalizeMatchV4, normalizeMatchV5 } from '@shared/normalize'
import { ME, makeMatchV5, makeTimeline } from './fixtures'

describe('normalizeMatchV5', () => {
  it('returns null when the player is not in the match', () => {
    expect(normalizeMatchV5(makeMatchV5(), null, 'someone-else')).toBeNull()
  })

  it('computes per-minute stats, shares and lane opponent', () => {
    const s = normalizeMatchV5(makeMatchV5(), makeTimeline(), ME)!
    expect(s.matchId).toBe('EUW1_123')
    expect(s.win).toBe(true)
    expect(s.side).toBe('blue')
    expect(s.me.role).toBe('MIDDLE')
    expect(s.me.cs).toBe(210)
    expect(s.me.csPerMin).toBeCloseTo(7, 5)
    // team kills = 6 + 4*2 = 14 → KP = (6+4)/14
    expect(s.me.killParticipation).toBeCloseTo(10 / 14, 5)
    // damage share = 30000 / (30000 + 4*15000)
    expect(s.me.damageShare).toBeCloseTo(30000 / 90000, 5)
    expect(s.opponent?.puuid).toBe('p7')
    expect(s.me.runes?.perks).toEqual([8112, 8143, 8140, 8106, 8226, 8210])
    expect(s.me.runes?.statPerks).toEqual([5008, 5008, 5011])
    expect(s.me.soloKills).toBe(2)
    expect(s.me.objectiveTakedowns).toBe(3)
    expect(s.bans).toHaveLength(2)
    expect(s.teamStats.myTeam.dragons).toBe(3)
    expect(s.remake).toBe(false)
  })

  it('derives laning stats and events from the timeline', () => {
    const s = normalizeMatchV5(makeMatchV5(), makeTimeline(), ME)!
    expect(s.laning?.csAt10).toBe(80)
    expect(s.laning?.csDiffAt10).toBe(10)
    expect(s.laning?.goldDiffAt15).toBe(15 * 20)
    expect(s.laning?.deathsBefore10).toBe(1)
    expect(s.laning?.deathsBefore14).toBe(2)
    expect(s.laning?.killsBefore14).toBe(1)
    // dying for first blood is not "involvement" (kill or assist)
    expect(s.laning?.firstBloodInvolved).toBe(false)
    expect(s.deaths).toHaveLength(2)
    expect(s.kills).toEqual([{ t: 370, x: 7000, y: 7000 }])
    expect(s.me.skillOrder).toBe('QE')
    expect(s.me.itemPurchases).toEqual([{ t: 10, id: 1056 }])
    expect(s.objectives).toContainEqual({ t: 330, type: 'DRAGON', subType: 'FIRE_DRAGON', team: 100 })
    // tower owned by team 200 destroyed → secured by team 100
    expect(s.objectives).toContainEqual({ t: 1200, type: 'TOWER', team: 100 })
    expect(s.timeline[15].teamGoldDiff).toBe(5 * 15 * 20)
  })

  it('flags remakes', () => {
    expect(normalizeMatchV5(makeMatchV5({ duration: 200 }), null, ME)!.remake).toBe(true)
    expect(normalizeMatchV5(makeMatchV5({ earlySurrender: true }), null, ME)!.remake).toBe(true)
  })
})

describe('normalizeMatchV4 (League client)', () => {
  it('maps the client match-history format', () => {
    const v5 = makeMatchV5({ win: false })
    const game = {
      gameId: 999,
      platformId: 'euw1',
      gameCreation: 1_700_000_000_000,
      gameDuration: 1500,
      gameVersion: '15.19',
      queueId: 420,
      participants: v5.info.participants.map((p: any) => ({
        participantId: p.participantId,
        teamId: p.teamId,
        championId: p.championId,
        spell1Id: 4,
        spell2Id: 14,
        timeline: { lane: p.teamPosition === 'UTILITY' ? 'BOTTOM' : p.teamPosition, role: p.teamPosition === 'UTILITY' ? 'DUO_SUPPORT' : 'SOLO' },
        stats: {
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          totalMinionsKilled: p.totalMinionsKilled,
          neutralMinionsKilled: p.neutralMinionsKilled,
          goldEarned: p.goldEarned,
          totalDamageDealtToChampions: p.totalDamageDealtToChampions,
          perk0: 8112, perk1: 8143, perk2: 8140, perk3: 8106, perk4: 8226, perk5: 8210,
          perkPrimaryStyle: 8100,
          perkSubStyle: 8200
        }
      })),
      participantIdentities: v5.info.participants.map((p: any) => ({
        participantId: p.participantId,
        player: { puuid: p.puuid, gameName: p.riotIdGameName, tagLine: 'EUW' }
      })),
      teams: [
        { teamId: 100, win: 'Fail', dragonKills: 1, towerKills: 2 },
        { teamId: 200, win: 'Win', dragonKills: 4, towerKills: 9 }
      ]
    }
    const s = normalizeMatchV4(game, null, ME)!
    expect(s.matchId).toBe('EUW1_999')
    expect(s.win).toBe(false)
    expect(s.me.role).toBe('MIDDLE')
    expect(s.participants.find((p) => p.puuid === 'p4')?.role).toBe('UTILITY')
    expect(s.me.runes?.primaryStyle).toBe(8100)
    expect(s.teamStats.enemyTeam.dragons).toBe(4)
    expect(s.source).toBe('client')
  })
})
