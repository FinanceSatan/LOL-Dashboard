// Deterministic demo data so the whole dashboard can be explored without a Riot API key.
import { absoluteLp, rankFromAbsolute } from './constants'
import type {
  Account,
  ChampSelectState,
  Goal,
  JournalEntry,
  Leaderboard,
  LiveClientState,
  MapEvent,
  MatchSummary,
  MyStats,
  ObjectiveEvent,
  PlayerLine,
  ProfileData,
  RankEntry,
  RankSnapshot,
  Role,
  RunePage,
  ScoutResult,
  TimelinePoint
} from './types'

export const DEMO_PUUID = 'demo-puuid-0000'

export const DEMO_ACCOUNT: Account = {
  puuid: DEMO_PUUID,
  gameName: 'Rift Climber',
  tagLine: 'DEMO',
  platform: 'euw1',
  profileIconId: 5367,
  summonerLevel: 487,
  demo: true
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number

const gauss = (r: Rng, mean: number, sd: number) => {
  const u = Math.max(r(), 1e-9)
  const v = r()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const pick = <T,>(r: Rng, arr: T[]): T => arr[Math.floor(r() * arr.length)]
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface ChampDef {
  id: number
  name: string
  role: Role
  items: number[]
  skill: string
  page: RunePage
  spells: [number, number]
}

const PAGE_ELECTROCUTE: RunePage = {
  primaryStyle: 8100,
  subStyle: 8200,
  perks: [8112, 8143, 8140, 8106, 8226, 8210],
  statPerks: [5008, 5008, 5011]
}
const PAGE_COMET: RunePage = {
  primaryStyle: 8200,
  subStyle: 8300,
  perks: [8229, 8226, 8210, 8237, 8345, 8347],
  statPerks: [5008, 5008, 5011]
}
const PAGE_FLEET: RunePage = {
  primaryStyle: 8000,
  subStyle: 8400,
  perks: [8021, 9111, 9104, 8014, 8444, 8453],
  statPerks: [5005, 5008, 5011]
}
const PAGE_CONQ: RunePage = {
  primaryStyle: 8000,
  subStyle: 8400,
  perks: [8010, 9111, 9104, 8299, 8444, 8453],
  statPerks: [5005, 5008, 5011]
}

const MAGE_ITEMS = [6655, 3020, 4645, 3089, 3135, 3157, 3340]
const MY_POOL: ChampDef[] = [
  { id: 103, name: 'Ahri', role: 'MIDDLE', items: [6655, 3020, 4645, 3089, 3135, 3157, 3340], skill: 'QWEQQRQWQWRWWEEREE', page: PAGE_ELECTROCUTE, spells: [4, 14] },
  { id: 134, name: 'Syndra', role: 'MIDDLE', items: [6655, 3020, 4645, 3089, 3135, 3102, 3340], skill: 'QWEQQRQWQWRWWEEREE', page: PAGE_ELECTROCUTE, spells: [4, 12] },
  { id: 61, name: 'Orianna', role: 'MIDDLE', items: [6655, 3020, 6653, 3089, 3135, 3157, 3340], skill: 'QWEQQRQWQWRWWEEREE', page: PAGE_COMET, spells: [4, 12] },
  { id: 112, name: 'Viktor', role: 'MIDDLE', items: [6655, 3020, 4645, 3089, 3135, 3157, 3340], skill: 'EQWEERQEQERQQWWRWW', page: PAGE_COMET, spells: [4, 12] },
  { id: 268, name: 'Azir', role: 'MIDDLE', items: [3115, 3020, 4645, 3089, 3135, 3157, 3340], skill: 'WQEQQRQWQWRWWEEREE', page: PAGE_FLEET, spells: [4, 12] },
  { id: 517, name: 'Sylas', role: 'MIDDLE', items: [3152, 3020, 4645, 3089, 3157, 3135, 3340], skill: 'QWEQQRQWQWRWWEEREE', page: PAGE_CONQ, spells: [4, 14] },
  { id: 64, name: 'LeeSin', role: 'JUNGLE', items: [6692, 3158, 3071, 6333, 3053, 3026, 3364], skill: 'QWEQQRQWQWRWWEEREE', page: PAGE_CONQ, spells: [11, 4] },
  { id: 234, name: 'Viego', role: 'JUNGLE', items: [3153, 3006, 3078, 3071, 6333, 3053, 3364], skill: 'QWEQQRQEQEREEWWRWW', page: PAGE_CONQ, spells: [11, 4] }
]

const OTHER_CHAMPS: Record<Role, [number, string][]> = {
  TOP: [[122, 'Darius'], [58, 'Renekton'], [516, 'Ornn'], [126, 'Jayce'], [86, 'Garen'], [54, 'Malphite'], [24, 'Jax'], [266, 'Aatrox'], [887, 'Gwen'], [164, 'Camille']],
  JUNGLE: [[64, 'LeeSin'], [254, 'Vi'], [104, 'Graves'], [234, 'Viego'], [121, 'Khazix'], [141, 'Kayn'], [76, 'Nidalee'], [59, 'JarvanIV'], [32, 'Amumu'], [203, 'Kindred']],
  MIDDLE: [[238, 'Zed'], [7, 'Leblanc'], [157, 'Yasuo'], [84, 'Akali'], [105, 'Fizz'], [55, 'Katarina'], [163, 'Taliyah'], [38, 'Kassadin'], [4, 'TwistedFate'], [99, 'Lux'], [1, 'Annie'], [131, 'Diana']],
  BOTTOM: [[222, 'Jinx'], [145, 'Kaisa'], [81, 'Ezreal'], [498, 'Xayah'], [51, 'Caitlyn'], [236, 'Lucian'], [21, 'MissFortune'], [202, 'Jhin'], [22, 'Ashe'], [110, 'Varus']],
  UTILITY: [[412, 'Thresh'], [111, 'Nautilus'], [117, 'Lulu'], [497, 'Rakan'], [89, 'Leona'], [25, 'Morgana'], [267, 'Nami'], [40, 'Janna'], [53, 'Blitzcrank'], [526, 'Rell']]
}

const ROLE_ITEMS: Record<Role, number[]> = {
  TOP: [3078, 3047, 3053, 6333, 3071, 3065, 3364],
  JUNGLE: [6692, 3158, 3071, 6333, 3053, 3026, 3364],
  MIDDLE: MAGE_ITEMS,
  BOTTOM: [6672, 3006, 3031, 3094, 3036, 3026, 3363],
  UTILITY: [3190, 3117, 3109, 3222, 3050, 2065, 3364]
}

const ROLE_SPELLS: Record<Role, [number, number]> = {
  TOP: [4, 12],
  JUNGLE: [11, 4],
  MIDDLE: [4, 14],
  BOTTOM: [4, 7],
  UTILITY: [4, 3]
}

const NAMES = [
  'Faker Jr', 'SoloQ Demon', 'Baron Thief', 'Ward Bot', 'Ignite Me', 'TiltProof', 'Mid or Feed', 'Gank Plz',
  'Flash on D', 'Cannon Lover', 'Shadow Isles', 'Zaun Kid', 'Piltover PD', 'Rune Mage', 'Dragon Soul',
  'Nexus Sprinter', 'CS Machine', 'Roam King', 'Cold Brew', 'Nightfall', 'Kayle Main', 'Leash Pls',
  'No Wards', 'Clutch Smite', 'Elder Buff', 'Solo Bolo', 'Persian Prince', 'Teheran Ace', 'Shiraz Wolf', 'Caspian'
]

function mapPoint(r: Rng, side: 'blue' | 'red', aggressive: boolean): { x: number; y: number } {
  // Points around mid lane / river with a bias towards the enemy half when aggressive.
  const along = clamp(gauss(r, 7400, 2600), 600, 14200)
  let offset = gauss(r, 0, 1700)
  if (aggressive) offset = Math.abs(offset) + 400
  const dir = side === 'blue' ? 1 : -1
  const x = clamp(along + (offset * dir) / Math.SQRT2 + gauss(r, 0, 500), 300, 14500)
  const y = clamp(along + (offset * dir) / Math.SQRT2 - gauss(r, 0, 500), 300, 14500)
  // mirror half of the points across the anti-diagonal to cover side lanes
  if (r() < 0.25) return { x: clamp(x - 3500, 300, 14500), y: clamp(y + 3500, 300, 14500) }
  if (r() < 0.2) return { x: clamp(x + 3500, 300, 14500), y: clamp(y - 3500, 300, 14500) }
  return { x, y }
}

function generateMatch(r: Rng, index: number, total: number, when: number): MatchSummary {
  const progress = index / total // 0 oldest .. 1 newest
  const myChamp: ChampDef =
    r() < 0.88
      ? (() => {
          const roll = r()
          if (roll < 0.38) return MY_POOL[0]
          if (roll < 0.58) return MY_POOL[1]
          if (roll < 0.72) return MY_POOL[2]
          if (roll < 0.82) return MY_POOL[3]
          if (roll < 0.9) return MY_POOL[4]
          return MY_POOL[5]
        })()
      : pick(r, MY_POOL.slice(6))
  const myRole = myChamp.role
  const skill = 0.45 + progress * 0.25 + gauss(r, 0, 0.18) // performance factor
  const winChance = clamp(0.4 + skill * 0.25, 0.25, 0.8)
  const win = r() < winChance
  const queueId = r() < 0.85 ? 420 : r() < 0.6 ? 440 : 400
  const side: 'blue' | 'red' = r() < 0.5 ? 'blue' : 'red'
  const myTeam: 100 | 200 = side === 'blue' ? 100 : 200
  const enemyTeam: 100 | 200 = myTeam === 100 ? 200 : 100
  const duration = Math.round(clamp(gauss(r, win ? 1680 : 1740, 330), 900, 2700))
  const minutes = duration / 60
  const remake = false

  const teamKills = {
    [myTeam]: Math.round(clamp(gauss(r, win ? 29 : 19, 6), 6, 50)),
    [enemyTeam]: Math.round(clamp(gauss(r, win ? 18 : 28, 6), 5, 50))
  } as Record<100 | 200, number>

  const roleWeight: Record<Role, number> = { TOP: 1, JUNGLE: 1.1, MIDDLE: 1.3, BOTTOM: 1.4, UTILITY: 0.35 }
  const usedChamps = new Set<number>([myChamp.id])
  const participants: PlayerLine[] = []
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

  for (const team of [100, 200] as const) {
    const enemy = team === 100 ? 200 : 100
    const weights = roles.map((ro) => roleWeight[ro] * (0.6 + r() * 0.8))
    const wSum = weights.reduce((a, b) => a + b, 0)
    const deathWeights = roles.map(() => 0.6 + r() * 0.8)
    const dSum = deathWeights.reduce((a, b) => a + b, 0)
    roles.forEach((role, ri) => {
      const isMe = team === myTeam && role === myRole
      let champ: [number, string]
      if (isMe) champ = [myChamp.id, myChamp.name]
      else {
        do champ = pick(r, OTHER_CHAMPS[role])
        while (usedChamps.has(champ[0]))
        usedChamps.add(champ[0])
      }
      const kills = Math.round((teamKills[team] * weights[ri]) / wSum)
      const deaths = Math.round((teamKills[enemy] * deathWeights[ri]) / dSum)
      const kpTarget = role === 'UTILITY' || role === 'JUNGLE' ? 0.62 : 0.5
      const assists = Math.max(0, Math.round(teamKills[team] * clamp(gauss(r, kpTarget, 0.1), 0.2, 0.9) - kills))
      const csm = role === 'UTILITY' ? gauss(r, 1.2, 0.4) : role === 'JUNGLE' ? gauss(r, 6.2, 0.7) : gauss(r, 7.6, 0.8)
      const won = team === myTeam ? win : !win
      const gold = Math.round((role === 'UTILITY' ? 290 : 410) * minutes + kills * 300 + (won ? 1500 : 0) + gauss(r, 0, 600))
      const dpm = role === 'UTILITY' ? gauss(r, 320, 80) : gauss(r, role === 'MIDDLE' || role === 'BOTTOM' ? 760 : 620, 160)
      participants.push({
        puuid: isMe ? DEMO_PUUID : `demo-${index}-${team}-${role}`,
        name: isMe ? `${DEMO_ACCOUNT.gameName}#${DEMO_ACCOUNT.tagLine}` : `${pick(r, NAMES)}#${pick(r, ['EUW', 'IRN', '0001', 'GG', 'WIN'])}`,
        championId: champ[0],
        championName: champ[1],
        teamId: team,
        role,
        kills,
        deaths,
        assists,
        cs: Math.round(Math.max(0, csm) * minutes),
        gold,
        damage: Math.round(Math.max(80, dpm) * minutes),
        damageTaken: Math.round(gauss(r, role === 'TOP' || role === 'JUNGLE' ? 900 : 650, 150) * minutes),
        visionScore: Math.round(Math.max(0.2, gauss(r, role === 'UTILITY' ? 2.4 : role === 'JUNGLE' ? 1.1 : 0.75, 0.25)) * minutes),
        wardsPlaced: Math.round((role === 'UTILITY' ? 1.3 : 0.45) * minutes),
        wardsKilled: Math.round((role === 'UTILITY' ? 0.25 : 0.12) * minutes),
        controlWards: Math.max(0, Math.round(gauss(r, role === 'UTILITY' ? 5 : 2, 1.2))),
        level: Math.round(clamp(minutes * 0.55 + 2 + gauss(r, 0, 1), 6, 18)),
        items: (isMe ? myChamp.items : ROLE_ITEMS[role]).map((it, i) => (i < Math.min(6, Math.floor(minutes / 6) + 1) || i === 6 ? it : 0)),
        spells: isMe ? myChamp.spells : ROLE_SPELLS[role],
        keystone: isMe ? myChamp.page.perks[0] : pick(r, [8112, 8229, 8010, 8005, 8021, 8437, 8465, 8214, 8439, 9923]),
        primaryStyle: isMe ? myChamp.page.primaryStyle : pick(r, [8000, 8100, 8200, 8400]),
        subStyle: isMe ? myChamp.page.subStyle : pick(r, [8300, 8400, 8200]),
        win: won
      })
    })
  }

  const meLine = participants.find((p) => p.puuid === DEMO_PUUID)!
  // Shape my own line with the skill factor so trends and coaching insights look meaningful.
  const roleCsm = myRole === 'JUNGLE' ? 6.0 : 7.1
  const csPerMin = clamp(roleCsm + (skill - 0.5) * 2.2 + gauss(r, 0, 0.45), 4.5, 10.5)
  meLine.cs = Math.round(csPerMin * minutes)
  meLine.deaths = Math.max(0, Math.round(gauss(r, win ? 3.4 : 6.1, 1.6) - (skill - 0.5) * 2))
  meLine.kills = Math.max(0, Math.round(gauss(r, win ? 7.5 : 4.2, 2.5) + (skill - 0.5) * 3))
  meLine.assists = Math.max(0, Math.round(gauss(r, win ? 8.5 : 5.5, 2.5)))
  meLine.visionScore = Math.round(clamp(gauss(r, 0.62 + progress * 0.12, 0.13), 0.25, 1.4) * minutes)
  meLine.controlWards = Math.max(0, Math.round(gauss(r, 1.1 + progress * 1.2, 0.9)))
  meLine.damage = Math.round(clamp(gauss(r, 690 + skill * 160 + (win ? 70 : 0), 140), 250, 1500) * minutes)
  // keep team totals consistent with the adjusted line
  const myTeamLines = participants.filter((p) => p.teamId === myTeam)
  teamKills[myTeam] = myTeamLines.reduce((a, p) => a + p.kills, 0)
  const enemyLines = participants.filter((p) => p.teamId === enemyTeam)
  if (meLine.assists + meLine.kills > teamKills[myTeam]) meLine.assists = Math.max(0, teamKills[myTeam] - meLine.kills)
  const enemyKillsNow = enemyLines.reduce((a, p) => a + p.kills, 0)
  teamKills[enemyTeam] = Math.max(enemyKillsNow, myTeamLines.reduce((a, p) => a + p.deaths, 0))

  const opp = participants.find((p) => p.teamId === enemyTeam && p.role === myRole) ?? null
  const teamDamage = myTeamLines.reduce((a, p) => a + p.damage, 0)
  const teamGold = myTeamLines.reduce((a, p) => a + p.gold, 0)

  // Timeline
  const timeline: TimelinePoint[] = []
  let teamDiff = 0
  let laneDiff = 0
  const laneEdge = (skill - 0.55) * 90 + (win ? 25 : -25)
  const fullMinutes = Math.floor(minutes)
  const myGoldPerMin = meLine.gold / minutes
  for (let m = 0; m <= fullMinutes; m++) {
    if (m > 0) {
      teamDiff += gauss(r, win ? 55 : -55, 480) * (m > 15 ? 1.6 : 1)
      laneDiff += gauss(r, laneEdge, 140)
    }
    const myGold = Math.round(500 + Math.max(0, m - 1) * myGoldPerMin * (m < 14 ? 0.8 : 1.05))
    const csCurve = m < 2 ? 0 : (m - 1.1) * csPerMin * (m < 10 ? 0.97 : 1)
    timeline.push({
      minute: m,
      teamGoldDiff: Math.round(teamDiff),
      myGold,
      oppGold: opp ? Math.max(500, Math.round(myGold - laneDiff)) : null,
      myCs: Math.max(0, Math.round(csCurve)),
      oppCs: opp ? Math.max(0, Math.round(csCurve - laneDiff / 45 + gauss(r, 0, 2))) : null,
      myXp: Math.round(m * 380 + laneDiff * 0.6)
    })
  }
  // land on the final state
  timeline[timeline.length - 1].teamGoldDiff = Math.round(win ? Math.max(teamDiff, 2500) : Math.min(teamDiff, -2500))

  const at = (m: number) => timeline[Math.min(m, timeline.length - 1)]
  const deaths: MapEvent[] = []
  const kills: MapEvent[] = []
  let deathsBefore10 = 0
  let deathsBefore14 = 0
  let killsBefore14 = 0
  for (let i = 0; i < meLine.deaths; i++) {
    const t = Math.round(clamp(r() * duration * 0.95 + 120, 150, duration - 10))
    const p = mapPoint(r, side, r() < 0.62)
    deaths.push({ t, ...p })
    if (t < 600) deathsBefore10++
    if (t < 840) deathsBefore14++
  }
  for (let i = 0; i < meLine.kills; i++) {
    const t = Math.round(clamp(r() * duration * 0.95 + 120, 150, duration - 10))
    kills.push({ t, ...mapPoint(r, side, r() < 0.4) })
    if (t < 840) killsBefore14++
  }
  deaths.sort((a, b) => a.t - b.t)
  kills.sort((a, b) => a.t - b.t)

  const objectives: ObjectiveEvent[] = []
  const myDragons = win ? 2 + Math.floor(r() * 3) : Math.floor(r() * 3)
  const enemyDragons = win ? Math.floor(r() * 2) : 2 + Math.floor(r() * 3)
  let dt = 300 + Math.floor(r() * 90)
  const dragonTypes = ['FIRE_DRAGON', 'WATER_DRAGON', 'EARTH_DRAGON', 'AIR_DRAGON', 'HEXTECH_DRAGON', 'CHEMTECH_DRAGON']
  let md = myDragons
  let ed = enemyDragons
  while ((md > 0 || ed > 0) && dt < duration) {
    const mine = md > 0 && (ed === 0 || r() < 0.5)
    objectives.push({ t: dt, type: 'DRAGON', subType: pick(r, dragonTypes), team: mine ? myTeam : enemyTeam })
    if (mine) md--
    else ed--
    dt += 300 + Math.floor(r() * 120)
  }
  objectives.push({ t: 300 + Math.floor(r() * 120), type: 'HORDE', team: r() < (win ? 0.65 : 0.35) ? myTeam : enemyTeam })
  objectives.push({ t: 900 + Math.floor(r() * 180), type: 'HERALD', team: r() < (win ? 0.65 : 0.35) ? myTeam : enemyTeam })
  if (duration > 1500) objectives.push({ t: 1500 + Math.floor(r() * Math.max(60, duration - 1600)), type: 'BARON', team: win ? myTeam : enemyTeam })
  const myTowers = win ? 7 + Math.floor(r() * 4) : 1 + Math.floor(r() * 4)
  const enemyTowers = win ? 1 + Math.floor(r() * 4) : 7 + Math.floor(r() * 4)
  for (let i = 0; i < myTowers; i++) objectives.push({ t: Math.round(600 + (i / myTowers) * (duration - 650)), type: 'TOWER', team: myTeam })
  for (let i = 0; i < enemyTowers; i++) objectives.push({ t: Math.round(600 + (i / enemyTowers) * (duration - 650)), type: 'TOWER', team: enemyTeam })
  objectives.sort((a, b) => a.t - b.t)

  const firstItemMinute = clamp(gauss(r, 12.5 - progress * 1.8 - (skill - 0.5) * 2, 1.3), 8.5, 18)
  const purchases = [
    { t: 15, id: 1056 },
    { t: 16, id: 2003 },
    { t: 17, id: 2003 },
    { t: 18, id: 3340 },
    { t: Math.round(firstItemMinute * 60 - 220), id: 1001 },
    { t: Math.round(firstItemMinute * 60), id: myChamp.items[0] },
    { t: Math.round(firstItemMinute * 60 + 150), id: myChamp.items[1] },
    { t: Math.round(firstItemMinute * 60 + 520), id: myChamp.items[2] }
  ].filter((p) => p.t < duration)

  const kp = teamKills[myTeam] > 0 ? (meLine.kills + meLine.assists) / teamKills[myTeam] : 0
  const me: MyStats = {
    ...meLine,
    killParticipation: clamp(kp, 0, 1),
    damageShare: teamDamage > 0 ? meLine.damage / teamDamage : 0,
    goldShare: teamGold > 0 ? meLine.gold / teamGold : 0,
    csPerMin: meLine.cs / minutes,
    goldPerMin: meLine.gold / minutes,
    dpm: meLine.damage / minutes,
    visionPerMin: meLine.visionScore / minutes,
    kda: (meLine.kills + meLine.assists) / Math.max(1, meLine.deaths),
    timeDead: Math.round(meLine.deaths * (15 + minutes * 0.9)),
    soloKills: Math.max(0, Math.round(gauss(r, 1 + skill, 1))),
    skillshotsHit: Math.round(gauss(r, 40 + skill * 30, 10)),
    skillshotsDodged: Math.round(gauss(r, 25, 8)),
    turretPlates: Math.max(0, Math.round(gauss(r, 1.2, 1))),
    damageToObjectives: Math.round(gauss(r, 6000, 2500)),
    damageToBuildings: Math.round(gauss(r, 3000, 1500)),
    objectiveTakedowns: myDragons + (win ? 1 : 0),
    largestMultiKill: meLine.kills >= 8 ? 3 : meLine.kills >= 4 ? 2 : 1,
    firstBloodKill: r() < 0.12,
    firstTowerKill: r() < 0.15,
    runes: myChamp.page,
    skillOrder: myChamp.skill,
    itemPurchases: purchases
  }

  const laning = {
    csAt10: at(10).myCs,
    csAt15: at(15).myCs,
    goldAt10: at(10).myGold,
    goldAt15: at(15).myGold,
    xpAt10: at(10).myXp,
    xpAt15: at(15).myXp,
    csDiffAt10: opp ? at(10).myCs - (at(10).oppCs ?? 0) : null,
    csDiffAt15: opp ? at(15).myCs - (at(15).oppCs ?? 0) : null,
    goldDiffAt10: opp ? at(10).myGold - (at(10).oppGold ?? 0) : null,
    goldDiffAt15: opp ? at(15).myGold - (at(15).oppGold ?? 0) : null,
    xpDiffAt10: opp ? Math.round(laneDiff * 0.5) : null,
    xpDiffAt15: opp ? Math.round(laneDiff * 0.7) : null,
    deathsBefore10,
    deathsBefore14,
    killsBefore14,
    firstBloodInvolved: r() < 0.3
  }

  const cnt = (team: number, type: ObjectiveEvent['type']) => objectives.filter((o) => o.team === team && o.type === type).length
  const firstOf = (type: ObjectiveEvent['type']) => objectives.find((o) => o.type === type)?.team

  return {
    matchId: `EUW1_${7100000000 + index * 137}`,
    platform: 'EUW1',
    queueId,
    gameCreation: when,
    gameDuration: duration,
    gameVersion: '15.19.1',
    remake,
    surrender: duration < 1500 && r() < 0.5,
    win,
    side,
    me,
    opponent: opp,
    participants,
    bans: [100, 200].flatMap((teamId) =>
      Array.from({ length: 5 }, () => ({ teamId: teamId as 100 | 200, championId: pick(r, OTHER_CHAMPS[pick(r, roles)])[0] }))
    ),
    laning,
    timeline,
    deaths,
    kills,
    objectives,
    teamStats: {
      myTeam: {
        kills: teamKills[myTeam],
        dragons: cnt(myTeam, 'DRAGON'),
        barons: cnt(myTeam, 'BARON'),
        heralds: cnt(myTeam, 'HERALD'),
        hordes: cnt(myTeam, 'HORDE') * 3,
        towers: cnt(myTeam, 'TOWER'),
        inhibitors: win ? 1 + Math.floor(r() * 2) : 0,
        firstDragon: firstOf('DRAGON') === myTeam,
        firstTower: firstOf('TOWER') === myTeam,
        firstBlood: r() < 0.5
      },
      enemyTeam: {
        kills: teamKills[enemyTeam],
        dragons: cnt(enemyTeam, 'DRAGON'),
        barons: cnt(enemyTeam, 'BARON'),
        heralds: cnt(enemyTeam, 'HERALD'),
        hordes: cnt(enemyTeam, 'HORDE') * 3,
        towers: cnt(enemyTeam, 'TOWER'),
        inhibitors: win ? 0 : 1 + Math.floor(r() * 2),
        firstDragon: firstOf('DRAGON') === enemyTeam,
        firstTower: firstOf('TOWER') === enemyTeam,
        firstBlood: false
      }
    },
    source: 'demo'
  }
}

export function generateDemoProfileData(now = Date.now()): ProfileData {
  const r = mulberry32(1337)
  const total = 140
  // Build a play schedule: evening sessions over the last ~45 days.
  const times: number[] = []
  let day = 45
  while (times.length < total && day >= 0) {
    if (r() < 0.72) {
      const sessionGames = 2 + Math.floor(r() * 5)
      const start = new Date(now - day * 86400000)
      start.setHours(17 + Math.floor(r() * 6), Math.floor(r() * 60), 0, 0)
      let t = start.getTime()
      for (let g = 0; g < sessionGames && times.length < total; g++) {
        if (t < now - 10 * 60000) times.push(t)
        t += (28 + Math.floor(r() * 18)) * 60000
      }
    }
    day--
  }
  times.sort((a, b) => a - b)
  const matches = times.map((t, i) => generateMatch(r, i, times.length, t)).reverse() // newest first

  // Rank history from the ranked solo games (oldest -> newest)
  let abs = absoluteLp('EMERALD', 'IV', 20)
  const rankHistory: RankSnapshot[] = []
  let wins = 212
  let losses = 198
  const soloOldestFirst = [...matches].reverse().filter((m) => m.queueId === 420)
  for (const m of soloOldestFirst) {
    const delta = m.win ? 21 + Math.floor(r() * 6) : -(17 + Math.floor(r() * 6))
    abs = Math.max(absoluteLp('PLATINUM', 'I', 0), abs + delta)
    if (m.win) wins++
    else losses++
    const rk = rankFromAbsolute(abs)
    rankHistory.push({
      t: m.gameCreation + m.gameDuration * 1000 + 60000,
      queueType: 'RANKED_SOLO_5x5',
      tier: rk.tier,
      rank: rk.division,
      lp: rk.lp,
      wins,
      losses
    })
  }
  const last = rankHistory[rankHistory.length - 1]
  const solo: RankEntry = {
    queueType: 'RANKED_SOLO_5x5',
    tier: last.tier,
    rank: last.rank,
    leaguePoints: last.lp,
    wins: last.wins,
    losses: last.losses,
    hotStreak: matches.slice(0, 3).every((m) => m.win)
  }
  const flex: RankEntry = {
    queueType: 'RANKED_FLEX_SR',
    tier: 'EMERALD',
    rank: 'II',
    leaguePoints: 63,
    wins: 41,
    losses: 37
  }

  const journal: JournalEntry[] = matches.slice(0, 6).filter((_, i) => i % 2 === 0).map((m, i) => ({
    id: `demo-j-${i}`,
    createdAt: m.gameCreation + m.gameDuration * 1000 + 300000,
    matchId: m.matchId,
    championId: m.me.championId,
    win: m.win,
    mental: m.win ? 4 : 2 + (i % 2),
    tags: m.win ? ['good_wave', 'good_roam'] : ['overextend', 'no_vision', 'bad_back'],
    went_well: m.win ? 'Pushed wave before roaming bot, got 2 kills and drake.' : 'Laning was even until 8 min.',
    improve: m.win ? 'Track enemy jungler after 10 min.' : 'Died in river without ward twice. Ward before shoving.',
    notes: '',
    reviewed: i === 0
  }))

  const goals: Goal[] = [
    { id: 'g-cs10', metric: 'csAt10', comparator: 'gte', target: 80, window: 20, createdAt: now - 20 * 86400000, active: true },
    { id: 'g-deaths', metric: 'deathsBefore14', comparator: 'lte', target: 1, window: 20, createdAt: now - 15 * 86400000, active: true },
    { id: 'g-vision', metric: 'controlWards', comparator: 'gte', target: 2, window: 20, createdAt: now - 10 * 86400000, active: true }
  ]

  return {
    account: { ...DEMO_ACCOUNT },
    profile: { account: { ...DEMO_ACCOUNT }, ranks: [solo, flex], fetchedAt: now },
    matches,
    rankHistory,
    journal,
    goals,
    routine: [],
    lastSync: now - 25 * 60000
  }
}

export function demoScout(): ScoutResult {
  const r = mulberry32(99)
  const tiers = ['DIAMOND', 'DIAMOND', 'EMERALD', 'MASTER', 'DIAMOND'] as const
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
  const players = ([100, 200] as const).flatMap((teamId) =>
    roles.map((role, i) => {
      const isMe = teamId === 100 && role === 'MIDDLE'
      const champ = isMe ? [103, 'Ahri'] : pick(r, OTHER_CHAMPS[role])
      const wins = 40 + Math.floor(r() * 150)
      const losses = 40 + Math.floor(r() * 140)
      return {
        puuid: isMe ? DEMO_PUUID : `scout-${teamId}-${i}`,
        name: isMe ? 'Rift Climber#DEMO' : `${pick(r, NAMES)}#${pick(r, ['EUW', 'IRN', 'GG'])}`,
        championId: champ[0] as number,
        teamId,
        spells: ROLE_SPELLS[role],
        keystone: pick(r, [8112, 8229, 8010, 8005, 8021, 8437, 8465, 8214]),
        isMe,
        solo: {
          queueType: 'RANKED_SOLO_5x5',
          tier: pick(r, [...tiers]),
          rank: pick(r, ['I', 'II', 'III', 'IV'] as const),
          leaguePoints: Math.floor(r() * 100),
          wins,
          losses,
          hotStreak: r() < 0.2
        },
        flex: null,
        masteryPoints: Math.floor(r() * r() * 900000),
        masteryLevel: 5 + Math.floor(r() * 30)
      }
    })
  )
  return {
    gameId: 'demo',
    queueId: 420,
    gameStart: Date.now() - 7 * 60000,
    players,
    bans: [],
    source: 'demo'
  }
}

export function demoLiveClient(gameTime: number): LiveClientState {
  const scout = demoScout()
  const minutes = gameTime / 60
  return {
    active: true,
    gameTime,
    gameMode: 'CLASSIC',
    me: {
      name: 'Rift Climber#DEMO',
      championName: 'Ahri',
      level: Math.min(18, Math.floor(minutes * 0.6) + 1),
      currentGold: 1150,
      cs: Math.round(Math.max(0, minutes - 1.1) * 7.4),
      kills: 3,
      deaths: 1,
      assists: 4,
      team: 'ORDER'
    },
    players: scout.players.map((p) => ({
      name: p.name,
      championName: '',
      championId: p.championId,
      team: p.teamId === 100 ? 'ORDER' : 'CHAOS',
      level: Math.min(18, Math.floor(minutes * 0.6) + 1),
      kills: Math.floor(Math.abs(Math.sin(p.championId)) * 6),
      deaths: Math.floor(Math.abs(Math.cos(p.championId)) * 5),
      assists: Math.floor(Math.abs(Math.sin(p.championId * 3)) * 7),
      cs: Math.round(Math.max(0, minutes - 1.1) * (p.isMe ? 7.4 : 6)),
      wardScore: Math.round(minutes * 0.8),
      items: [],
      position: '',
      isMe: p.isMe,
      isDead: false,
      respawnTimer: 0
    })),
    timers: [
      { key: 'dragon', label: 'Dragon', respawnAt: Math.max(gameTime + 95, 300) },
      { key: 'baron', label: 'Baron', respawnAt: 1200 },
      { key: 'herald', label: 'Herald', respawnAt: 840 }
    ],
    teamKills: { ORDER: 9, CHAOS: 6 },
    dragons: { ORDER: ['Infernal'], CHAOS: [] }
  }
}

export function demoChampSelect(): ChampSelectState {
  return {
    localPlayerCellId: 2,
    phase: 'BAN_PICK',
    timeLeftMs: 24000,
    queueId: 420,
    bans: { myTeam: [157, 238, 7], theirTeam: [64, 222, 412] },
    myTeam: [
      { cellId: 0, championId: 516, championPickIntent: 0, assignedPosition: 'top', isMe: false },
      { cellId: 1, championId: 254, championPickIntent: 0, assignedPosition: 'jungle', isMe: false },
      { cellId: 2, championId: 0, championPickIntent: 103, assignedPosition: 'middle', isMe: true },
      { cellId: 3, championId: 0, championPickIntent: 145, assignedPosition: 'bottom', isMe: false },
      { cellId: 4, championId: 0, championPickIntent: 0, assignedPosition: 'utility', isMe: false }
    ],
    theirTeam: [
      { cellId: 5, championId: 122, championPickIntent: 0, assignedPosition: '', isMe: false },
      { cellId: 6, championId: 104, championPickIntent: 0, assignedPosition: '', isMe: false },
      { cellId: 7, championId: 84, championPickIntent: 0, assignedPosition: '', isMe: false },
      { cellId: 8, championId: 0, championPickIntent: 0, assignedPosition: '', isMe: false },
      { cellId: 9, championId: 0, championPickIntent: 0, assignedPosition: '', isMe: false }
    ]
  }
}

export function demoLeaderboard(): Leaderboard {
  const r = mulberry32(7)
  const entries = Array.from({ length: 300 }, (_, i) => {
    const lp = Math.round(1650 - i * 4.2 - r() * 6)
    const games = 250 + Math.floor(r() * 500)
    const wr = 0.55 + r() * 0.1 - i * 0.0001
    const wins = Math.round(games * wr)
    return {
      puuid: `lb-${i}`,
      name: `${pick(r, NAMES)}#${pick(r, ['EUW', 'KR1', '0001'])}`,
      lp,
      wins,
      losses: games - wins,
      tier: (i < 300 ? 'CHALLENGER' : 'GRANDMASTER') as 'CHALLENGER',
      hotStreak: r() < 0.15
    }
  })
  return {
    platform: 'euw1',
    queue: 'RANKED_SOLO_5x5',
    fetchedAt: Date.now(),
    entries,
    cutoffs: { challenger: entries[entries.length - 1].lp, grandmaster: 470, master: 0 }
  }
}
