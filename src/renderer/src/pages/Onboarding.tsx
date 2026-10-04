import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Crown, FlaskConical, KeyRound, MonitorSmartphone } from 'lucide-react'
import { useState } from 'react'
import { RIOT_DISCLAIMER } from '@shared/constants'
import type { Account } from '@shared/types'
import { ApiKeyForm, DetectFromClient, RiotIdForm } from '@/components/AccountForm'
import { Button, Segmented } from '@/components/ui'
import { useT } from '@/i18n'
import { useApp } from '@/store/app'

type Mode = 'riot' | 'client' | 'demo'

export function Onboarding() {
  const t = useT()
  const settings = useApp((s) => s.settings)!
  const saveSettings = useApp((s) => s.saveSettings)
  const setSettings = useApp((s) => s.setSettings)
  const reloadData = useApp((s) => s.reloadData)
  const runSync = useApp((s) => s.runSync)
  const lcu = useApp((s) => s.lcu)
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<Mode>('riot')

  const finish = async (acc: Account, source: 'riot' | 'client') => {
    setSettings(await window.api.addAccount(acc))
    await reloadData()
    await saveSettings({ onboarded: true, dataSource: source })
    if (!acc.demo) void runSync()
  }

  const Arrow = t.dir === 'rtl' ? ArrowLeft : ArrowRight

  return (
    <div className="bg-hero flex h-full flex-col">
      <div className="drag h-10 shrink-0" />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="fade-in w-full max-w-2xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-[#7a5d2a] text-[#1a1408] shadow-xl">
              <Crown size={34} strokeWidth={2.2} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-gold2">Rift Coach</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink2">{t('onb.tagline')}</p>
          </div>

          {step === 0 && (
            <div className="rounded-2xl border border-line bg-panel p-6 card-glow">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-sm font-semibold">{t('onb.language')}</div>
                <Segmented
                  value={settings.language}
                  onChange={(v) => void saveSettings({ language: v })}
                  options={[
                    { value: 'fa', label: 'فارسی' },
                    { value: 'en', label: 'English' }
                  ]}
                />
              </div>
              <ul className="space-y-2.5 text-sm text-ink2">
                {t.arr('onb.features').map((f, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex justify-end">
                <Button variant="gold" size="lg" onClick={() => setStep(1)}>
                  {t('onb.start')} <Arrow size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="rounded-2xl border border-line bg-panel p-6 card-glow">
              <div className="mb-4 text-sm font-semibold">{t('onb.howConnect')}</div>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { m: 'riot', icon: <KeyRound size={20} />, title: t('onb.riot'), body: t('onb.riotBody') },
                    { m: 'client', icon: <MonitorSmartphone size={20} />, title: t('onb.client'), body: t('onb.clientBody') },
                    { m: 'demo', icon: <FlaskConical size={20} />, title: t('onb.demo'), body: t('onb.demoBody') }
                  ] as const
                ).map((o) => (
                  <button
                    key={o.m}
                    onClick={() => setMode(o.m)}
                    className={clsx(
                      'rounded-xl border p-4 text-start transition-colors',
                      mode === o.m ? 'border-gold bg-gold/5' : 'border-line bg-panel2/40 hover:bg-panel2'
                    )}
                  >
                    <div className={clsx('mb-2', mode === o.m ? 'text-gold' : 'text-muted')}>{o.icon}</div>
                    <div className="text-sm font-semibold">{o.title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-muted">{o.body}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 border-t border-line pt-5">
                {mode === 'riot' && (
                  <div className="space-y-4">
                    <ApiKeyForm />
                    <RiotIdForm onAdded={(acc) => void finish(acc, 'riot')} />
                  </div>
                )}
                {mode === 'client' && (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-muted">{t('onb.clientSteps')}</p>
                    <div className="flex items-center gap-3">
                      <DetectFromClient onFound={(acc) => void finish(acc, 'client')} />
                      <span className={clsx('text-xs', lcu.connected ? 'text-good' : 'text-muted')}>
                        {lcu.connected ? t('layout.clientConnected') : t('onb.waitingClient')}
                      </span>
                    </div>
                  </div>
                )}
                {mode === 'demo' && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs leading-relaxed text-muted">{t('onb.demoSteps')}</p>
                    <Button
                      variant="gold"
                      onClick={async () => {
                        setSettings(await window.api.useDemo())
                        await reloadData()
                        await saveSettings({ onboarded: true })
                      }}
                    >
                      {t('onb.openDemo')}
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-5">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  {t('common.back')}
                </Button>
              </div>
            </div>
          )}
          <p className="mx-auto mt-6 max-w-xl text-center text-[10px] leading-relaxed text-muted" dir="ltr">
            {RIOT_DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  )
}
