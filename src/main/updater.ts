// Automatic updates from GitHub Releases.
// Installed builds (NSIS) download new versions in the background and install them on quit
// (or immediately when the user clicks "restart"). The portable exe cannot replace itself,
// so it only checks the latest release and links to the download page.
import { app, net } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { RELEASES_URL, UPDATE_REPO } from '@shared/constants'
import type { UpdateStatus } from '@shared/types'
import { compareVersions, plainNotes } from '@shared/version'

type Emit = (channel: string, payload: unknown) => void

const FIRST_CHECK_DELAY = 15_000
const CHECK_INTERVAL = 4 * 3600_000

const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
let status: UpdateStatus = {
  state: 'idle',
  currentVersion: app.getVersion(),
  portable,
  releaseUrl: RELEASES_URL
}
let emit: Emit = () => undefined
let timer: NodeJS.Timeout | null = null

function set(patch: Partial<UpdateStatus>): UpdateStatus {
  status = { ...status, ...patch }
  emit('update:status', status)
  return status
}

function errorCode(err: unknown): string {
  const msg = String((err as Error)?.message ?? err)
  if (/404|releases\.atom|Unable to find latest version|No published versions/i.test(msg)) return 'UPDATE_NO_RELEASES'
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|ERR_|net::|getaddrinfo|socket/i.test(msg)) return 'NETWORK'
  return msg.split('\n')[0].slice(0, 200)
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

export function setAutoDownload(enabled: boolean): void {
  autoUpdater.autoDownload = enabled && !portable
}

/** Portable builds: ask the GitHub API for the newest release. */
async function checkPortable(): Promise<UpdateStatus> {
  set({ state: 'checking', error: undefined })
  try {
    const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO.owner}/${UPDATE_REPO.repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rel = (await res.json()) as { tag_name: string; body?: string; html_url?: string }
    const newer = compareVersions(rel.tag_name, app.getVersion()) > 0
    return set({
      state: newer ? 'available' : 'none',
      version: rel.tag_name.replace(/^v/i, ''),
      notes: plainNotes(rel.body),
      releaseUrl: rel.html_url ?? RELEASES_URL,
      checkedAt: Date.now()
    })
  } catch (err) {
    return set({ state: 'error', error: errorCode(err), checkedAt: Date.now() })
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (status.state === 'disabled') return status
  // never interrupt a running download or throw away a finished one
  if (status.state === 'downloading' || status.state === 'downloaded') return status
  if (portable) return checkPortable()
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    set({ state: 'error', error: errorCode(err), checkedAt: Date.now() })
  }
  return status
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (portable || status.state !== 'available') return status
  try {
    set({ state: 'downloading', progress: 0 })
    await autoUpdater.downloadUpdate()
  } catch (err) {
    set({ state: 'error', error: errorCode(err) })
  }
  return status
}

export function installUpdate(): void {
  if (status.state !== 'downloaded') return
  // silent install, then start the new version
  autoUpdater.quitAndInstall(true, true)
}

export function initUpdater(emitter: Emit, autoDownload: boolean): void {
  emit = emitter
  if (!app.isPackaged) {
    set({ state: 'disabled' })
    return
  }
  autoUpdater.logger = null
  autoUpdater.allowPrerelease = false
  autoUpdater.autoInstallOnAppQuit = true
  setAutoDownload(autoDownload)

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: undefined }))
  autoUpdater.on('update-available', (info: UpdateInfo) =>
    set({
      state: autoUpdater.autoDownload ? 'downloading' : 'available',
      version: info.version,
      notes: plainNotes(info.releaseNotes),
      progress: 0,
      checkedAt: Date.now()
    })
  )
  autoUpdater.on('update-not-available', () => set({ state: 'none', checkedAt: Date.now() }))
  autoUpdater.on('download-progress', (p: ProgressInfo) => set({ state: 'downloading', progress: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info: UpdateInfo) =>
    set({ state: 'downloaded', version: info.version, notes: plainNotes(info.releaseNotes), progress: 100 })
  )
  autoUpdater.on('error', (err) => {
    // a failed background check should not hide an update that is already downloaded
    if (status.state !== 'downloaded') set({ state: 'error', error: errorCode(err) })
  })

  setTimeout(() => void checkForUpdates(), FIRST_CHECK_DELAY)
  timer = setInterval(() => void checkForUpdates(), CHECK_INTERVAL)
}

export function stopUpdater(): void {
  if (timer) clearInterval(timer)
}
