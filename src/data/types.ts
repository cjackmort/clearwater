/**
 * Core entity types. Every table carries a `user_id` so that swapping the
 * local Dexie backend for Supabase (+ auth) later is a config change, not a
 * rewrite. For now every row is written with user_id = "local".
 */

export type PoolType = 'chlorine' | 'saltwater'
export type PoolSurface = 'plaster' | 'vinyl' | 'fiberglass'
export type VesselKind = 'pool' | 'hot_tub'

export interface Pool {
  id: string
  user_id: string
  name: string
  gallons: number
  type: PoolType
  surface: PoolSurface
  vessel: VesselKind
  created_at: string
}

export interface RecommendedProduct {
  product: string
  quantity: number
  unit: string
  reason: string
}

export interface Reading {
  id: string
  user_id: string
  pool_id: string
  /** ISO date string */
  date: string
  fc: number
  tc: number
  ph: number
  ta: number
  ch: number
  cya: number
  phosphates: number
  /** Only meaningful for saltwater pools */
  salt?: number
  /** Reported on some store test reports; not part of the health score yet */
  iron?: number
  copper?: number
  health_score: number
  photo_url?: string
  recommended_products: RecommendedProduct[]
}

export interface InventoryItem {
  id: string
  user_id: string
  pool_id: string
  product: string
  category: string
  quantity: number
  unit: string
  /** 0-100, estimated remaining across the whole quantity on hand */
  est_remaining_pct: number
}

export interface Transaction {
  id: string
  user_id: string
  pool_id: string
  store: string
  /** ISO date string */
  date: string
  total: number
  receipt_photo_url?: string
}

export interface TransactionItem {
  id: string
  user_id: string
  transaction_id: string
  product: string
  qty: number
  unit_price: number
}

export type TreatmentSource = 'checklist' | 'manual'

export interface Treatment {
  id: string
  user_id: string
  pool_id: string
  date: string
  product: string
  amount: number
  unit: string
  source: TreatmentSource
}

export type ChecklistActionType = 'add_chemical' | 'buy' | 'task'
export type ChecklistStatus = 'pending' | 'done' | 'skipped'

export interface ChecklistItem {
  id: string
  user_id: string
  reading_id: string
  action_type: ChecklistActionType
  label: string
  product?: string
  amount?: number
  unit?: string
  status: ChecklistStatus
  /** Which reading parameter this action addresses (for skip-callouts) */
  param?: string
}

export const LOCAL_USER_ID = 'local'

export function newId(): string {
  return crypto.randomUUID()
}
