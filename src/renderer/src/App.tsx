import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { useT } from './i18n'
import { Analytics } from './pages/Analytics'
import { ChampSelect } from './pages/ChampSelect'
import { Champions } from './pages/Champions'
import { Coach } from './pages/Coach'
import { Dashboard } from './pages/Dashboard'
import { Goals } from './pages/Goals'
import { Journal } from './pages/Journal'
import { Leaderboard } from './pages/Leaderboard'
import { LiveGame } from './pages/LiveGame'
import { Matches } from './pages/Matches'
import { Onboarding } from './pages/Onboarding'
import { Overlay } from './pages/Overlay'
import { SettingsPage } from './pages/Settings'
import { Tools } from './pages/Tools'
import { useApp } from './store/app'
import { usePostGameWatcher } from './lib/notifications'

function Bridge() {
  const navigate = useNavigate()
  usePostGameWatcher()
  useEffect(() => window.api.on('navigate', (path) => navigate(path)), [navigate])
  return null
}

function DataLoader({ reload }: { reload: () => Promise<void> }) {
  useEffect(() => {
    void reload()
  }, [reload])
  return (
    <div className="flex h-full items-center justify-center text-gold">
      <Spinner size={28} />
    </div>
  )
}

function Shell() {
  const ready = useApp((s) => s.ready)
  const settings = useApp((s) => s.settings)
  const data = useApp((s) => s.data)
  const init = useApp((s) => s.init)
  const reloadData = useApp((s) => s.reloadData)
  const t = useT()
  const location = useLocation()
  const isOverlay = location.pathname === '/overlay'

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.lang = t.lang
    document.documentElement.dir = t.dir
    if (isOverlay) document.documentElement.classList.add('overlay-root')
  }, [t.lang, t.dir, isOverlay])

  if (isOverlay) return ready ? <Overlay /> : null

  if (!ready || !settings) {
    return (
      <div className="flex h-full items-center justify-center text-gold">
        <Spinner size={28} />
      </div>
    )
  }

  const needsOnboarding = !settings.onboarded || settings.accounts.length === 0
  if (needsOnboarding) return <Onboarding />
  if (!data) return <DataLoader reload={reloadData} />

  return (
    <Layout>
      <Bridge />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/matches/:matchId" element={<Matches />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/champions" element={<Champions />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/champ-select" element={<ChampSelect />} />
        <Route path="/live" element={<LiveGame />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
