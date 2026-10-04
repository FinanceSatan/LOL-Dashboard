import { useEffect, useRef } from 'react'
import { translate } from '@/i18n'
import { useApp } from '@/store/app'
import { currentStreak, filterForAnalysis, gameScore, gamesToday, grade } from './analytics'

function notify(title: string, body: string) {
  try {
    new Notification(title, { body, silent: false })
  } catch {
    /* notifications unavailable */
  }
}

/** Shows a post-game summary and tilt warnings whenever a new game lands in the data. */
export function usePostGameWatcher() {
  const data = useApp((s) => s.data)
  const settings = useApp((s) => s.settings)
  const toast = useApp((s) => s.toast)
  const lastSeen = useRef<{ puuid: string; id: string | null } | null>(null)

  useEffect(() => {
    if (!data || !settings) return
    const newest = data.matches[0]?.matchId ?? null
    const prev = lastSeen.current
    lastSeen.current = { puuid: data.account.puuid, id: newest }
    if (!prev || prev.puuid !== data.account.puuid || !newest || prev.id === newest) return
    const m = data.matches[0]
    if (Date.now() - (m.gameCreation + m.gameDuration * 1000) > 3 * 3600000) return

    const lang = settings.language
    const score = gameScore(m, settings.targetTier)
    const title = translate(lang, m.win ? 'notify.postgame.win' : 'notify.postgame.loss')
    const body = translate(lang, 'notify.postgame.body', {
      kda: `${m.me.kills}/${m.me.deaths}/${m.me.assists}`,
      cs: m.me.csPerMin.toFixed(1),
      grade: grade(score),
      cs10: m.laning?.csAt10 ?? '—'
    })
    toast(`${title} — ${body}`, m.win ? 'success' : 'info')
    if (settings.tilt.notify) notify(title, body)

    if (!settings.tilt.enabled) return
    const ranked = filterForAnalysis(data.matches, 'all')
    const streak = currentStreak(ranked)
    const today = gamesToday(ranked)
    if (streak.type === 'L' && streak.count >= settings.tilt.lossStreak) {
      const msg = translate(lang, 'notify.tilt.streak', { count: streak.count })
      toast(msg, 'warn')
      if (settings.tilt.notify) notify(translate(lang, 'notify.tilt.title'), msg)
    } else if (today.length >= settings.tilt.maxGamesPerDay) {
      const msg = translate(lang, 'notify.tilt.limit', { count: today.length })
      toast(msg, 'warn')
      if (settings.tilt.notify) notify(translate(lang, 'notify.tilt.title'), msg)
    }
  }, [data, settings, toast])
}
