import { inMonth, monthEnd, recentMonths } from '../lib/dates'
import type { Account, Posting, Transaction } from '../types'
import { signedDelta } from './ledger'

export type NamedAmount = {
  account: Account
  amount: number
}

export type BalanceSheetReport = {
  asOf: string
  assets: NamedAmount[]
  liabilities: NamedAmount[]
  totalAssets: number
  totalLiabilities: number
  openingEquity: number
  retainedEarnings: number
  totalEquity: number
  netWorth: number
  balanced: boolean
}

export type MonthPnL = {
  month: string
  income: number
  expense: number
  surplus: number
  incomeByCategory: NamedAmount[]
  expenseByCategory: NamedAmount[]
}

function accountMap(accounts: Account[]): Map<number, Account> {
  return new Map(
    accounts.filter((item) => item.id != null).map((item) => [item.id as number, item]),
  )
}

export function computeBalances(
  accounts: Account[],
  transactions: Transaction[],
  postings: Posting[],
  asOf: string,
): Map<number, number> {
  const txnById = new Map(
    transactions
      .filter((item) => item.id != null)
      .map((item) => [item.id as number, item]),
  )
  const balances = new Map<number, number>()

  for (const account of accounts) {
    if (account.id == null) continue
    const usesOpening =
      account.type === 'asset' ||
      account.type === 'liability' ||
      account.type === 'equity'
    let balance = usesOpening ? account.openingBalance : 0

    for (const posting of postings) {
      if (posting.accountId !== account.id) continue
      const txn = txnById.get(posting.transactionId)
      if (!txn || txn.date > asOf) continue
      balance += signedDelta(account.type, posting.side, posting.amount)
    }

    balances.set(account.id, balance)
  }

  return balances
}

function groupedAmounts(
  accounts: Account[],
  balances: Map<number, number>,
  type: Account['type'],
): NamedAmount[] {
  return accounts
    .filter((item) => item.type === type && item.id != null && !item.isSystem)
    .map((account) => ({
      account,
      amount: balances.get(account.id as number) ?? 0,
    }))
    .filter((item) => item.amount !== 0 || !item.account.archived)
    .sort((a, b) => a.account.sort - b.account.sort)
}

export function buildBalanceSheet(
  accounts: Account[],
  transactions: Transaction[],
  postings: Posting[],
  asOf: string,
): BalanceSheetReport {
  const balances = computeBalances(accounts, transactions, postings, asOf)
  const assets = groupedAmounts(accounts, balances, 'asset')
  const liabilities = groupedAmounts(accounts, balances, 'liability')
  const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0)
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0)
  const openingEquity = accounts
    .filter((item) => item.type === 'asset')
    .reduce((sum, item) => sum + item.openingBalance, 0)
    - accounts
      .filter((item) => item.type === 'liability')
      .reduce((sum, item) => sum + item.openingBalance, 0)

  const income = accounts
    .filter((item) => item.type === 'income' && item.id != null)
    .reduce((sum, item) => sum + (balances.get(item.id as number) ?? 0), 0)
  const expense = accounts
    .filter((item) => item.type === 'expense' && item.id != null)
    .reduce((sum, item) => sum + (balances.get(item.id as number) ?? 0), 0)
  const retainedEarnings = income - expense
  const totalEquity = openingEquity + retainedEarnings
  const netWorth = totalAssets - totalLiabilities

  return {
    asOf,
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    openingEquity,
    retainedEarnings,
    totalEquity,
    netWorth,
    balanced: netWorth === totalEquity,
  }
}

export function buildMonthPnL(
  accounts: Account[],
  transactions: Transaction[],
  postings: Posting[],
  month: string,
): MonthPnL {
  const byId = accountMap(accounts)
  const monthTxnIds = new Set(
    transactions
      .filter((item) => item.id != null && inMonth(item.date, month))
      .map((item) => item.id as number),
  )

  const deltas = new Map<number, number>()
  for (const posting of postings) {
    if (!monthTxnIds.has(posting.transactionId)) continue
    const account = byId.get(posting.accountId)
    if (!account) continue
    const current = deltas.get(posting.accountId) ?? 0
    deltas.set(
      posting.accountId,
      current + signedDelta(account.type, posting.side, posting.amount),
    )
  }

  const incomeByCategory = accounts
    .filter((item) => item.type === 'income' && item.id != null)
    .map((account) => ({
      account,
      amount: deltas.get(account.id as number) ?? 0,
    }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount)

  const expenseByCategory = accounts
    .filter((item) => item.type === 'expense' && item.id != null)
    .map((account) => ({
      account,
      amount: deltas.get(account.id as number) ?? 0,
    }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount)

  const income = incomeByCategory.reduce((sum, item) => sum + item.amount, 0)
  const expense = expenseByCategory.reduce((sum, item) => sum + item.amount, 0)

  return {
    month,
    income,
    expense,
    surplus: income - expense,
    incomeByCategory,
    expenseByCategory,
  }
}

export function buildNetWorthTrend(
  accounts: Account[],
  transactions: Transaction[],
  postings: Posting[],
  months: string[],
): Array<{ month: string; netWorth: number }> {
  return months.map((month) => ({
    month,
    netWorth: buildBalanceSheet(
      accounts,
      transactions,
      postings,
      monthEnd(month),
    ).netWorth,
  }))
}

export function describeTransaction(
  transaction: Transaction,
  postings: Posting[],
  accounts: Account[],
): { title: string; subtitle: string } {
  const byId = accountMap(accounts)
  const nameOf = (id?: number) =>
    (id != null ? byId.get(id)?.name : undefined) ?? '未命名'
  const legs = postings.filter((item) => item.transactionId === transaction.id)
  const findType = (type: Account['type']) =>
    legs.find((item) => byId.get(item.accountId)?.type === type)

  switch (transaction.type) {
    case 'expense':
      return {
        title: nameOf(findType('expense')?.accountId),
        subtitle: `从 ${nameOf(
          legs.find((item) => {
            const type = byId.get(item.accountId)?.type
            return type === 'asset' || type === 'liability'
          })?.accountId,
        )}`,
      }
    case 'income':
      return {
        title: nameOf(findType('income')?.accountId),
        subtitle: `存入 ${nameOf(findType('asset')?.accountId)}`,
      }
    case 'transfer': {
      const debit = legs.find((item) => item.side === 'debit')
      const credit = legs.find((item) => item.side === 'credit')
      return {
        title: '账户转账',
        subtitle: `${nameOf(credit?.accountId)} → ${nameOf(debit?.accountId)}`,
      }
    }
    case 'repayment':
      return {
        title: '偿还负债',
        subtitle: `${nameOf(findType('asset')?.accountId)} → ${nameOf(findType('liability')?.accountId)}`,
      }
    default: {
      const neverType: never = transaction.type
      return { title: String(neverType), subtitle: '' }
    }
  }
}

export function lastNMonthKeys(count: number, endMonth: string): string[] {
  return recentMonths(count, endMonth)
}
