import { useState } from 'react'
import type { MapEvent } from '@shared/types'
import { useT } from '@/i18n'
import { toMapPercent } from '@/lib/analytics'
import { clock } from '@/lib/format'
import { mapUrl } from '@/lib/dd'
import { useApp } from '@/store/app'

/** Summoner's Rift minimap with death (red X) and kill (blue dot) markers. */
export function MiniMap({
  deaths,
  kills = [],
  size = 320,
  heat = false
}: {
  deaths: MapEvent[]
  kills?: MapEvent[]
  size?: number
  heat?: boolean
}) {
  const sd = useApp((s) => s.staticData)
  const t = useT()
  const [imgFailed, setImgFailed] = useState(false)
  // dense heatmaps need fainter blobs so hot spots stay readable
  const heatAlpha = Math.max(0.07, Math.min(0.5, 8 / Math.max(1, deaths.length)))
  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-line2 bg-[#0f1a14]" style={{ width: size, height: size }} dir="ltr">
      {/* schematic Summoner's Rift, visible when the map image cannot be loaded */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect width="100" height="100" fill="#13241b" />
        <path d="M8 92 L8 12 Q8 8 12 8 L88 8" stroke="#3b4f43" strokeWidth="5" fill="none" />
        <path d="M8 92 L88 92 Q92 92 92 88 L92 8" stroke="#3b4f43" strokeWidth="5" fill="none" />
        <path d="M10 90 L90 10" stroke="#3b4f43" strokeWidth="5" />
        <path d="M18 18 Q50 40 82 82" stroke="#1d3f5c" strokeWidth="6" fill="none" opacity="0.8" />
        <circle cx="10" cy="90" r="7" fill="#1d3a66" />
        <circle cx="90" cy="10" r="7" fill="#5c1d1d" />
      </svg>
      {!imgFailed && (
        <img
          src={mapUrl(sd)}
          alt=""
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          draggable={false}
        />
      )}
      <div className="absolute inset-0 bg-bg/25" />
      {heat &&
        deaths.map((d, i) => {
          const p = toMapPercent(d.x, d.y)
          return (
            <span
              key={`h${i}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: size * 0.11,
                height: size * 0.11,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, rgba(230,103,103,${heatAlpha}) 0%, rgba(230,103,103,0) 70%)`
              }}
            />
          )
        })}
      {kills.map((k, i) => {
        const p = toMapPercent(k.x, k.y)
        return (
          <span
            key={`k${i}`}
            title={`${t('map.kill')} ${clock(k.t)}`}
            className="absolute h-2.5 w-2.5 rounded-full border-2 border-bg bg-win"
            style={{ left: `${p.left}%`, top: `${p.top}%`, transform: 'translate(-50%, -50%)' }}
          />
        )
      })}
      {!heat &&
        deaths.map((d, i) => {
          const p = toMapPercent(d.x, d.y)
          return (
            <span
              key={`d${i}`}
              title={`${t('map.death')} ${clock(d.t)}`}
              className="absolute flex h-4 w-4 items-center justify-center text-[13px] font-black leading-none text-loss"
              style={{ left: `${p.left}%`, top: `${p.top}%`, transform: 'translate(-50%, -50%)', textShadow: '0 0 3px #000' }}
            >
              ✕
            </span>
          )
        })}
    </div>
  )
}
