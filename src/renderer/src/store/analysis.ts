import { useMemo } from 'react'
import { filterForAnalysis, mainRole } from '@/lib/analytics'
import { useApp } from './app'

/** Shared, memoized view of the match data according to the analysis settings. */
export function useAnalysis() {
  const data = useApp((s) => s.data)
  const settings = useApp((s) => s.settings)
  const sd = useApp((s) => s.staticData)
  return useMemo(() => {
    const all = data?.matches ?? []
    const queues = settings?.analysisQueues ?? 'solo'
    let filtered = filterForAnalysis(all, queues)
    // fall back to every Summoner's Rift game if the chosen queue has too few games
    if (filtered.length < 5 && queues !== 'all') filtered = filterForAnalysis(all, 'all')
    const windowed = filtered.slice(0, settings?.analysisWindow ?? 30)
    const role = mainRole(filtered, settings?.mainRole ?? 'AUTO')
    const solo = data?.profile?.ranks.find((r) => r.queueType === 'RANKED_SOLO_5x5') ?? null
    const flex = data?.profile?.ranks.find((r) => r.queueType === 'RANKED_FLEX_SR') ?? null
    return {
      all,
      filtered,
      windowed,
      role,
      tier: settings?.targetTier ?? 'CHALLENGER',
      items: sd?.items,
      solo,
      flex,
      rankHistory: data?.rankHistory ?? []
    }
  }, [data, settings, sd])
}
