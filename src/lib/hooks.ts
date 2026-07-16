import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useAppStore } from '../store/useAppStore'

/** The currently selected pool (undefined while loading / none selected). */
export function useActivePool() {
  const activePoolId = useAppStore((s) => s.activePoolId)
  return useLiveQuery(
    () => (activePoolId ? repos.pools.get(activePoolId) : undefined),
    [activePoolId],
  )
}
