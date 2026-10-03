import { Routes, Route } from 'react-router-dom'
import { HomeProvider } from './lib/useHome'
import { Pager } from './pages/Pager'
import { ClimatePage } from './pages/details/ClimatePage'
import { LightsPage } from './pages/details/LightsPage'
import { CamerasPage } from './pages/details/CamerasPage'
import { VacuumPage } from './pages/details/VacuumPage'
import { IrrigationPage } from './pages/details/IrrigationPage'
import { VehiclesPage } from './pages/details/VehiclesPage'
import { AlertsPage } from './pages/details/AlertsPage'

export default function App() {
  return (
    <HomeProvider>
      <Routes>
        <Route path="/" element={<Pager />} />
        <Route path="/climate" element={<ClimatePage />} />
        <Route path="/lights" element={<LightsPage />} />
        <Route path="/cameras" element={<CamerasPage />} />
        <Route path="/vacuum" element={<VacuumPage />} />
        <Route path="/irrigation" element={<IrrigationPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="*" element={<Pager />} />
      </Routes>
    </HomeProvider>
  )
}
