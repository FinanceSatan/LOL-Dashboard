// Connector for the League Client (LCU) local REST API and the in-game Live Client Data API.
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import https from 'node:https'
import { join } from 'node:path'

export interface LcuCredentials {
  port: number
  password: string
}

// Both local APIs use a self-signed Riot certificate; this agent is only ever used for 127.0.0.1.
const localAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true })

export function localRequest<T>(
  port: number,
  method: string,
  path: string,
  options: { auth?: string; body?: unknown; timeout?: number } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = options.body !== undefined ? JSON.stringify(options.body) : undefined
    const req = https.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        agent: localAgent,
        timeout: options.timeout ?? 4000,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(options.auth ? { Authorization: `Basic ${Buffer.from(`riot:${options.auth}`).toString('base64')}` } : {})
        }
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if ((res.statusCode ?? 500) >= 400) {
            reject(Object.assign(new Error(`LCU ${res.statusCode} ${path}`), { status: res.statusCode, body: text }))
            return
          }
          if (!text) return resolve(undefined as T)
          try {
            resolve(JSON.parse(text) as T)
          } catch {
            resolve(text as unknown as T)
          }
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function parseLockfile(file: string): LcuCredentials | null {
  try {
    if (!existsSync(file)) return null
    const [, , port, password] = readFileSync(file, 'utf8').trim().split(':')
    if (!port || !password) return null
    return { port: Number(port), password }
  } catch {
    return null
  }
}

function fromCommandLine(cmd: string): LcuCredentials | null {
  const port = cmd.match(/--app-port=["']?(\d+)/)?.[1]
  const password = cmd.match(/--remoting-auth-token=["']?([\w-]+)/)?.[1]
  return port && password ? { port: Number(port), password } : null
}

function processCommandLine(): Promise<string> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine"
        ],
        { windowsHide: true, timeout: 6000 },
        (_err, stdout) => resolve(stdout ?? '')
      )
    } else {
      execFile('ps', ['-A', '-o', 'args'], { timeout: 4000 }, (_err, stdout) =>
        resolve((stdout ?? '').split('\n').find((l) => l.includes('LeagueClientUx')) ?? '')
      )
    }
  })
}

const DEFAULT_PATHS = [
  'C:\\Riot Games\\League of Legends',
  'D:\\Riot Games\\League of Legends',
  'E:\\Riot Games\\League of Legends',
  '/Applications/League of Legends.app/Contents/LoL'
]

export async function discoverCredentials(installPath: string, deep: boolean): Promise<LcuCredentials | null> {
  for (const dir of [installPath, ...DEFAULT_PATHS]) {
    if (!dir) continue
    const creds = parseLockfile(join(dir, 'lockfile'))
    if (creds) return creds
  }
  if (!deep) return null
  return fromCommandLine(await processCommandLine())
}

export class LcuClient {
  constructor(public creds: LcuCredentials) {}

  get<T>(path: string): Promise<T> {
    return localRequest<T>(this.creds.port, 'GET', path, { auth: this.creds.password })
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return localRequest<T>(this.creds.port, 'POST', path, { auth: this.creds.password, body })
  }
  put<T>(path: string, body?: unknown): Promise<T> {
    return localRequest<T>(this.creds.port, 'PUT', path, { auth: this.creds.password, body })
  }
  delete<T>(path: string): Promise<T> {
    return localRequest<T>(this.creds.port, 'DELETE', path, { auth: this.creds.password })
  }
}

/** Live Client Data API – only reachable while a game is running. */
export function liveClientAllData(): Promise<any> {
  return localRequest<any>(2999, 'GET', '/liveclientdata/allgamedata', { timeout: 1500 })
}
