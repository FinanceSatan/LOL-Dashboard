import clsx from 'clsx'
import { ArrowDownToLine, CheckCircle2, ExternalLink, RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n'
import { ltr, timeAgo } from '@/lib/format'
import { useApp } from '@/store/app'
import { Badge, Button, Card, Progress, Toggle } from './ui'

/** Banner on top of every page while an update is downloading or ready to install. */
export function UpdateBanner() {
  const t = useT()
  const update = useApp((s) => s.update)
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (!update?.version || dismissed === `${update.state}:${update.version}`) return null
  const v = ltr(`v${update.version}`)

  if (update.state === 'downloaded') {
    return (
      <div className="fade-in mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-good/40 bg-good/10 px-4 py-3">
        <CheckCircle2 size={18} className="text-good" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{t('update.readyTitle', { version: v })}</div>
          <div className="text-xs text-ink2">{t('update.readyBody')}</div>
        </div>
        <Button variant="primary" size="sm" icon={<RotateCcw size={14} />} onClick={() => void window.api.installUpdate()}>
          {t('update.restartNow')}
        </Button>
        <button onClick={() => setDismissed(`${update.state}:${update.version}`)} className="rounded p-1 text-muted hover:text-ink" title={t('update.later')}>
          <X size={15} />
        </button>
      </div>
    )
  }
  if (update.state === 'available') {
    return (
      <div className="fade-in mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
        <Sparkles size={18} className="text-accent" />
        <div className="min-w-0 flex-1 text-sm font-semibold text-ink">{t('update.availableTitle', { version: v })}</div>
        {update.portable ? (
          <Button size="sm" variant="primary" icon={<ExternalLink size={14} />} onClick={() => void window.api.openExternal(update.releaseUrl)}>
            {t('update.openDownload')}
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<ArrowDownToLine size={14} />} onClick={() => void window.api.downloadUpdate()}>
            {t('update.download')}
          </Button>
        )}
        <button onClick={() => setDismissed(`${update.state}:${update.version}`)} className="rounded p-1 text-muted hover:text-ink">
          <X size={15} />
        </button>
      </div>
    )
  }
  if (update.state === 'downloading') {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5">
        <ArrowDownToLine size={16} className="text-accent" />
        <span className="text-xs text-ink2">{t('update.downloadingTitle', { version: v })}</span>
        <Progress value={update.progress ?? 0} max={100} className="max-w-60 flex-1" />
        <span className="text-xs text-muted tnum">{ltr(`${update.progress ?? 0}%`)}</span>
      </div>
    )
  }
  return null
}

/** Settings card: current version, status, manual check and the auto-update switch. */
export function UpdateCard() {
  const t = useT()
  const update = useApp((s) => s.update)
  const settings = useApp((s) => s.settings)!
  const saveSettings = useApp((s) => s.saveSettings)
  const appVersion = useApp((s) => s.appVersion)
  const [busy, setBusy] = useState(false)
  const state = update?.state ?? 'idle'

  const check = async () => {
    setBusy(true)
    await window.api.checkForUpdates()
    setBusy(false)
  }

  return (
    <Card title={t('update.title')} icon={<RefreshCw size={15} />} subtitle={t('update.subtitle')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[11px] text-muted">{t('update.current')}</div>
            <div className="text-lg font-bold tnum">{ltr(`v${appVersion}`)}</div>
          </div>
          <div className="ms-auto">
            <Badge
              tone={
                state === 'downloaded' || state === 'none'
                  ? 'good'
                  : state === 'error'
                    ? 'bad'
                    : state === 'available' || state === 'downloading'
                      ? 'accent'
                      : 'neutral'
              }
            >
              {t.d(`update.state.${state}`, { version: update?.version ? ltr(`v${update.version}`) : '' })}
            </Badge>
          </div>
        </div>

        {state === 'downloading' && <Progress value={update?.progress ?? 0} max={100} />}
        {state === 'error' && update?.error && <div className="text-xs leading-relaxed text-bad">{t.err(update.error)}</div>}
        {update?.portable && <div className="text-xs leading-relaxed text-muted">{t('update.portableHint')}</div>}
        {update?.notes && (state === 'available' || state === 'downloading' || state === 'downloaded') && (
          <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-lg border border-line bg-bg/50 p-3 text-xs leading-relaxed text-ink2" dir="auto">
            {update.notes}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {state === 'downloaded' ? (
            <Button variant="primary" icon={<RotateCcw size={14} />} onClick={() => void window.api.installUpdate()}>
              {t('update.restartNow')}
            </Button>
          ) : state === 'available' && update?.portable ? (
            <Button variant="primary" icon={<ExternalLink size={14} />} onClick={() => void window.api.openExternal(update.releaseUrl)}>
              {t('update.openDownload')}
            </Button>
          ) : state === 'available' ? (
            <Button variant="primary" icon={<ArrowDownToLine size={14} />} onClick={() => void window.api.downloadUpdate()}>
              {t('update.download')}
            </Button>
          ) : null}
          <Button
            icon={<RefreshCw size={14} />}
            loading={busy || state === 'checking'}
            disabled={state === 'disabled' || state === 'downloading'}
            onClick={() => void check()}
          >
            {t('update.checkNow')}
          </Button>
          {update?.checkedAt && <span className="text-[11px] text-muted">{t('update.lastChecked', { ago: timeAgo(update.checkedAt, t.lang) })}</span>}
        </div>

        <div className={clsx('border-t border-line pt-4', update?.portable && 'opacity-60')}>
          <Toggle
            checked={settings.autoUpdate}
            onChange={(v) => void saveSettings({ autoUpdate: v })}
            label={t('update.auto')}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t('update.autoHint')}</p>
        </div>
      </div>
    </Card>
  )
}
