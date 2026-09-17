import { useMemo, useState } from 'react'
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
import { Card, Field, PrimaryButton, TextInput } from '../components/ui'
import { useReports } from '../hooks/useLedgerData'
import { setMeta } from '../db'
import { formatMonthLabel } from '../lib/dates'
import { formatCompactYuan, parseYuanInput, yuanInputFromFen } from '../lib/money'
import { buildSavingsReport } from '../services/savings'
import { useAppStore } from '../store/useAppStore'

export function SavingsPage() {
  const currentMonth = useAppStore((state) => state.currentMonth)
  const { ready, monthly, accounts, transactions, postings, meta } = useReports()
  const [goalInput, setGoalInput] = useState('')
  const [saved, setSaved] = useState('')

  const report = useMemo(() => {
    if (!ready) return null
    return buildSavingsReport(
      accounts,
      transactions,
      postings,
      monthly,
      currentMonth,
      meta,
    )
  }, [ready, accounts, transactions, postings, monthly, currentMonth, meta])

  if (!ready || !report) return null

  const chartData = report.trend.map((item) => ({
    month: formatMonthLabel(item.month).replace('年', '/'),
    储蓄: item.saving,
  }))
  const goalProgress =
    report.goal > 0
      ? Math.max(0, Math.min(100, (report.monthSaving / report.goal) * 100))
      : 0

  const currentGoal = report.goal
  async function saveGoal() {
    const fen = parseYuanInput(goalInput || yuanInputFromFen(currentGoal))
    await setMeta('monthlySavingsGoal', fen)
    setSaved('已保存本月储蓄目标')
  }

  return (
    <div>
      <PageHeader
        title="存钱分析"
        subtitle="看清每月能存多少、应急金够不够，以及从哪类支出里挤钱。"
        actions={<MonthPicker />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-xs text-slate-400">本月储蓄</div>
          <div className="mt-2 text-2xl font-semibold">
            <MoneyText fen={report.monthSaving} signed tone="auto" />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">本月储蓄率</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-300">
            {(report.savingRate * 100).toFixed(1)}%
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">本年累计储蓄</div>
          <div className="mt-2 text-2xl font-semibold">
            <MoneyText fen={report.yearSaving} signed tone="auto" />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">应急金可撑</div>
          <div className="mt-2 text-2xl font-semibold text-cyan-300">
            {report.emergencyMonths >= 99
              ? '充足'
              : `${report.emergencyMonths.toFixed(1)} 个月`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            现金类资产 <MoneyText fen={report.liquidAssets} className="text-slate-400" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="近 12 个月储蓄" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#1e2a44" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
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
                <Bar dataKey="储蓄" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="本月储蓄目标">
          <div className="mb-3 text-sm text-slate-300">
            目标 <MoneyText fen={report.goal} /> ，还差{' '}
            <MoneyText
              fen={Math.max(0, report.goalGap)}
              tone={report.goalGap > 0 ? 'expense' : 'income'}
            />
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <Field label="每月目标（元）">
            <TextInput
              inputMode="decimal"
              placeholder={yuanInputFromFen(report.goal) || '5000'}
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value)}
            />
          </Field>
          <PrimaryButton className="mt-3 w-full" onClick={() => void saveGoal()}>
            保存目标
          </PrimaryButton>
          {saved && <p className="mt-2 text-xs text-emerald-300">{saved}</p>}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            按近几个月平均结余估算，到年底净资产大约{' '}
            <MoneyText fen={report.yearEndProjection} className="text-slate-400" />
            。
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="如果这些支出少花 20%">
          {report.cuts.length === 0 ? (
            <p className="text-sm text-slate-500">本月还没有支出可分析</p>
          ) : (
            <ul className="space-y-4">
              {report.cuts.map((item) => (
                <li key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-200">{item.name}</span>
                    <span className="text-xs text-slate-400">
                      本月 <MoneyText fen={item.amount} className="text-slate-300" />
                    </span>
                  </div>
                  <div className="text-xs text-emerald-300">
                    一年大约多存 <MoneyText fen={item.extraYear} className="text-emerald-300" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="建议">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {report.tips.map((tip) => (
              <li key={tip} className="rounded-2xl bg-white/5 px-3 py-2">
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
