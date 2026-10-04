import { Database, Download, FolderOpen, Gamepad2, Globe, HeartPulse, Info, Layers, LineChart, Trash2, Upload, UserCog } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PLATFORMS, RIOT_DISCLAIMER, TIERS } from '@shared/constants'
import { ROLES, type AppInfo, type OverlaySettings, type Role, type Settings, type Tier } from '@shared/types'
import { ApiKeyForm, DetectFromClient, RiotIdForm } from '@/components/AccountForm'
import { ProfileIcon } from '@/components/game'
import { UpdateCard } from '@/components/Update'
import { Badge, Button, Card, Field, Input, PageHeader, Segmented, Select, Toggle } from '@/components/ui'
import { useT } from '@/i18n'
import { ltr } from '@/lib/format'
import { useApp } from '@/store/app'

export function SettingsPage() {
  const t = useT()
  const settings = useApp((s) => s.settings)!
  const saveSettings = useApp((s) => s.saveSettings)
  const setSettings = useApp((s) => s.setSettings)
  const reloadData = useApp((s) => s.reloadData)
  const toast = useApp((s) => s.toast)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [path, setPath] = useState(settings.leaguePath)
  const [proxy, setProxy] = useState(settings.proxy)

  useEffect(() => {
    void window.api.appInfo().then(setInfo)
  }, [])

  const save = (patch: Partial<Settings>) => void saveSettings(patch)
  const saveOverlay = (patch: Partial<OverlaySettings>) => void saveSettings({ overlay: { ...settings.overlay, ...patch } })

  return (
    <div className="fade-in space-y-5">
      <PageHeader title={t('nav.settings')} subtitle={t('settings.subtitle')} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 xl:col-span-7">
          <Card title={t('settings.accounts')} icon={<UserCog size={15} />}>
            <div className="space-y-2">
              {settings.accounts.map((acc) => (
                <div key={acc.puuid} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/40 px-3 py-2">
                  <ProfileIcon id={acc.profileIconId} size={32} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      <bdi>
                        {acc.gameName}
                        <span className="text-muted">#{acc.tagLine}</span>
                      </bdi>
                    </div>
                    <div className="text-[11px] text-muted">{acc.demo ? 'DEMO' : PLATFORMS.find((p) => p.id === acc.platform)?.label}</div>
                  </div>
                  {acc.puuid === settings.activePuuid ? (
                    <Badge tone="good">{t('settings.active')}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        setSettings(await window.api.setActiveAccount(acc.puuid))
                        await reloadData()
                      }}
                    >
                      {t('settings.switch')}
                    </Button>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm(t('settings.removeConfirm'))) return
                      setSettings(await window.api.removeAccount(acc.puuid))
                      await reloadData()
                    }}
                    className="rounded p-1.5 text-muted hover:bg-panel3 hover:text-bad"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="text-xs font-semibold text-ink2">{t('settings.addAccount')}</div>
              <RiotIdForm
                onAdded={async (acc) => {
                  setSettings(await window.api.addAccount(acc))
                  await reloadData()
                  toast(t('settings.accountAdded'), 'success')
                }}
              />
              <div className="flex flex-wrap gap-2">
                <DetectFromClient
                  onFound={async (acc) => {
                    setSettings(await window.api.addAccount(acc))
                    await reloadData()
                    toast(t('settings.accountAdded'), 'success')
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={async () => {
                    setSettings(await window.api.useDemo())
                    await reloadData()
                  }}
                >
                  {t('settings.addDemo')}
                </Button>
              </div>
            </div>
          </Card>

          <Card title={t('settings.dataSource')} icon={<Database size={15} />}>
            <div className="space-y-4">
              <Segmented
                value={settings.dataSource}
                onChange={(v) => save({ dataSource: v })}
                options={[
                  { value: 'riot', label: t('settings.sourceRiot') },
                  { value: 'client', label: t('settings.sourceClient') }
                ]}
              />
              <p className="text-xs leading-relaxed text-muted">{t(settings.dataSource === 'riot' ? 'settings.sourceRiotHint' : 'settings.sourceClientHint')}</p>
              <ApiKeyForm />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('settings.initialSync')} hint={t('settings.initialSyncHint')}>
                  <Select<number>
                    className="w-full"
                    value={settings.initialSyncCount}
                    onChange={(v) => save({ initialSyncCount: v })}
                    options={[20, 40, 60, 100, 150, 200].map((n) => ({ value: n, label: `${n}` }))}
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <Toggle checked={settings.autoSyncAfterGame} onChange={(v) => save({ autoSyncAfterGame: v })} label={t('settings.autoSync')} />
                </div>
              </div>
            </div>
          </Card>

          <Card title={t('settings.analysis')} icon={<LineChart size={15} />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('settings.queues')}>
                <Select<Settings['analysisQueues']>
                  className="w-full"
                  value={settings.analysisQueues}
                  onChange={(v) => save({ analysisQueues: v })}
                  options={[
                    { value: 'solo', label: t('settings.queuesSolo') },
                    { value: 'ranked', label: t('settings.queuesRanked') },
                    { value: 'all', label: t('settings.queuesAll') }
                  ]}
                />
              </Field>
              <Field label={t('settings.window')} hint={t('settings.windowHint')}>
                <Select<number>
                  className="w-full"
                  value={settings.analysisWindow}
                  onChange={(v) => save({ analysisWindow: v })}
                  options={[10, 20, 30, 50, 100].map((n) => ({ value: n, label: `${n}` }))}
                />
              </Field>
              <Field label={t('settings.targetTier')} hint={t('settings.targetTierHint')}>
                <Select<Tier>
                  className="w-full"
                  value={settings.targetTier}
                  onChange={(v) => save({ targetTier: v })}
                  options={TIERS.map((x) => ({ value: x, label: x.charAt(0) + x.slice(1).toLowerCase() }))}
                />
              </Field>
              <Field label={t('settings.mainRole')}>
                <Select<Role | 'AUTO'>
                  className="w-full"
                  value={settings.mainRole}
                  onChange={(v) => save({ mainRole: v })}
                  options={[{ value: 'AUTO', label: t('settings.auto') }, ...ROLES.map((r) => ({ value: r, label: t.d(`role.${r}`) }))]}
                />
              </Field>
              <Field label={t('settings.csTarget')} hint={t('settings.csTargetHint')}>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.csTargetPerMin}
                  onChange={(e) => save({ csTargetPerMin: Number(e.target.value) || 8 })}
                />
              </Field>
            </div>
          </Card>

          <Card title={t('settings.client')} icon={<Gamepad2 size={15} />}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <Toggle checked={settings.autoAccept} onChange={(v) => save({ autoAccept: v })} label={t('settings.autoAccept')} />
                <Toggle checked={settings.openChampSelect} onChange={(v) => save({ openChampSelect: v })} label={t('settings.openChampSelect')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('settings.acceptDelay')}>
                  <Select<number>
                    className="w-full"
                    value={settings.autoAcceptDelay}
                    onChange={(v) => save({ autoAcceptDelay: v })}
                    options={[0, 1, 2, 3, 5, 8].map((n) => ({ value: n, label: `${n}s` }))}
                  />
                </Field>
                <div className="col-span-2">
                  <Field label={t('settings.leaguePath')} hint={t('settings.leaguePathHint')}>
                    <div className="flex gap-2">
                      <Input value={path} onChange={(e) => setPath(e.target.value)} dir="ltr" />
                      <Button onClick={() => save({ leaguePath: path })}>{t('common.save')}</Button>
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 space-y-4 xl:col-span-5">
          <Card title={t('settings.app')} icon={<Globe size={15} />}>
            <div className="space-y-4">
              <Field label={t('settings.language')}>
                <Segmented
                  value={settings.language}
                  onChange={(v) => save({ language: v })}
                  options={[
                    { value: 'fa', label: 'فارسی' },
                    { value: 'en', label: 'English' }
                  ]}
                />
              </Field>
              <Toggle checked={settings.minimizeToTray} onChange={(v) => save({ minimizeToTray: v })} label={t('settings.tray')} />
              <Field label={t('settings.proxy')} hint={t('settings.proxyHint')}>
                <div className="flex gap-2">
                  <Input value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="http://127.0.0.1:10809" dir="ltr" />
                  <Button
                    onClick={() => {
                      save({ proxy })
                      toast(t('settings.proxySaved'), 'success')
                    }}
                  >
                    {t('common.save')}
                  </Button>
                </div>
              </Field>
            </div>
          </Card>

          <Card title={t('settings.overlay')} icon={<Layers size={15} />} subtitle={t('settings.overlayHint')}>
            <div className="space-y-4">
              <Toggle checked={settings.overlay.enabled} onChange={(v) => saveOverlay({ enabled: v })} label={t('settings.overlayEnable')} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('settings.overlayPos')}>
                  <Select<OverlaySettings['position']>
                    className="w-full"
                    value={settings.overlay.position}
                    onChange={(v) => saveOverlay({ position: v })}
                    options={(['top-left', 'top-right', 'middle-right', 'bottom-left', 'bottom-right'] as const).map((p) => ({ value: p, label: t.d(`pos.${p}`) }))}
                  />
                </Field>
                <Field label={`${t('settings.overlayOpacity')}: ${ltr(`${Math.round(settings.overlay.opacity * 100)}%`)}`}>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    value={Math.round(settings.overlay.opacity * 100)}
                    onChange={(e) => saveOverlay({ opacity: Number(e.target.value) / 100 })}
                    className="no-drag mt-2 w-full accent-[#c8aa6e]"
                  />
                </Field>
                <Field label={`${t('settings.overlayScale')}: ${ltr(`${settings.overlay.scale.toFixed(1)}x`)}`}>
                  <input
                    type="range"
                    min={8}
                    max={14}
                    value={Math.round(settings.overlay.scale * 10)}
                    onChange={(e) => saveOverlay({ scale: Number(e.target.value) / 10 })}
                    className="no-drag mt-2 w-full accent-[#c8aa6e]"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-5">
                <Toggle checked={settings.overlay.showTimers} onChange={(v) => saveOverlay({ showTimers: v })} label={t('settings.overlayTimers')} />
                <Toggle checked={settings.overlay.showCsPace} onChange={(v) => saveOverlay({ showCsPace: v })} label={t('settings.overlayCs')} />
              </div>
              <Button onClick={() => void window.api.previewOverlay()}>{t('live.previewOverlay')}</Button>
            </div>
          </Card>

          <Card title={t('settings.tilt')} icon={<HeartPulse size={15} />} subtitle={t('settings.tiltHint')}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-5">
                <Toggle checked={settings.tilt.enabled} onChange={(v) => save({ tilt: { ...settings.tilt, enabled: v } })} label={t('settings.tiltEnable')} />
                <Toggle checked={settings.tilt.notify} onChange={(v) => save({ tilt: { ...settings.tilt, notify: v } })} label={t('settings.tiltNotify')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('settings.lossStreak')}>
                  <Select<number>
                    className="w-full"
                    value={settings.tilt.lossStreak}
                    onChange={(v) => save({ tilt: { ...settings.tilt, lossStreak: v } })}
                    options={[2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }))}
                  />
                </Field>
                <Field label={t('settings.maxGames')}>
                  <Select<number>
                    className="w-full"
                    value={settings.tilt.maxGamesPerDay}
                    onChange={(v) => save({ tilt: { ...settings.tilt, maxGamesPerDay: v } })}
                    options={[3, 4, 5, 6, 8, 10, 12, 15].map((n) => ({ value: n, label: `${n}` }))}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <UpdateCard />

          <Card title={t('settings.data')} icon={<Database size={15} />}>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<Download size={14} />}
                onClick={async () => {
                  const r = await window.api.exportData()
                  if (r.ok) toast(t('settings.exported'), 'success')
                  else if (r.error !== 'CANCELLED') toast(t.err(r.error), 'error')
                }}
              >
                {t('settings.export')}
              </Button>
              <Button
                icon={<Upload size={14} />}
                onClick={async () => {
                  const r = await window.api.importData()
                  if (r.ok) {
                    setSettings(await window.api.getSettings())
                    await reloadData()
                    toast(t('settings.imported'), 'success')
                  } else if (r.error !== 'CANCELLED') toast(t.err(r.error), 'error')
                }}
              >
                {t('settings.import')}
              </Button>
              <Button icon={<FolderOpen size={14} />} onClick={() => void window.api.openDataFolder()}>
                {t('settings.openFolder')}
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={async () => {
                  await window.api.clearCache()
                  toast(t('settings.cacheCleared'), 'success')
                }}
              >
                {t('settings.clearCache')}
              </Button>
            </div>
            {info && (
              <div className="mt-3 truncate text-[11px] text-muted" dir="ltr">
                {info.dataPath}
              </div>
            )}
          </Card>

          <Card title={t('settings.about')} icon={<Info size={15} />}>
            <div className="space-y-2 text-xs leading-relaxed text-muted">
              <div className="text-sm font-semibold text-ink">
                Rift Coach <span className="text-muted">v{info?.version}</span>
              </div>
              <p>{t('settings.aboutText')}</p>
              <p dir="ltr" className="text-[11px]">
                {RIOT_DISCLAIMER}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
