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
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white sm:border-x sm:border-slate-200/80 sm:shadow-xl sm:shadow-slate-300/40">
      {/* Soft aquatic wash behind the top of every screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-cyan-50 via-sky-50/60 to-transparent"
      />

      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 text-white shadow-sm shadow-cyan-500/30">
              <DropletIcon className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-900">
                {TITLES[pathname] ?? 'ClearWater'}
              </h1>
              {pool && (
                <p className="text-xs text-slate-500">
                  {pool.name} · {pool.vessel === 'hot_tub' ? 'Hot tub · ' : ''}
                  {pool.gallons.toLocaleString()} gal
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

      <main key={pathname} className="rise-in relative z-10 flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-stretch justify-around border-t border-slate-200/80 bg-white/85 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:border-x sm:border-slate-200/80">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-semibold transition ${
                  isActive ? 'text-cyan-700' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-cyan-100/80 text-cyan-700'
                        : 'text-slate-400 group-hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
