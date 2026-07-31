import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Boot, { shouldBoot } from './components/Boot'
import Shell from './components/Shell'
import { useLeague } from './lib/data'
import Dashboard from './pages/Dashboard'
import Finances from './pages/Finances'
import Keepers from './pages/Keepers'
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

  if (booting) return <Boot onDone={() => setBooting(false)} />

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-[15px] font-semibold text-term-green glow">
            wacl<span className="text-term-faint">://</span>terminal
          </div>
          <div className="cursor mt-3 text-[12.5px] text-term-dim">reading /data</div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center px-5">
        <div className="win w-full max-w-lg p-5">
          <div className="label text-term-red">error</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-term-dim">
            <span className="text-term-red">✗</span> {error ?? 'League data is missing.'}
          </p>
          <pre className="mt-3 overflow-x-auto border border-term-line bg-term-bg p-3 text-[11.5px] text-term-faint">
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
        <Route path="/finances" element={<Finances />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/managers" element={<Managers />} />
        <Route path="/managers/:id" element={<ManagerDetail />} />
        <Route path="/players/:name" element={<PlayerDetail />} />
        <Route path="/records" element={<Records />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
