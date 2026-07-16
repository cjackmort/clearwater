import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from './data/repositories'
import { useAppStore } from './store/useAppStore'
import { Layout } from './components/Layout'
import { DropletIcon } from './components/Icons'
import { Dashboard } from './pages/Dashboard'
import { Trends } from './pages/Trends'
import { ChecklistPage } from './pages/ChecklistPage'
import { InventoryPage } from './pages/InventoryPage'
import { LedgerPage } from './pages/LedgerPage'
import { ReadingNew } from './pages/ReadingNew'
import { SettingsPage } from './pages/SettingsPage'
import { Onboarding } from './pages/Onboarding'

export default function App() {
  const pools = useLiveQuery(() => repos.pools.all(), [])
  const { activePoolId, setActivePool } = useAppStore()

  // Keep the active pool pointer valid as pools come and go.
  useEffect(() => {
    if (!pools) return
    const stillExists = pools.some((p) => p.id === activePoolId)
    if (!stillExists) setActivePool(pools[0]?.id ?? null)
  }, [pools, activePoolId, setActivePool])

  if (pools === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-cyan-600 text-white">
          <DropletIcon className="h-7 w-7" />
        </span>
      </div>
    )
  }

  const hasPool = pools.length > 0

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      {hasPool ? (
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/checklist" element={<ChecklistPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/reading/new" element={<ReadingNew />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      )}
    </Routes>
  )
}
