import { ActivityStrip } from '../components/tiles/ActivityStrip'
import { CamerasCard } from '../components/tiles/CamerasCard'
import { VehiclesCard } from '../components/tiles/VehiclesCard'
import { ClimateTile, LightsTile, SonosTile, VacuumTile, IrrigationTile } from '../components/tiles/SmallTiles'

// Page 1 — the home dashboard.
export function HomePage() {
  return (
    <div className="flex flex-col gap-5 px-5 pb-8 md:px-8">
      <ActivityStrip />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2.25fr_1fr]">
        <CamerasCard />
        <VehiclesCard />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ClimateTile />
        <LightsTile />
        <SonosTile />
        <VacuumTile />
        <IrrigationTile />
      </div>
    </div>
  )
}
