import { monthEnd } from '../lib/dates'
import type { Account, Posting, Transaction } from '../types'
import { buildBalanceSheet, type MonthPnL } from './reports'

const ILLIQUID = /基金|理财|股票|证券|债券|股权/

export type SavingsReport = {
  monthSaving: number
  monthIncome: number
  savingRate: number
  yearSaving: number
  avgSaving: number
  avgExpense: number
  liquidAssets: number
  emergencyMonths: number
  goal: number
  goalGap: number
  yearEndProjection: number
  trend: Array<{ month: string; saving: number; rate: number }>
  cuts: Array<{ name: string; amount: number; extraYear: number; color: string }>
  tips: string[]
}

function metaGoal(meta: Array<{ key: string; value: unknown }>): number {
  const row = meta.find((item) => item.key === 'monthlySavingsGoal')
  const value = Number(row?.value)
  if (Number.isFinite(value) && value > 0) return value
  return 500000
}

function liquidAssets(sheetAssets: Array<{ account: Account; amount: number }>): number {
  return sheetAssets
    .filter((item) => !ILLIQUID.test(item.account.name))
    .reduce((sum, item) => sum + Math.max(0, item.amount), 0)
}

export function buildSavingsReport(
  accounts: Account[],
  transactions: Transaction[],
  postings: Posting[],
  monthly: MonthPnL[],
  currentMonth: string,
  meta: Array<{ key: string; value: unknown }>,
): SavingsReport {
  const pnl = monthly.find((item) => item.month === currentMonth) ?? monthly.at(-1)
  const monthSaving = pnl?.surplus ?? 0
  const monthIncome = pnl?.income ?? 0
  const savingRate = monthIncome > 0 ? monthSaving / monthIncome : 0
  const year = currentMonth.slice(0, 4)
  const yearMonths = monthly.filter((item) => item.month.startsWith(year))
  const yearSaving = yearMonths.reduce((sum, item) => sum + item.surplus, 0)
  const active = monthly.filter((item) => item.income > 0 || item.expense > 0)
  const avgSaving = active.length
    ? Math.round(active.reduce((sum, item) => sum + item.surplus, 0) / active.length)
    : 0
  const avgExpense = active.length
    ? Math.round(active.reduce((sum, item) => sum + item.expense, 0) / active.length)
    : 0
  const sheet = buildBalanceSheet(
    accounts,
    transactions,
    postings,
    monthEnd(currentMonth),
  )
  const liquid = liquidAssets(sheet.assets)
  const emergencyMonths = avgExpense > 0 ? liquid / avgExpense : liquid > 0 ? 99 : 0
  const goal = metaGoal(meta)
  const remainingMonths = Math.max(1, 12 - Number(currentMonth.slice(5, 7)))
  const yearEndProjection = sheet.netWorth + avgSaving * remainingMonths
  const trend = monthly.map((item) => ({
    month: item.month,
    saving: item.surplus,
    rate: item.income > 0 ? item.surplus / item.income : 0,
  }))
  const cuts = (pnl?.expenseByCategory ?? []).slice(0, 4).map((item) => ({
    name: item.account.name,
    amount: item.amount,
    extraYear: Math.round(item.amount * 0.2 * 12),
    color: item.account.color,
  }))

  const tips: string[] = []
  if (monthIncome > 0 && savingRate < 0.2) {
    tips.push('本月储蓄率低于 20%。先保住收入入账账户，再把最高的 1～2 个支出分类压一压。')
  } else if (savingRate >= 0.3) {
    tips.push('本月储蓄率已经不错。多出来的结余可以考虑单独放到基金理财，避免和日常消费账户混在一起。')
  }
  if (emergencyMonths < 3 && avgExpense > 0) {
    tips.push(
      `现金类资产大约还能覆盖 ${emergencyMonths.toFixed(1)} 个月支出，建议先补到 3～6 个月应急金。`,
    )
  } else if (emergencyMonths >= 6) {
    tips.push('应急金已经比较充足，新增结余可以更多用于还负债或长期投资。')
  }
  if (goal > 0 && monthSaving < goal) {
    tips.push('本月还没达到储蓄目标。优先砍掉可延迟的购物和娱乐，房租等固定支出先别动。')
  }
  if (!tips.length) {
    tips.push('继续保持：每月结余转入单独账户，比只看总资产更容易坚持。')
  }

  return {
    monthSaving,
    monthIncome,
    savingRate,
    yearSaving,
    avgSaving,
    avgExpense,
    liquidAssets: liquid,
    emergencyMonths,
    goal,
    goalGap: goal - monthSaving,
    yearEndProjection,
    trend,
    cuts,
    tips,
  }
}
