import {
  Thermometer, Lightbulb, Camera, Bot, Droplets, Car, Music, CloudSun, CalendarDays, ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '../types'

export interface CategoryConfig {
  key: Category; label: string; path: string; icon: LucideIcon; color: string; dim: string
}

const c = (key: Category, label: string, icon: LucideIcon): CategoryConfig => ({
  key, label, path: `/${key}`, icon,
  color: `var(--color-${key})`, dim: `var(--color-${key}-dim)`,
})

export const categories: Record<Category, CategoryConfig> = {
  climate: c('climate', 'Climate', Thermometer),
  lights: c('lights', 'Lights', Lightbulb),
  cameras: c('cameras', 'Cameras', Camera),
  vacuum: c('vacuum', 'Vacuum', Bot),
  irrigation: c('irrigation', 'Irrigation', Droplets),
  vehicles: c('vehicles', 'Vehicles', Car),
  sonos: c('sonos', 'Sonos', Music),
  weather: c('weather', 'Weather', CloudSun),
  calendar: c('calendar', 'Calendar', CalendarDays),
  list: c('list', 'Shopping list', ShoppingCart),
}
