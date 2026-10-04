import { buildLiveState } from '@shared/live'
import { demoLiveClient } from '@shared/demo'
import type { ChampSelectPlayer, ChampSelectState, LcuStatus, LiveClientState, RunePage } from '@shared/types'
import { getSettings } from '../store'
import { LcuClient, discoverCredentials, liveClientAllData } from './lcu'

type Emit = (channel: string, payload: unknown) => void

export class ClientWatcher {
  status: LcuStatus = { connected: false, phase: 'None' }
  lcu: LcuClient | null = null
  private ticks = 0
  private timers: NodeJS.Timeout[] = []
  private acceptScheduledFor: string | null = null
  private champSelectKey = ''
  private liveActive = false
  private previewUntil = 0

  constructor(
    private emit: Emit,
    private onGameEnded: () => void
  ) {}

  start(): void {
    this.timers.push(setInterval(() => void this.loop(), 2000))
    this.timers.push(setInterval(() => void this.liveLoop(), 2000))
    void this.loop()
  }

  stop(): void {
    this.timers.forEach(clearInterval)
  }

  previewOverlay(seconds = 45): void {
    this.previewUntil = Date.now() + seconds * 1000
  }

  private setStatus(patch: Partial<LcuStatus>): void {
    const next = { ...this.status, ...patch }
    const changed = JSON.stringify(next) !== JSON.stringify(this.status)
    this.status = next
    if (changed) this.emit('lcu:status', this.status)
  }

  private async connect(): Promise<void> {
    const deep = this.ticks % 8 === 1 // the process scan is comparatively expensive (~every 16 s)
    const creds = await discoverCredentials(getSettings().leaguePath, deep)
    if (!creds) return
    const client = new LcuClient(creds)
    try {
      const me = await client.get<any>('/lol-summoner/v1/current-summoner')
      const region = await client.get<any>('/riotclient/region-locale').catch(() => null)
      this.lcu = client
      this.setStatus({
        connected: true,
        summoner: me?.puuid
          ? { gameName: me.gameName ?? me.displayName ?? '', tagLine: me.tagLine ?? '', puuid: me.puuid, region: region?.region }
          : undefined
      })
    } catch {
      /* client is still booting */
    }
  }

  private async loop(): Promise<void> {
    this.ticks++
    if (!this.lcu) {
      await this.connect()
      if (!this.lcu) return
    }
    let phase: string
    try {
      phase = (await this.lcu.get<string>('/lol-gameflow/v1/gameflow-phase')) ?? 'None'
    } catch {
      this.lcu = null
      this.setStatus({ connected: false, phase: 'None', summoner: undefined })
      this.emit('lcu:champselect', null)
      return
    }
    const prev = this.status.phase
    if (phase !== prev) this.onPhaseChange(prev, phase)
    this.setStatus({ phase })

    if (phase === 'ReadyCheck') await this.handleReadyCheck()
    if (phase === 'ChampSelect') await this.pollChampSelect()
  }

  private onPhaseChange(prev: string, phase: string): void {
    const settings = getSettings()
    if (phase === 'ChampSelect' && settings.openChampSelect) this.emit('navigate', '/champ-select')
    if (prev === 'ChampSelect' && phase !== 'ChampSelect') {
      this.champSelectKey = ''
      this.emit('lcu:champselect', null)
    }
    if (phase === 'InProgress') this.emit('navigate', '/live')
    const wasInGame = prev === 'InProgress' || prev === 'WaitingForStats' || prev === 'PreEndOfGame'
    if (wasInGame && (phase === 'EndOfGame' || phase === 'None' || phase === 'Lobby')) this.onGameEnded()
    if (phase !== 'ReadyCheck') this.acceptScheduledFor = null
  }

  private async handleReadyCheck(): Promise<void> {
    const settings = getSettings()
    if (!settings.autoAccept || !this.lcu) return
    try {
      const rc = await this.lcu.get<any>('/lol-matchmaking/v1/ready-check')
      if (rc?.state !== 'InProgress' || rc?.playerResponse !== 'None') return
      const key = `${rc.timer ?? ''}`
      if (this.acceptScheduledFor) return
      this.acceptScheduledFor = key
      const lcu = this.lcu
      setTimeout(
        () => {
          void lcu
            .post('/lol-matchmaking/v1/ready-check/accept')
            .then(() => this.setStatus({ lastAutoAccept: Date.now() }))
            .catch(() => undefined)
        },
        Math.max(0, settings.autoAcceptDelay) * 1000
      )
    } catch {
      /* ignore */
    }
  }

  private async pollChampSelect(): Promise<void> {
    if (!this.lcu) return
    try {
      const s = await this.lcu.get<any>('/lol-champ-select/v1/session')
      const mapPlayer = (p: any): ChampSelectPlayer => ({
        cellId: p.cellId,
        championId: p.championId ?? 0,
        championPickIntent: p.championPickIntent ?? 0,
        assignedPosition: p.assignedPosition ?? '',
        summonerName: p.gameName ? `${p.gameName}#${p.tagLine}` : undefined,
        puuid: p.puuid || undefined,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        isMe: p.cellId === s.localPlayerCellId
      })
      const myCells = new Set<number>((s.myTeam ?? []).map((p: any) => p.cellId))
      const banActions = (s.actions ?? []).flat().filter((a: any) => a.type === 'ban' && a.completed && a.championId)
      const state: ChampSelectState = {
        localPlayerCellId: s.localPlayerCellId,
        myTeam: (s.myTeam ?? []).map(mapPlayer),
        theirTeam: (s.theirTeam ?? []).map(mapPlayer),
        bans: {
          myTeam: s.bans?.myTeamBans?.length
            ? s.bans.myTeamBans
            : banActions.filter((a: any) => myCells.has(a.actorCellId)).map((a: any) => a.championId),
          theirTeam: s.bans?.theirTeamBans?.length
            ? s.bans.theirTeamBans
            : banActions.filter((a: any) => !myCells.has(a.actorCellId)).map((a: any) => a.championId)
        },
        phase: s.timer?.phase ?? '',
        timeLeftMs: s.timer?.adjustedTimeLeftInPhase ?? 0
      }
      const key = JSON.stringify(state)
      if (key !== this.champSelectKey) {
        this.champSelectKey = key
        this.emit('lcu:champselect', state)
      }
    } catch {
      /* not in champ select anymore */
    }
  }

  private async liveLoop(): Promise<void> {
    if (Date.now() < this.previewUntil) {
      const t = 600 + Math.floor((45000 - (this.previewUntil - Date.now())) / 1000)
      this.emit('live:update', demoLiveClient(t))
      this.liveActive = true
      return
    }
    const inGame = this.status.phase === 'InProgress'
    // Without the client we still probe every few seconds (e.g. spectating / client closed).
    if (!inGame && !this.liveActive && (this.status.connected || this.ticks % 3 !== 0)) return
    try {
      const all = await liveClientAllData()
      if (!all?.gameData) throw new Error('loading')
      const state: LiveClientState = buildLiveState(all)
      this.liveActive = true
      this.emit('live:update', state)
    } catch {
      if (this.liveActive) {
        this.liveActive = false
        this.emit('live:update', { active: false, gameTime: 0, gameMode: '', players: [], timers: [], teamKills: { ORDER: 0, CHAOS: 0 }, dragons: { ORDER: [], CHAOS: [] } } satisfies LiveClientState)
      }
    }
  }

  async pushRunePage(page: RunePage, name: string): Promise<void> {
    if (!this.lcu) throw new Error('CLIENT_NOT_RUNNING')
    const lcu = this.lcu
    const body = {
      name: `RC: ${name}`.slice(0, 25),
      primaryStyleId: page.primaryStyle,
      subStyleId: page.subStyle,
      selectedPerkIds: [...page.perks, ...page.statPerks],
      current: true
    }
    const pages = await lcu.get<any[]>('/lol-perks/v1/pages')
    const ours = pages.find((p) => String(p.name ?? '').startsWith('RC:') && p.isDeletable)
    if (ours) await lcu.delete(`/lol-perks/v1/pages/${ours.id}`)
    try {
      await lcu.post('/lol-perks/v1/pages', body)
    } catch (err) {
      const msg = String((err as { body?: string }).body ?? '')
      if (msg.toLowerCase().includes('max')) throw new Error('NO_FREE_RUNE_PAGE')
      throw err
    }
  }
}
