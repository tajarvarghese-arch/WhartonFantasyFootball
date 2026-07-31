import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import { useLeague } from './lib/data'
import Dashboard from './pages/Dashboard'
import Finances from './pages/Finances'
import Keepers from './pages/Keepers'
import ManagerDetail from './pages/ManagerDetail'
import Managers from './pages/Managers'
import Records from './pages/Records'
import Rules from './pages/Rules'
import Standings from './pages/Standings'
import Trades from './pages/Trades'

export default function App() {
  const { data, loading, error } = useLeague()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-[34px] text-parchment">
            Wharton <span className="text-gold-400 italic">Alum</span> Champions
          </div>
          <div className="eyebrow mt-4 animate-pulse">Opening the ledger…</div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="panel max-w-md p-7">
          <div className="eyebrow">Could not load</div>
          <p className="mt-3 text-[13px] leading-relaxed text-parchment-dim">
            {error ?? 'League data is missing.'}
          </p>
          <p className="mt-3 text-[12px] text-parchment-faint">
            Run <code className="text-gold-400">npm run seed -- "path/to/workbook.xlsx"</code> to
            rebuild <code className="text-gold-400">public/data</code>.
          </p>
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
        <Route path="/records" element={<Records />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
