import clsx from 'clsx'
import {
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  Crown,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  Radio,
  RefreshCw,
  Settings as SettingsIcon,
  Swords,
  Target,
  Trophy,
  Wrench,
  XCircle,
  AlertTriangle,
  Users
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { PLATFORMS } from '@shared/constants'
import { useT, type TKey } from '@/i18n'
import { useApp } from '@/store/app'
import { useAnalysis } from '@/store/analysis'
import { timeAgo } from '@/lib/format'
import { ProfileIcon, RankEmblem, TierText } from './game'
import { Progress, Spinner } from './ui'

const NAV: { group: TKey; items: { to: string; label: TKey; icon: ReactNode }[] }[] = [
  {
    group: 'nav.group.overview',
    items: [
      { to: '/', label: 'nav.dashboard', icon: <LayoutDashboard size={17} /> },
      { to: '/coach', label: 'nav.coach', icon: <Brain size={17} /> }
    ]
  },
  {
    group: 'nav.group.analysis',
    items: [
      { to: '/matches', label: 'nav.matches', icon: <History size={17} /> },
      { to: '/analytics', label: 'nav.analytics', icon: <BarChart3 size={17} /> },
      { to: '/champions', label: 'nav.champions', icon: <Users size={17} /> }
    ]
  },
  {
    group: 'nav.group.improve',
    items: [
      { to: '/goals', label: 'nav.goals', icon: <Target size={17} /> },
      { to: '/journal', label: 'nav.journal', icon: <BookOpen size={17} /> }
    ]
  },
  {
    group: 'nav.group.live',
    items: [
      { to: '/champ-select', label: 'nav.champSelect', icon: <Swords size={17} /> },
      { to: '/live', label: 'nav.live', icon: <Radio size={17} /> }
    ]
  },
  {
    group: 'nav.group.tools',
    items: [
      { to: '/tools', label: 'nav.tools', icon: <Wrench size={17} /> },
      { to: '/leaderboard', label: 'nav.leaderboard', icon: <Trophy size={17} /> }
    ]
  }
]

function AccountSwitcher() {
  const settings = useApp((s) => s.settings)!
  const data = useApp((s) => s.data)
  const setSettings = useApp((s) => s.setSettings)
  const reload = useApp((s) => s.reloadData)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const t = useT()
  const acc = data?.account
  if (!acc) return null
  return (
    <div className="no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-ink2 hover:bg-panel2 hover:text-ink"
      >
        <ProfileIcon id={acc.profileIconId} size={22} />
        <span dir="ltr" className="flex max-w-56 items-center">
          <span className="truncate font-medium">{acc.gameName}</span>
          <span className="text-muted">#{acc.tagLine}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          className="absolute end-0 top-10 z-40 w-72 rounded-xl border border-line2 bg-panel p-1.5 shadow-2xl"
          onMouseLeave={() => setOpen(false)}
        >
          {settings.accounts.map((a) => (
            <button
              key={a.puuid}
              onClick={async () => {
                setOpen(false)
                setSettings(await window.api.setActiveAccount(a.puuid))
                await reload()
              }}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-panel2',
                a.puuid === acc.puuid && 'bg-panel2'
              )}
            >
              <ProfileIcon id={a.profileIconId} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink" dir="ltr">
                  {a.gameName} <span className="text-muted">#{a.tagLine}</span>
                </div>
                <div className="text-[11px] text-muted">
                  {a.demo ? 'DEMO' : PLATFORMS.find((p) => p.id === a.platform)?.label}
                </div>
              </div>
              {a.puuid === acc.puuid && <CheckCircle2 size={15} className="text-accent" />}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}
            className="w-full rounded-lg px-2.5 py-2 text-start text-sm text-ink2 hover:bg-panel2"
          >
            {t('layout.manageAccounts')}
          </button>
        </div>
      )}
    </div>
  )
}

function ClientPill() {
  const lcu = useApp((s) => s.lcu)
  const live = useApp((s) => s.live)
  const t = useT()
  const label = live
    ? t('layout.inGame')
    : lcu.connected
      ? lcu.phase === 'ChampSelect'
        ? t('layout.champSelect')
        : lcu.phase === 'Matchmaking'
          ? t('layout.inQueue')
          : t('layout.clientConnected')
      : t('layout.clientOffline')
  return (
    <div
      title={t('layout.clientHint')}
      className={clsx(
        'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold',
        live || lcu.connected ? 'border-good/30 bg-good/10 text-good' : 'border-line2 bg-panel2 text-muted'
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', live || lcu.connected ? 'bg-good pulse-dot' : 'bg-muted')} />
      {label}
    </div>
  )
}

function SyncButton() {
  const syncing = useApp((s) => s.syncing)
  const progress = useApp((s) => s.progress)
  const runSync = useApp((s) => s.runSync)
  const toast = useApp((s) => s.toast)
  const data = useApp((s) => s.data)
  const t = useT()
  const label =
    syncing && progress?.stage === 'matches'
      ? t('layout.syncProgress', { done: progress.done, total: progress.total })
      : syncing
        ? t('layout.syncing')
        : t('layout.sync')
  return (
    <button
      disabled={syncing}
      onClick={async () => {
        const res = await runSync()
        if (!res.ok) toast(t.err(res.error), 'error')
        else toast(t('layout.syncDone', { count: res.newMatches }), 'success')
      }}
      title={data?.lastSync ? t('layout.lastSync', { ago: timeAgo(data.lastSync, t.lang) }) : undefined}
      className="no-drag flex h-8 items-center gap-2 rounded-lg border border-line2 bg-panel2 px-3 text-xs font-semibold text-ink hover:bg-panel3 disabled:opacity-70"
    >
      {syncing ? <Spinner size={13} /> : <RefreshCw size={14} />}
      {label}
    </button>
  )
}

function SidebarRank() {
  const { solo } = useAnalysis()
  const t = useT()
  return (
    <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-line bg-gradient-to-br from-panel2 to-panel px-3 py-3">
      <div className="flex h-11 w-11 items-center justify-center">
        <RankEmblem tier={solo?.tier} size={40} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t('rank.soloDuo')}</div>
        {solo ? (
          <div className="truncate text-sm">
            <bdi>
              <TierText tier={solo.tier} /> <span className="text-ink2">{['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(solo.tier) ? '' : solo.rank}</span>{' '}
              <span className="text-xs text-muted tnum">{solo.leaguePoints} LP</span>
            </bdi>
          </div>
        ) : (
          <div className="text-sm text-muted">{t('rank.unranked')}</div>
        )}
      </div>
    </div>
  )
}

function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-96 flex-col gap-2">
      {toasts.map((tst) => (
        <div
          key={tst.id}
          onClick={() => dismiss(tst.id)}
          className={clsx(
            'fade-in pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-xl border bg-panel px-3.5 py-3 text-sm shadow-2xl',
            tst.kind === 'success' && 'border-good/40',
            tst.kind === 'error' && 'border-bad/40',
            tst.kind === 'warn' && 'border-warn/40',
            tst.kind === 'info' && 'border-line2'
          )}
        >
          <span className="mt-0.5">
            {tst.kind === 'success' && <CheckCircle2 size={16} className="text-good" />}
            {tst.kind === 'error' && <XCircle size={16} className="text-bad" />}
            {tst.kind === 'warn' && <AlertTriangle size={16} className="text-warn" />}
            {tst.kind === 'info' && <Info size={16} className="text-accent" />}
          </span>
          <span className="leading-relaxed text-ink">{tst.text}</span>
        </div>
      ))}
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const t = useT()
  const syncing = useApp((s) => s.syncing)
  const progress = useApp((s) => s.progress)
  const champSelect = useApp((s) => s.champSelect)
  const live = useApp((s) => s.live)
  return (
    <div className="flex h-full flex-col">
      {/* Title bar (window controls overlay sits on the physical right on Windows) */}
      <header className="drag relative flex h-10 shrink-0 items-center gap-3 border-b border-line bg-bg ps-3" style={{ paddingRight: 150 }}>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-gold to-[#8a6d35] text-[#1a1408]">
            <Crown size={14} strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-wide text-gold2">Rift Coach</span>
          <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{t('layout.tagline')}</span>
        </div>
        <div className="flex-1" />
        <ClientPill />
        <SyncButton />
        <AccountSwitcher />
        {syncing && progress?.stage === 'matches' && progress.total > 0 && (
          <div className="absolute inset-x-0 bottom-0">
            <Progress value={progress.done} max={progress.total} className="h-0.5 rounded-none" />
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-e border-line bg-bg pt-3">
          <SidebarRank />
          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {NAV.map((g) => (
              <div key={g.group} className="mb-3">
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{t(g.group)}</div>
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'group relative mb-0.5 flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                        isActive ? 'bg-panel2 text-ink' : 'text-ink2 hover:bg-panel hover:text-ink'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-gold" />}
                        <span className={isActive ? 'text-gold' : 'text-muted group-hover:text-ink2'}>{it.icon}</span>
                        {t(it.label)}
                        {it.to === '/champ-select' && champSelect && <span className="ms-auto h-2 w-2 rounded-full bg-good pulse-dot" />}
                        {it.to === '/live' && live && <span className="ms-auto h-2 w-2 rounded-full bg-bad pulse-dot" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-line p-3">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                clsx(
                  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium',
                  isActive ? 'bg-panel2 text-ink' : 'text-ink2 hover:bg-panel hover:text-ink'
                )
              }
            >
              <SettingsIcon size={17} className="text-muted" />
              {t('nav.settings')}
            </NavLink>
            <div className="mt-2 flex items-center gap-1.5 px-2.5 text-[10px] text-muted">
              <Gauge size={11} /> v1.0 · {t('layout.notAffiliated')}
            </div>
          </div>
        </aside>

        <main className="bg-hero min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] px-7 py-6">{children}</div>
        </main>
      </div>
      <Toasts />
    </div>
  )
}
