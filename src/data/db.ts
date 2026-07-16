import Dexie, { type EntityTable } from 'dexie'
import type {
  ChecklistItem,
  InventoryItem,
  Pool,
  Reading,
  Transaction,
  TransactionItem,
  Treatment,
} from './types'

/**
 * Local-first IndexedDB storage via Dexie. This class is only referenced by
 * the repository implementations in ./repositories.ts — UI code never touches
 * Dexie directly, so a Supabase-backed repository set can be swapped in later.
 */
class ClearWaterDB extends Dexie {
  pools!: EntityTable<Pool, 'id'>
  readings!: EntityTable<Reading, 'id'>
  inventory_items!: EntityTable<InventoryItem, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  transaction_items!: EntityTable<TransactionItem, 'id'>
  treatments!: EntityTable<Treatment, 'id'>
  checklist_items!: EntityTable<ChecklistItem, 'id'>

  constructor() {
    super('clearwater')
    this.version(1).stores({
      pools: 'id, user_id',
      readings: 'id, pool_id, date, [pool_id+date]',
      inventory_items: 'id, pool_id, product',
      transactions: 'id, pool_id, date',
      transaction_items: 'id, transaction_id',
      treatments: 'id, pool_id, date',
      checklist_items: 'id, reading_id, status',
    })
  }
}

export const db = new ClearWaterDB()
