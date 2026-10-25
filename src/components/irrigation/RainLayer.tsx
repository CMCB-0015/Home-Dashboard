// Decorative rain over the Irrigation card while a zone waters. Carries no
// information. Styles: the "rain" block at the end of src/index.css.
// [left %, delay s, duration s] — positions past 100% are intentional: streaks drift left as they fall
const STREAKS: [number, number, number][] = [
  [6, 0, 1.4], [17, 0.7, 1.7], [27, 0.3, 1.4], [39, 1.1, 1.6], [49, 0.5, 1.3], [60, 0.9, 1.4],
  [71, 0.2, 1.8], [81, 1.3, 1.5], [92, 0.6, 1.4], [103, 1.0, 1.6], [113, 0.4, 1.3],
]

export function RainLayer({ active }: { active: boolean }) {
  return (
    <div aria-hidden className={`rain-layer${active ? ' is-on' : ''}`}>
      {STREAKS.map(([left, delay, dur], i) => (
        <span key={i} className="rain-col" style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
      ))}
    </div>
  )
}
