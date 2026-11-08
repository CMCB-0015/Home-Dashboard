import type { Tesla } from '../../types'
import { AMBER, TIRE_NAMES, agoLong, tireLimits, type TireKey } from './useTesla'

const TOP_IMG = '/images/tesla-top.png'

// Where each wheel sits on the top-down picture (front at the top), in % of its height
const AXLE = { front: 21, rear: 80 }
const SPOTS: Record<TireKey, { side: 'left' | 'right'; y: number }> = {
  fl: { side: 'left', y: AXLE.front },
  fr: { side: 'right', y: AXLE.front },
  rl: { side: 'left', y: AXLE.rear },
  rr: { side: 'right', y: AXLE.rear },
}

/**
 * The tire view on the Vehicles page card, like the Tesla app's Controls
 * screen: the car from above, each wheel's pressure and when it reported.
 * Tires only report while the car is awake, so a sleeping car shows its last
 * readings. A tire tireLowBy psi or more under the recommended turns amber.
 */
export function TireView({ t }: { t: Tesla }) {
  const { rec, lowAt } = tireLimits(t)
  const tires = t.tires
  return (
    <div className="relative my-2 min-h-[260px] flex-1">
      <img src={TOP_IMG} alt={`${t.name} seen from above`}
        className="absolute left-1/2 top-0 block h-full w-auto -translate-x-1/2 select-none" draggable={false} />
      {(Object.keys(SPOTS) as TireKey[]).map((k) => {
        const r = tires?.[k] ?? null
        const low = !!r && r.psi <= lowAt
        const { side, y } = SPOTS[k]
        return (
          <div key={k} className="absolute flex w-[30%] max-w-[118px] -translate-y-1/2 flex-col items-center gap-0.5 text-center"
            style={{ [side]: 0, top: `${y}%` }} aria-label={`${TIRE_NAMES[k]} tire`}>
            <span className="text-xl font-semibold leading-tight" style={{ color: low ? AMBER : undefined }}>
              {r ? `${r.psi} psi` : '— psi'}
            </span>
            <span className="text-xs leading-snug" style={{ color: low ? AMBER : 'var(--color-ink-dim)' }}>
              {!r ? 'Not reported' : low ? `${rec - r.psi} psi low` : agoLong(r.at)}
            </span>
          </div>
        )
      })}
      {!tires && (
        <p className="absolute inset-x-0 bottom-0 text-center text-xs text-ink-dim">
          Turn on the four Tire pressure entities in Home Assistant to see them here
        </p>
      )}
    </div>
  )
}

/** The little tire-with-psi button, like the Tesla app's */
export function PsiIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path d="M5.2 12.2a7.8 7.8 0 0 1 15.6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 9.4V5.2M10.6 10.6 7.6 8M15.4 10.6 18.4 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4.2" y="14.6" width="17.6" height="8.4" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <text x="13" y="21.2" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="6.6" fontWeight="700" fill="currentColor">psi</text>
    </svg>
  )
}
