import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from '../components/ChartTooltip'
import { PageHeader } from '../components/Layout'
import { MoneyText } from '../components/MoneyText'
import { MonthPicker } from '../components/MonthPicker'
import { Card } from '../components/ui'
import { useReports } from '../hooks/useLedgerData'
import { formatMonthLabel, monthKey } from '../lib/dates'
import { formatCompactYuan } from '../lib/money'
import { useAppStore } from '../store/useAppStore'

export function IncomePage() {
  const currentMonth = useAppStore((state) => state.currentMonth)
  const setMonth = useAppStore((state) => state.setMonth)
  const { ready, pnl, monthly } = useReports()
  const [focus, setFocus] = useState(currentMonth || monthKey())

  useEffect(() => {
    setFocus(currentMonth)
  }, [currentMonth])

  const selected = useMemo(
    () => monthly.find((item) => item.month === focus) ?? pnl,
    [monthly, focus, pnl],
  )

  if (!ready) return null

  const chartData = monthly.map((item) => ({
    month: formatMonthLabel(item.month).replace('年', '/'),
    key: item.month,
    收入: item.income,
    支出: item.expense,
    结余: item.surplus,
  }))

  return (
    <div>
      <PageHeader
        title="月度收支"
        subtitle="按月查看收入、支出和结余，结余会滚入净资产。"
        actions={<MonthPicker />}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-slate-400">{formatMonthLabel(selected.month)}收入</div>
          <div className="mt-2 text-2xl font-semibold">
            <MoneyText fen={selected.income} tone="income" />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">支出</div>
          <div className="mt-2 text-2xl font-semibold">
            <MoneyText fen={selected.expense} tone="expense" />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">结余</div>
          <div className="mt-2 text-2xl font-semibold">
            <MoneyText fen={selected.surplus} signed tone="auto" />
          </div>
        </Card>
      </div>

      <Card title="近 12 个月" className="mb-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1e2a44" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value: number) => formatCompactYuan(value)}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip content={ChartTooltip} />
              <Bar dataKey="收入" fill="#34d399" radius={[6, 6, 0, 0]} />
              <Bar dataKey="支出" fill="#fb7185" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="月度明细">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-3 font-medium">月份</th>
                <th className="pb-3 font-medium">收入</th>
                <th className="pb-3 font-medium">支出</th>
                <th className="pb-3 font-medium">结余</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly].reverse().map((item) => (
                <tr
                  key={item.month}
                  className={
                    item.month === focus
                      ? 'cursor-pointer bg-emerald-400/8'
                      : 'cursor-pointer hover:bg-white/5'
                  }
                  onClick={() => {
                    setFocus(item.month)
                    setMonth(item.month)
                  }}
                >
                  <td className="py-2.5 text-slate-200">{formatMonthLabel(item.month)}</td>
                  <td className="py-2.5">
                    <MoneyText fen={item.income} tone="income" />
                  </td>
                  <td className="py-2.5">
                    <MoneyText fen={item.expense} tone="expense" />
                  </td>
                  <td className="py-2.5">
                    <MoneyText fen={item.surplus} signed tone="auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`${formatMonthLabel(selected.month)}收入构成`}>
          <CategoryList items={selected.incomeByCategory} empty="本月没有收入" tone="income" />
        </Card>
        <Card title="支出构成">
          <CategoryList items={selected.expenseByCategory} empty="本月没有支出" tone="expense" />
        </Card>
      </div>
    </div>
  )
}

function CategoryList({
  items,
  empty,
  tone,
}: {
  items: Array<{ account: { id?: number; name: string; color: string }; amount: number }>
  empty: string
  tone: 'income' | 'expense'
}) {
  const total = items.reduce((sum, item) => sum + item.amount, 0) || 1
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.account.id}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-200">{item.account.name}</span>
            <MoneyText fen={item.amount} tone={tone} />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.amount / total) * 100}%`,
                background: item.account.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
