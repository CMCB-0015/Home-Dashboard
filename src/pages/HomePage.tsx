import { StatusBar } from '../components/StatusBar'
import { CamerasCard } from '../components/tiles/CamerasCard'
import { TeslaCard } from '../components/vehicles/TeslaCard'
import { ClimateTile } from '../components/tiles/SmallTiles'
import { IrrigationCard } from '../components/irrigation/IrrigationCard'
import { VacuumCard } from '../components/vacuum/VacuumCard'
import { SonosCard } from '../components/sonos/SonosCard'
import { LightsCard } from '../components/lights/LightsCard'

// Page 1 — the home dashboard.
export function HomePage({ onOpenPlanner }: { onOpenPlanner: () => void }) {
  return (
    <div className="flex flex-col gap-5 px-5 pb-8 md:px-8">
      <StatusBar onOpenPlanner={onOpenPlanner} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2.25fr_1fr]">
        <CamerasCard />
        <TeslaCard />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ClimateTile />
        <LightsCard />
        <SonosCard />
        <VacuumCard />
        <IrrigationCard />
      </div>
    </div>
  )
}
