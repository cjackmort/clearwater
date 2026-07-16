import { create } from 'zustand'

/**
 * Minimal app-level state. Persistent data lives in Dexie and is read
 * reactively with useLiveQuery; the store only tracks which pool is active.
 */

const ACTIVE_POOL_KEY = 'poolledger.activePoolId'

interface AppState {
  activePoolId: string | null
  setActivePool: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activePoolId: localStorage.getItem(ACTIVE_POOL_KEY),
  setActivePool: (id) => {
    if (id) {
      localStorage.setItem(ACTIVE_POOL_KEY, id)
    } else {
      localStorage.removeItem(ACTIVE_POOL_KEY)
    }
    set({ activePoolId: id })
  },
}))
