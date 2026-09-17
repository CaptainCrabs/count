import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import { monthEnd } from '../lib/dates'
import {
  buildBalanceSheet,
  buildMonthPnL,
  buildNetWorthTrend,
  lastNMonthKeys,
} from '../services/reports'
import { useAppStore } from '../store/useAppStore'

export function useLedgerData() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('sort').toArray())
  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray(),
  )
  const postings = useLiveQuery(() => db.postings.toArray())
  const meta = useLiveQuery(() => db.meta.toArray())
  const ready =
    accounts !== undefined &&
    transactions !== undefined &&
    postings !== undefined &&
    meta !== undefined

  return {
    accounts: accounts ?? [],
    transactions: transactions ?? [],
    postings: postings ?? [],
    meta: meta ?? [],
    ready,
  }
}

export function useReports() {
  const { accounts, transactions, postings, meta, ready } = useLedgerData()
  const currentMonth = useAppStore((state) => state.currentMonth)

  return useMemo(() => {
    const asOf = monthEnd(currentMonth)
    const months = lastNMonthKeys(6, currentMonth)
    const yearMonths = lastNMonthKeys(12, currentMonth)
    const sheet = buildBalanceSheet(accounts, transactions, postings, asOf)
    const pnl = buildMonthPnL(accounts, transactions, postings, currentMonth)
    const trend = buildNetWorthTrend(accounts, transactions, postings, months)
    const monthly = yearMonths.map((month) =>
      buildMonthPnL(accounts, transactions, postings, month),
    )
    return {
      ready,
      sheet,
      pnl,
      trend,
      monthly,
      accounts,
      transactions,
      postings,
      meta,
    }
  }, [accounts, transactions, postings, meta, currentMonth, ready])
}
