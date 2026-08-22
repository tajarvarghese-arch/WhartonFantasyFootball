import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Boot, { shouldBoot } from './components/Boot'
import Shell from './components/Shell'
import { useLeague } from './lib/data'
import { musicOn, start as startMusic } from './lib/music'
import { managerColor } from './lib/identity'
import Dashboard from './pages/Dashboard'
import Draft from './pages/Draft'
import Finances from './pages/Finances'
import Guide from './pages/Guide'
import Keepers from './pages/Keepers'
import Lab from './pages/Lab'
import Almanac from './pages/Almanac'
import Bets from './pages/Bets'
import ManagerDetail from './pages/ManagerDetail'
import Managers from './pages/Managers'
import PlayerDetail from './pages/PlayerDetail'
import Records from './pages/Records'
import Rules from './pages/Rules'
import Standings from './pages/Standings'
import Trades from './pages/Trades'

export default function App() {
  const { data, loading, error } = useLeague()
  const [booting, setBooting] = useState(shouldBoot)

  // Arm the music autostart at the root, not in the Shell: the Shell doesn't
  // mount until the boot screen ends, and the tap that skips the boot is most
  // visitors' first gesture — it must count, or "on" sits silent until the
  // next interaction. Both listeners disarm together; the preference is
  // re-checked at fire time so a toggle-off in between is respected.
  useEffect(() => {
    if (!musicOn()) return
    const kick = () => {
      disarm()
      if (musicOn()) void startMusic()
    }
    const disarm = () => {
      window.removeEventListener('pointerdown', kick)
      window.removeEventListener('keydown', kick)
    }
    window.addEventListener('pointerdown', kick)
    window.addEventListener('keydown', kick)
    return disarm
  }, [])

  if (booting)
    return (
      <Boot
        onDone={() => setBooting(false)}
        championColor={data ? managerColor(data.seasons[0]?.champion) : undefined}
      />
    )

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-[15px] font-semibold text-arc-green">
            wacl<span className="text-arc-ink-faint">://</span>terminal
          </div>
          <div className="cursor mt-3 text-[12.5px] text-arc-ink-soft">reading /data</div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center px-5">
        <div className="win w-full max-w-lg p-5">
          <div className="label text-arc-red">error</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-arc-ink-soft">
            <span className="text-arc-red">✗</span> {error ?? 'League data is missing.'}
          </p>
          <pre className="mt-3 overflow-x-auto border border-arc-line bg-arc-bg p-3 text-[11.5px] text-arc-ink-faint">
            $ npm run seed -- &quot;path/to/workbook.xlsx&quot;
          </pre>
        </div>
      </div>
    )
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/keepers" element={<Keepers />} />
        <Route path="/draft" element={<Draft />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/bets" element={<Bets />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/managers" element={<Managers />} />
        <Route path="/managers/:id" element={<ManagerDetail />} />
        <Route path="/players/:name" element={<PlayerDetail />} />
        <Route path="/records" element={<Records />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/almanac" element={<Almanac />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
