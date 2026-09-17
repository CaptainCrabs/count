export const ACCOUNT_TYPES = [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const TX_TYPES = [
  'expense',
  'income',
  'transfer',
  'repayment',
] as const
export type TxType = (typeof TX_TYPES)[number]

export const SIDES = ['debit', 'credit'] as const
export type Side = (typeof SIDES)[number]

export type Account = {
  id?: number
  name: string
  type: AccountType
  currency: string
  openingBalance: number
  color: string
  sort: number
  archived: boolean
  isSystem: boolean
}

export type Transaction = {
  id?: number
  date: string
  type: TxType
  amount: number
  note: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type Posting = {
  id?: number
  transactionId: number
  accountId: number
  amount: number
  side: Side
}

export type MetaRow = {
  key: string
  value: unknown
}

export type NewEntry = {
  id?: number
  type: TxType
  date: string
  amount: number
  note: string
  tags: string[]
  categoryId?: number
  accountId?: number
  fromAccountId?: number
  toAccountId?: number
}

export type BillSource = 'wechat' | 'alipay'

export type BillImport = {
  id?: number
  source: BillSource
  externalId: string
  transactionId?: number
  importedAt: number
}

export type BackupFile = {
  version: 1
  exportedAt: string
  updatedAt?: number
  accounts: Account[]
  transactions: Transaction[]
  postings: Posting[]
  meta: MetaRow[]
  billImports?: BillImport[]
}
