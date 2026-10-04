import { describe, expect, it } from 'vitest'
import { absoluteLp, rankFromAbsolute } from '@shared/constants'
import { generateDemoProfileData } from '@shared/demo'
import { buildLiveState } from '@shared/live'
import {
  currentStreak,
  filterForAnalysis,
  gamesToClimb,
  lpDeltaByMatch,
  mainRole,
  maxOrder,
  requiredWinrate,
  sessions,
  skillProfile
} from '@/lib/analytics'
import { analyze, estimateTier } from '@/lib/coach'
import { benchmark, formatMetric, metricScore } from '@/lib/metrics'

const demo = generateDemoProfileData(Date.UTC(2026, 9, 4, 20))

describe('rank math', () => {
  it('maps ranks onto a linear ladder and back', () => {
    expect(absoluteLp('IRON', 'IV', 0)).toBe(0)
    expect(absoluteLp('GOLD', 'II', 50)).toBe(3 * 400 + 2 * 100 + 50)
    expect(absoluteLp('MASTER', 'I', 120)).toBe(2920)
    expect(absoluteLp('CHALLENGER', 'I', 900)).toBe(3700)
    expect(rankFromAbsolute(absoluteLp('DIAMOND', 'III', 41))).toEqual({ tier: 'DIAMOND', division: 'III', lp: 41 })
  })

  it('plans the climb', () => {
    // 55% WR, +25/-20: expected LP per game = 13.75-9 = 4.75
    expect(gamesToClimb(475, 0.55, 25, 20)).toBe(100)
    expect(gamesToClimb(100, 0.4, 20, 20)).toBeNull()
    expect(requiredWinrate(0, 100, 20, 20)).toBeCloseTo(0.5)
  })
})

describe('demo data analytics', () => {
  const solo = filterForAnalysis(demo.matches, 'solo')

  it('produces a consistent dataset', () => {
    expect(demo.matches.length).toBeGreaterThan(100)
    expect(solo.every((m) => m.queueId === 420)).toBe(true)
    for (const m of demo.matches.slice(0, 20)) {
      const mine = m.participants.filter((p) => p.teamId === m.me.teamId).reduce((a, p) => a + p.kills, 0)
      expect(m.teamStats.myTeam.kills).toBe(mine)
      expect(m.participants).toHaveLength(10)
    }
  })

  it('detects the main role and builds a skill profile', () => {
    expect(mainRole(solo)).toBe('MIDDLE')
    const profile = skillProfile(solo.slice(0, 30), 'MIDDLE', 'CHALLENGER')
    for (const v of Object.values(profile)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('creates coaching insights and a tier estimate', () => {
    const insights = analyze(solo.slice(0, 30), 'MIDDLE', 'CHALLENGER')
    expect(insights.length).toBeGreaterThan(0)
    expect(insights.some((i) => i.kind === 'weakness')).toBe(true)
    // sorted by severity first
    for (let i = 1; i < insights.length; i++) expect(insights[i - 1].severity).toBeGreaterThanOrEqual(insights[i].severity)
    expect(estimateTier(solo.slice(0, 30), 'MIDDLE')).not.toBeNull()
  })

  it('attributes LP changes to games', () => {
    const deltas = lpDeltaByMatch(demo.matches, demo.rankHistory)
    expect(deltas.size).toBeGreaterThan(50)
    for (const [id, d] of deltas) {
      const m = demo.matches.find((x) => x.matchId === id)!
      // a loss at 0 LP can be shielded from demotion, so 0 is allowed for losses
      expect(m.win ? d > 0 : d <= 0).toBe(true)
    }
  })

  it('splits sessions and streaks', () => {
    const s = sessions(demo.matches)
    expect(s.length).toBeGreaterThan(10)
    expect(s.reduce((a, x) => a + x.matches.length, 0)).toBe(demo.matches.length)
    const streak = currentStreak(demo.matches)
    expect(streak.count).toBeGreaterThan(0)
  })
})

describe('metrics', () => {
  it('scores relative to benchmarks', () => {
    const b = benchmark('csPerMin', 'MIDDLE', 'CHALLENGER')!
    expect(metricScore('csPerMin', b, 'MIDDLE', 'CHALLENGER')).toBeCloseTo(80)
    expect(metricScore('deaths', 2, 'MIDDLE', 'CHALLENGER')!).toBeGreaterThan(metricScore('deaths', 6, 'MIDDLE', 'CHALLENGER')!)
    expect(benchmark('csPerMin', 'MIDDLE', 'GOLD')!).toBeLessThan(b)
    expect(benchmark('deaths', 'MIDDLE', 'GOLD')!).toBeGreaterThan(benchmark('deaths', 'MIDDLE', 'CHALLENGER')!)
  })

  it('formats values with a left-to-right isolate', () => {
    expect(formatMetric('signed', 12)).toBe('⁦+12⁩')
    expect(formatMetric('pct', 0.537)).toBe('⁦54%⁩')
    expect(formatMetric('min', 10.5)).toBe('⁦10:30⁩')
    expect(formatMetric('int', null)).toBe('—')
  })

  it('derives the skill max order', () => {
    expect(maxOrder('QWEQQRQWQWRWWEEREE')).toBe('Q > W > E')
    expect(maxOrder('EQWEERQEQERQQWWRWW')).toBe('E > Q > W')
  })
})

describe('live client state', () => {
  it('computes objective timers from events', () => {
    const state = buildLiveState({
      gameData: { gameTime: 700, gameMode: 'CLASSIC' },
      activePlayer: { riotId: 'Me#EUW', level: 9, currentGold: 812.4 },
      allPlayers: [
        { riotId: 'Me#EUW', rawChampionName: 'game_character_displayname_Ahri', championName: 'Ahri', team: 'ORDER', level: 9, scores: { kills: 2, deaths: 1, assists: 3, creepScore: 88 }, items: [] },
        { riotId: 'Foe#EUW', championName: 'Zed', team: 'CHAOS', level: 8, scores: { kills: 1, deaths: 2, assists: 0, creepScore: 70 }, items: [] }
      ],
      events: {
        Events: [
          { EventName: 'ChampionKill', EventTime: 200, KillerName: 'Me#EUW', VictimName: 'Foe#EUW' },
          { EventName: 'DragonKill', EventTime: 400, KillerName: 'Me#EUW', DragonType: 'Fire' },
          { EventName: 'InhibKilled', EventTime: 650, KillerName: 'Me#EUW', InhibKilled: 'Barracks_T2_C1' }
        ]
      }
    })
    expect(state.me?.championName).toBe('Ahri')
    expect(state.me?.currentGold).toBe(812)
    expect(state.teamKills.ORDER).toBe(1)
    expect(state.dragons.ORDER).toEqual(['Fire'])
    expect(state.timers.find((t) => t.key === 'dragon')?.respawnAt).toBe(700)
    const inhib = state.timers.find((t) => t.key.startsWith('inhib'))
    expect(inhib?.respawnAt).toBe(950)
    expect(inhib?.team).toBe('CHAOS')
  })
})
