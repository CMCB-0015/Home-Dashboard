import { CalendarCard } from '../components/tiles/CalendarCard'
import { WeatherCard } from '../components/tiles/WeatherCard'
import { ShoppingListCard } from '../components/tiles/ShoppingListCard'

// Page 2 — calendar on the left half; weather and shopping list stacked on the right.
export function PlannerPage() {
  return (
    <div className="grid grid-cols-1 gap-5 px-5 pb-8 md:px-8 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:pb-6">
      <CalendarCard />
      <div className="flex flex-col gap-5 lg:min-h-0">
        <WeatherCard />
        <ShoppingListCard />
      </div>
    </div>
  )
}
