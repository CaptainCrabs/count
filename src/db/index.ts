import Dexie, { type EntityTable } from 'dexie'
import type { Account, BillImport, MetaRow, Posting, Transaction } from '../types'

export const db = new Dexie('count-ledger') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  postings: EntityTable<Posting, 'id'>
  meta: EntityTable<MetaRow, 'key'>
  billImports: EntityTable<BillImport, 'id'>
}

db.version(1).stores({
  accounts: '++id, type, archived, sort, name',
  transactions: '++id, date, type, createdAt',
  postings: '++id, transactionId, accountId',
  meta: 'key',
})

db.version(2).stores({
  accounts: '++id, type, archived, sort, name',
  transactions: '++id, date, type, createdAt',
  postings: '++id, transactionId, accountId',
  meta: 'key',
  billImports: '++id, &[source+externalId], externalId, transactionId',
})

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
