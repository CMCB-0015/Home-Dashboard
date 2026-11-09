import { Routes, Route } from 'react-router-dom'
import { HomeProvider, useHome } from './lib/useHome'
import { LockScreen } from './components/LockScreen'
import { Notice } from './components/Notice'
import { Pager } from './pages/Pager'
import { ClimatePage } from './pages/details/ClimatePage'
import { LightsPage } from './pages/details/LightsPage'
import { CamerasPage } from './pages/details/CamerasPage'
import { VacuumPage } from './pages/details/VacuumPage'
import { IrrigationPage } from './pages/details/IrrigationPage'
import { VehiclesPage } from './pages/details/VehiclesPage'
import { AlertsPage } from './pages/details/AlertsPage'
import { SonosPage } from './pages/details/SonosPage'

function Screens() {
  const { lock } = useHome()
  if (lock !== 'open') return <LockScreen />
  return (
      <Routes>
        <Route path="/" element={<Pager />} />
        <Route path="/climate" element={<ClimatePage />} />
        <Route path="/lights" element={<LightsPage />} />
        <Route path="/cameras" element={<CamerasPage />} />
        <Route path="/vacuum" element={<VacuumPage />} />
        <Route path="/irrigation" element={<IrrigationPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/sonos" element={<SonosPage />} />
        <Route path="*" element={<Pager />} />
      </Routes>
  )
}

export default function App() {
  return (
    <HomeProvider>
      <Screens />
      <Notice />
    </HomeProvider>
  )
}
