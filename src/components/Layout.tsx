import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import {
  ChecklistIcon,
  DropletIcon,
  HomeIcon,
  InventoryIcon,
  LedgerIcon,
  SettingsIcon,
  TrendsIcon,
} from './Icons'

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/trends', label: 'Trends', icon: TrendsIcon },
  { to: '/checklist', label: 'Checklist', icon: ChecklistIcon },
  { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
  { to: '/ledger', label: 'Ledger', icon: LedgerIcon },
]

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/trends': 'Trends',
  '/checklist': 'Weekly Checklist',
  '/inventory': 'Inventory',
  '/ledger': 'Ledger',
  '/reading/new': 'New Reading',
  '/settings': 'Settings',
}

export function Layout() {
  const { pathname } = useLocation()
  const activePoolId = useAppStore((s) => s.activePoolId)
  const pool = useLiveQuery(
    () => (activePoolId ? repos.pools.get(activePoolId) : undefined),
    [activePoolId],
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-slate-50 sm:border-x sm:border-slate-200/80 sm:shadow-xl sm:shadow-slate-300/40">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-white">
              <DropletIcon className="h-4.5 w-4.5" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-900">
                {TITLES[pathname] ?? 'ClearWater'}
              </h1>
              {pool && (
                <p className="text-xs text-slate-500">
                  {pool.name} · {pool.gallons.toLocaleString()} gal
                </p>
              )}
            </div>
          </div>
          <Link
            to="/settings"
            aria-label="Settings"
            className={`rounded-xl p-2 transition hover:bg-slate-200/60 ${
              pathname === '/settings' ? 'text-cyan-600' : 'text-slate-500'
            }`}
          >
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-stretch justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x sm:border-slate-200/80">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  isActive ? 'text-cyan-600' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
