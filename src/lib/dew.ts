/** How a dew point feels (°F): the same bands as the Weather card's humidity / dew point detail */
export function dewFeel(dewF: number): 'dry' | 'comfortable' | 'sticky' | 'muggy' {
  return dewF < 40 ? 'dry' : dewF < 55 ? 'comfortable' : dewF < 65 ? 'sticky' : 'muggy'
}

/** Dew point (°F) from air temperature (°F) and relative humidity (%) — Magnus formula */
export function dewPointF(tempF: number, humidityPct: number): number | null {
  if (!(humidityPct > 0) || humidityPct > 100) return null
  const c = ((tempF - 32) * 5) / 9
  const g = Math.log(humidityPct / 100) + (17.62 * c) / (243.12 + c)
  return Math.round(((243.12 * g) / (17.62 - g)) * 9 / 5 + 32)
}
