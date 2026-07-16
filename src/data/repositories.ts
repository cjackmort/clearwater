import { db } from './db'
import type {
  ChecklistItem,
  ChecklistStatus,
  InventoryItem,
  Pool,
  Reading,
  Transaction,
  TransactionItem,
  Treatment,
} from './types'

/**
 * Repository interfaces sit between the UI and storage. The Dexie
 * implementations below are the Phase 1 backend; a Supabase implementation
 * can replace them behind the same interfaces without touching UI code.
 */

export interface PoolRepository {
  all(): Promise<Pool[]>
  get(id: string): Promise<Pool | undefined>
  create(pool: Pool): Promise<void>
  update(pool: Pool): Promise<void>
  remove(id: string): Promise<void>
}

export interface ReadingRepository {
  forPool(poolId: string): Promise<Reading[]>
  latest(poolId: string): Promise<Reading | undefined>
  get(id: string): Promise<Reading | undefined>
  create(reading: Reading): Promise<void>
  remove(id: string): Promise<void>
}

export interface InventoryRepository {
  forPool(poolId: string): Promise<InventoryItem[]>
  get(id: string): Promise<InventoryItem | undefined>
  create(item: InventoryItem): Promise<void>
  update(item: InventoryItem): Promise<void>
  remove(id: string): Promise<void>
}

export interface TransactionRepository {
  forPool(poolId: string): Promise<Transaction[]>
  itemsFor(transactionId: string): Promise<TransactionItem[]>
  create(tx: Transaction, items: TransactionItem[]): Promise<void>
  remove(id: string): Promise<void>
}

export interface TreatmentRepository {
  forPool(poolId: string): Promise<Treatment[]>
  create(treatment: Treatment): Promise<void>
}

export interface ChecklistRepository {
  forReading(readingId: string): Promise<ChecklistItem[]>
  createMany(items: ChecklistItem[]): Promise<void>
  setStatus(id: string, status: ChecklistStatus): Promise<void>
}

class DexiePoolRepository implements PoolRepository {
  all() {
    return db.pools.toArray()
  }
  get(id: string) {
    return db.pools.get(id)
  }
  async create(pool: Pool) {
    await db.pools.add(pool)
  }
  async update(pool: Pool) {
    await db.pools.put(pool)
  }
  async remove(id: string) {
    await db.pools.delete(id)
  }
}

class DexieReadingRepository implements ReadingRepository {
  forPool(poolId: string) {
    return db.readings.where('pool_id').equals(poolId).sortBy('date')
  }
  async latest(poolId: string) {
    const readings = await this.forPool(poolId)
    return readings[readings.length - 1]
  }
  get(id: string) {
    return db.readings.get(id)
  }
  async create(reading: Reading) {
    await db.readings.add(reading)
  }
  async remove(id: string) {
    await db.readings.delete(id)
  }
}

class DexieInventoryRepository implements InventoryRepository {
  forPool(poolId: string) {
    return db.inventory_items.where('pool_id').equals(poolId).sortBy('product')
  }
  get(id: string) {
    return db.inventory_items.get(id)
  }
  async create(item: InventoryItem) {
    await db.inventory_items.add(item)
  }
  async update(item: InventoryItem) {
    await db.inventory_items.put(item)
  }
  async remove(id: string) {
    await db.inventory_items.delete(id)
  }
}

class DexieTransactionRepository implements TransactionRepository {
  async forPool(poolId: string) {
    const txs = await db.transactions.where('pool_id').equals(poolId).sortBy('date')
    return txs.reverse()
  }
  itemsFor(transactionId: string) {
    return db.transaction_items.where('transaction_id').equals(transactionId).toArray()
  }
  async create(tx: Transaction, items: TransactionItem[]) {
    await db.transaction('rw', db.transactions, db.transaction_items, async () => {
      await db.transactions.add(tx)
      await db.transaction_items.bulkAdd(items)
    })
  }
  async remove(id: string) {
    await db.transaction('rw', db.transactions, db.transaction_items, async () => {
      await db.transactions.delete(id)
      await db.transaction_items.where('transaction_id').equals(id).delete()
    })
  }
}

class DexieTreatmentRepository implements TreatmentRepository {
  async forPool(poolId: string) {
    const rows = await db.treatments.where('pool_id').equals(poolId).sortBy('date')
    return rows.reverse()
  }
  async create(treatment: Treatment) {
    await db.treatments.add(treatment)
  }
}

class DexieChecklistRepository implements ChecklistRepository {
  forReading(readingId: string) {
    return db.checklist_items.where('reading_id').equals(readingId).toArray()
  }
  async createMany(items: ChecklistItem[]) {
    await db.checklist_items.bulkAdd(items)
  }
  async setStatus(id: string, status: ChecklistStatus) {
    await db.checklist_items.update(id, { status })
  }
}

export const repos = {
  pools: new DexiePoolRepository() as PoolRepository,
  readings: new DexieReadingRepository() as ReadingRepository,
  inventory: new DexieInventoryRepository() as InventoryRepository,
  transactions: new DexieTransactionRepository() as TransactionRepository,
  treatments: new DexieTreatmentRepository() as TreatmentRepository,
  checklist: new DexieChecklistRepository() as ChecklistRepository,
}
