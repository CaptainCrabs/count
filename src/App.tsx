import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Onboarding } from './components/Onboarding'
import { UnlockScreen } from './components/UnlockScreen'
import { db } from './db'
import { AccountsPage } from './pages/Accounts'
import { BalanceSheetPage } from './pages/BalanceSheet'
import { DashboardPage } from './pages/Dashboard'
import { IncomePage } from './pages/Income'
import { ImportBillsPage } from './pages/ImportBills'
import { LedgerPage } from './pages/Ledger'
import { SavingsPage } from './pages/Savings'
import { SettingsPage } from './pages/Settings'
import {
  getSyncStatus,
  initSync,
  subscribeSync,
} from './services/sync'

export default function App() {
  const [syncReady, setSyncReady] = useState(false)
  const [sync, setSync] = useState(getSyncStatus)
  const accountCount = useLiveQuery(() => db.accounts.count())

  useEffect(() => {
    const unsub = subscribeSync(() => setSync(getSyncStatus()))
    void initSync().finally(() => setSyncReady(true))
    return unsub
  }, [])

  if (!syncReady || accountCount === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#070b14] text-sm text-slate-400">
        正在打开账本…
      </div>
    )
  }

  if (sync.serverAvailable && !sync.unlocked) {
    return <UnlockScreen />
  }

  if (accountCount === 0) return <Onboarding />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/import" element={<ImportBillsPage />} />
        <Route path="/balance-sheet" element={<BalanceSheetPage />} />
        <Route path="/income" element={<IncomePage />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
