// Generic side-profile car shapes (no badges), tinted to the car's color.

export function CarIcon({ kind, color, width = 110 }: { kind: 'ev' | 'phev'; color: string; width?: number }) {
  const sedan = kind === 'ev'
  const h = width * (sedan ? 0.42 : 0.45)
  return (
    <svg width={width} height={h} viewBox={sedan ? '0 0 130 54' : '0 0 132 58'} aria-hidden>
      {sedan ? (
        <>
          <path d="M0 40 L4 30 L22 26 L44 10 L62 6 L86 8 L104 22 L122 26 L128 34 L128 42 L0 42 Z" fill={color} />
          <path d="M46 12 L62 9 L84 10 L98 22 L40 23 Z" fill="#0f151b" />
          {[26, 104].map((x) => <g key={x}><circle cx={x} cy={42} r={10} fill="#0a0e12" /><circle cx={x} cy={42} r={5} fill="#3a4550" /></g>)}
        </>
      ) : (
        <>
          <path d="M0 44 L2 30 L14 24 L30 22 L42 6 L96 4 L114 20 L126 24 L130 34 L130 46 L0 46 Z" fill={color} />
          <path d="M45 9 L94 7 L108 21 L38 22 Z" fill="#0f151b" />
          <rect x="69" y="7" width="3" height="15" fill={color} />
          {[26, 106].map((x) => <g key={x}><circle cx={x} cy={46} r={11} fill="#0a0e12" /><circle cx={x} cy={46} r={5} fill="#3a4550" /></g>)}
        </>
      )}
    </svg>
  )
}
