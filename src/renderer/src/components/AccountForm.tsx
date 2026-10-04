import { KeyRound, MonitorSmartphone, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { PLATFORMS } from '@shared/constants'
import type { Account, PlatformId } from '@shared/types'
import { useT } from '@/i18n'
import { useApp } from '@/store/app'
import { ProfileIcon } from './game'
import { Button, Field, Input, Select } from './ui'

/** API key + Riot ID form used by onboarding and settings. */
export function ApiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const t = useT()
  const settings = useApp((s) => s.settings)!
  const setSettings = useApp((s) => s.setSettings)
  const toast = useApp((s) => s.toast)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const expired = settings.apiKeySetAt != null && Date.now() - settings.apiKeySetAt > 24 * 3600000
  return (
    <div className="space-y-2">
      <Field
        label={t('settings.apiKey')}
        hint={
          <>
            {t('settings.apiKeyHint')}{' '}
            <button className="text-accent hover:underline" onClick={() => void window.api.openExternal('https://developer.riotgames.com/')}>
              developer.riotgames.com
            </button>
          </>
        }
      >
        <div className="flex gap-2">
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={settings.hasApiKey ? `RGAPI-••••••••${settings.apiKeyHint}` : 'RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
          />
          <Button
            variant="primary"
            icon={<KeyRound size={15} />}
            loading={busy}
            disabled={!key.trim()}
            onClick={async () => {
              setBusy(true)
              const r = await window.api.setApiKey(key)
              setBusy(false)
              if (r.ok) {
                setSettings(r.data)
                setKey('')
                toast(t('settings.apiKeySaved'), 'success')
                onSaved?.()
              } else toast(t.err(r.error), 'error')
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </Field>
      {settings.hasApiKey && expired && <div className="text-xs text-warn">{t('settings.apiKeyOld')}</div>}
    </div>
  )
}

export function RiotIdForm({ onAdded }: { onAdded?: (a: Account) => void }) {
  const t = useT()
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)!
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState<PlatformId>('euw1')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<Account | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={riotId} onChange={(e) => setRiotId(e.target.value)} placeholder={t('settings.riotIdPh')} />
        <Select<PlatformId> value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))} />
        <Button
          icon={<UserPlus size={15} />}
          loading={busy}
          disabled={!riotId.includes('#') || !settings.hasApiKey}
          onClick={async () => {
            const [gameName, tagLine] = riotId.split('#')
            setBusy(true)
            const r = await window.api.resolveAccount(gameName, tagLine, platform)
            setBusy(false)
            if (r.ok) setFound(r.data)
            else toast(t.err(r.error), 'error')
          }}
        >
          {t('settings.find')}
        </Button>
      </div>
      {!settings.hasApiKey && <div className="text-xs text-muted">{t('settings.needKeyFirst')}</div>}
      {found && (
        <div className="flex items-center gap-3 rounded-xl border border-good/30 bg-good/5 px-3 py-2.5">
          <ProfileIcon id={found.profileIconId} size={36} />
          <div className="flex-1">
            <div className="font-semibold">
              {found.gameName} <span className="text-muted">#{found.tagLine}</span>
            </div>
            <div className="text-xs text-muted">
              Lv {found.summonerLevel} · {PLATFORMS.find((p) => p.id === found.platform)?.label}
            </div>
          </div>
          <Button variant="primary" onClick={() => onAdded?.(found)}>
            {t('settings.addThis')}
          </Button>
        </div>
      )}
    </div>
  )
}

export function DetectFromClient({ onFound }: { onFound: (a: Account) => void }) {
  const t = useT()
  const lcu = useApp((s) => s.lcu)
  const toast = useApp((s) => s.toast)
  const [busy, setBusy] = useState(false)
  return (
    <Button
      icon={<MonitorSmartphone size={15} />}
      loading={busy}
      disabled={!lcu.connected}
      title={!lcu.connected ? t('settings.clientNotDetected') : undefined}
      onClick={async () => {
        setBusy(true)
        const r = await window.api.detectAccountFromClient()
        setBusy(false)
        if (r.ok) onFound(r.data)
        else toast(t.err(r.error), 'error')
      }}
    >
      {lcu.connected ? t('settings.detectFromClient') : t('settings.clientNotDetected')}
    </Button>
  )
}
