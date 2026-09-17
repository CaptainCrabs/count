import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { formatMonthLabel, formatDateShort } from '../lib/dates'
import { formatCompactYuan } from '../lib/money'
import { describeTransaction } from '../services/reports'
import { useAppStore } from '../store/useAppStore'

export function DashboardPage() {
  const { ready, sheet, pnl, trend, accounts, transactions, postings } =
    useReports()
  const currentMonth = useAppStore((state) => state.currentMonth)
  const openQuick = useAppStore((state) => state.openQuick)

  const recent = useMemo(
    () => transactions.slice(0, 6),
    [transactions],
  )

  const expensePie = pnl.expenseByCategory.map((item) => ({
    name: item.account.name,
    value: item.amount,
    color: item.account.color,
  }))

  const assetPie = sheet.assets
    .filter((item) => item.amount > 0)
    .map((item) => ({
      name: item.account.name,
      value: item.amount,
      color: item.account.color,
    }))

  const monthBars = trend.map((item) => ({
    month: item.month,
    netWorth: item.netWorth,
  }))

  if (!ready) return <Loading />

  return (
    <div>
      <PageHeader
        title="总览"
        subtitle="净资产、本月收支和账户结构一目了然"
        actions={
          <div className="flex items-center gap-3">
            <MonthPicker />
            <button
              type="button"
              onClick={() => openQuick()}
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              记一笔
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="净资产" fen={sheet.netWorth} tone="neutral" />
        <Kpi label={`${formatMonthLabel(currentMonth)}收入`} fen={pnl.income} tone="income" />
        <Kpi label={`${formatMonthLabel(currentMonth)}支出`} fen={pnl.expense} tone="expense" />
        <Kpi
          label="本月结余"
          fen={pnl.surplus}
          tone="auto"
          signed
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="近 6 个月净资产" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthBars}>
                <defs>
                  <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e2a44" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value: string) => formatMonthLabel(value).replace('年', '/')}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value: number) => formatCompactYuan(value)}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={ChartTooltip} />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="净资产"
                  stroke="#34d399"
                  fill="url(#net)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="资产结构">
          <Donut data={assetPie} empty="暂无资产余额" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="近 6 个月收支">
          <IncomeExpenseChart />
        </Card>
        <Card title="本月支出分类">
          <Donut data={expensePie} empty="本月还没有支出" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="账户余额">
          <ul className="space-y-3">
            {[...sheet.assets, ...sheet.liabilities].map((item) => (
              <li key={item.account.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-300">
                  <i
                    className="size-2.5 rounded-full"
                    style={{ background: item.account.color }}
                  />
                  {item.account.name}
                  {item.account.type === 'liability' && (
                    <span className="text-[11px] text-rose-300">负债</span>
                  )}
                </span>
                <MoneyText fen={item.amount} />
              </li>
            ))}
            {sheet.assets.length + sheet.liabilities.length === 0 && (
              <li className="text-sm text-slate-500">还没有账户余额</li>
            )}
          </ul>
        </Card>

        <Card
          title="最近流水"
          action={
            <button
              type="button"
              onClick={() => openQuick()}
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              记一笔
            </button>
          }
        >
          <ul className="space-y-3">
            {recent.map((tx) => {
              const desc = describeTransaction(tx, postings, accounts)
              return (
                <li key={tx.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-100">{desc.title}</div>
                    <div className="text-xs text-slate-500">
                      {formatDateShort(tx.date)} · {desc.subtitle}
                    </div>
                  </div>
                  <MoneyText
                    fen={tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : tx.amount}
                    signed={tx.type === 'income' || tx.type === 'expense'}
                    tone={tx.type === 'income' ? 'income' : tx.type === 'expense' ? 'expense' : 'neutral'}
                  />
                </li>
              )
            })}
            {recent.length === 0 && (
              <li className="text-sm text-slate-500">还没有流水，按 N 记第一笔。</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function IncomeExpenseChart() {
  const { monthly } = useReports()
  const data = monthly.slice(-6).map((item) => ({
    month: formatMonthLabel(item.month).replace('年', '/'),
    收入: item.income,
    支出: item.expense,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#1e2a44" vertical={false} />
          <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value: number) => formatCompactYuan(value)}
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip content={ChartTooltip} />
          <Bar dataKey="收入" fill="#34d399" radius={[8, 8, 0, 0]} />
          <Bar dataKey="支出" fill="#fb7185" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Donut({
  data,
  empty,
}: {
  data: Array<{ name: string; value: number; color: string }>
  empty: string
}) {
  if (!data.length) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{empty}</div>
  }
  return (
    <div className="flex h-64 items-center gap-4">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip content={ChartTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-36 shrink-0 space-y-2 text-xs">
        {data.slice(0, 6).map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-slate-300">
            <i className="size-2 rounded-full" style={{ background: item.color }} />
            <span className="truncate">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Kpi({
  label,
  fen,
  tone,
  signed,
}: {
  label: string
  fen: number
  tone: 'income' | 'expense' | 'neutral' | 'auto'
  signed?: boolean
}) {
  return (
    <Card>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">
        <MoneyText fen={fen} tone={tone} signed={signed} />
      </div>
    </Card>
  )
}

export function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      正在读取本地账本…
    </div>
  )
}
