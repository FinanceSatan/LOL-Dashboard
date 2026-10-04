import { net } from 'electron'
import { accountRegionOf, regionOf } from '@shared/constants'
import type { PlatformId } from '@shared/types'

export class RiotApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Sliding-window rate limiter per routing host. Defaults match a Riot development key
 * (20 requests / 1 s and 100 requests / 2 min) and are updated from the response headers.
 */
class RateLimiter {
  private limits: [number, number][] = [
    [20, 1000],
    [100, 120000]
  ]
  private stamps = new Map<string, number[]>()
  private pausedUntil = new Map<string, number>()

  setFromHeader(header: string | null): void {
    if (!header) return
    const parsed = header
      .split(',')
      .map((p) => p.split(':').map(Number))
      .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n) && n > 0))
      .map(([count, secs]) => [Math.max(1, count - 1), secs * 1000] as [number, number])
    if (parsed.length) this.limits = parsed
  }

  pause(key: string, ms: number): void {
    this.pausedUntil.set(key, Date.now() + ms)
  }

  async acquire(key: string): Promise<void> {
    for (;;) {
      const now = Date.now()
      const paused = (this.pausedUntil.get(key) ?? 0) - now
      if (paused > 0) {
        await sleep(paused)
        continue
      }
      const list = this.stamps.get(key) ?? []
      const maxWindow = Math.max(...this.limits.map((l) => l[1]))
      while (list.length && now - list[0] > maxWindow) list.shift()
      let wait = 0
      for (const [count, windowMs] of this.limits) {
        const inWindow = list.filter((t) => now - t < windowMs)
        if (inWindow.length >= count) wait = Math.max(wait, inWindow[inWindow.length - count] + windowMs - now + 25)
      }
      if (wait <= 0) {
        list.push(now)
        this.stamps.set(key, list)
        return
      }
      await sleep(wait)
    }
  }
}

export class RiotApi {
  private limiter = new RateLimiter()

  constructor(private getKey: () => string | null) {}

  private async request<T>(host: string, path: string, attempt = 0): Promise<T> {
    const key = this.getKey()
    if (!key) throw new RiotApiError('NO_API_KEY', 401)
    await this.limiter.acquire(host)
    let res: Response
    try {
      res = await net.fetch(`https://${host}.api.riotgames.com${path}`, {
        headers: { 'X-Riot-Token': key, Accept: 'application/json' }
      })
    } catch (err) {
      if (attempt < 2) {
        await sleep(1500 * (attempt + 1))
        return this.request<T>(host, path, attempt + 1)
      }
      throw new RiotApiError(`NETWORK: ${(err as Error).message}`, 0)
    }
    this.limiter.setFromHeader(res.headers.get('x-app-rate-limit'))
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') ?? '5')
      this.limiter.pause(host, Math.max(1, retry) * 1000)
      if (attempt < 5) return this.request<T>(host, path, attempt + 1)
    }
    if (res.status >= 500 && attempt < 3) {
      await sleep(1000 * (attempt + 1))
      return this.request<T>(host, path, attempt + 1)
    }
    if (!res.ok) {
      const code =
        res.status === 401 || res.status === 403
          ? 'INVALID_API_KEY'
          : res.status === 404
            ? 'NOT_FOUND'
            : `HTTP_${res.status}`
      throw new RiotApiError(code, res.status)
    }
    return (await res.json()) as T
  }

  // ----- account / summoner / league -----

  accountByRiotId(platform: PlatformId, gameName: string, tagLine: string) {
    return this.request<{ puuid: string; gameName: string; tagLine: string }>(
      accountRegionOf(platform),
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    )
  }

  accountByPuuid(platform: PlatformId, puuid: string) {
    return this.request<{ puuid: string; gameName: string; tagLine: string }>(
      accountRegionOf(platform),
      `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`
    )
  }

  summonerByPuuid(platform: PlatformId, puuid: string) {
    return this.request<{ profileIconId: number; summonerLevel: number; id?: string }>(
      platform,
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
    )
  }

  leagueEntries(platform: PlatformId, puuid: string) {
    return this.request<any[]>(platform, `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`)
  }

  apexLeague(platform: PlatformId, tier: 'challenger' | 'grandmaster' | 'master', queue = 'RANKED_SOLO_5x5') {
    return this.request<{ entries: any[] }>(platform, `/lol/league/v4/${tier}leagues/by-queue/${queue}`)
  }

  // ----- matches -----

  matchIds(platform: PlatformId, puuid: string, start: number, count: number) {
    return this.request<string[]>(
      regionOf(platform),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}`
    )
  }

  match(platform: PlatformId, matchId: string) {
    return this.request<any>(regionOf(platform), `/lol/match/v5/matches/${encodeURIComponent(matchId)}`)
  }

  timeline(platform: PlatformId, matchId: string) {
    return this.request<any>(regionOf(platform), `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`)
  }

  // ----- live -----

  activeGame(platform: PlatformId, puuid: string) {
    return this.request<any>(platform, `/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`)
  }

  masteryByChampion(platform: PlatformId, puuid: string, championId: number) {
    return this.request<{ championPoints: number; championLevel: number }>(
      platform,
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/by-champion/${championId}`
    )
  }

  topMasteries(platform: PlatformId, puuid: string, count = 10) {
    return this.request<{ championId: number; championPoints: number; championLevel: number; lastPlayTime: number }[]>(
      platform,
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${count}`
    )
  }
}
