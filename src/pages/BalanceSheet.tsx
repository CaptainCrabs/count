import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/Layout'
import { MoneyText } from '../components/MoneyText'
import { MonthPicker } from '../components/MonthPicker'
import { Card, TextInput } from '../components/ui'
import { useLedgerData } from '../hooks/useLedgerData'
import { monthEnd } from '../lib/dates'
import { formatFen } from '../lib/money'
import { buildBalanceSheet } from '../services/reports'
import { useAppStore } from '../store/useAppStore'

export function BalanceSheetPage() {
  const currentMonth = useAppStore((state) => state.currentMonth)
  const { accounts, transactions, postings, ready } = useLedgerData()
  const [asOf, setAsOf] = useState(monthEnd(currentMonth))

  useEffect(() => {
    setAsOf(monthEnd(currentMonth))
  }, [currentMonth])

  const sheet = useMemo(
    () => buildBalanceSheet(accounts, transactions, postings, asOf),
    [accounts, transactions, postings, asOf],
  )

  if (!ready) return null

  const maxSide = Math.max(sheet.totalAssets, sheet.totalLiabilities + sheet.totalEquity, 1)

  return (
    <div>
      <PageHeader
        title="资产负债表"
        subtitle="某一天的资产、负债与权益。净资产 = 资产 − 负债。"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <MonthPicker />
            <TextInput
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              className="w-auto"
            />
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Summary label="资产合计" fen={sheet.totalAssets} />
        <Summary label="负债合计" fen={sheet.totalLiabilities} tone="expense" />
        <Summary label="净资产" fen={sheet.netWorth} />
      </div>

      <div
        className={
          sheet.balanced
            ? 'mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-200'
            : 'mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200'
        }
      >
        {sheet.balanced
          ? `账本平衡：资产 ¥${formatFen(sheet.totalAssets)} = 负债 ¥${formatFen(sheet.totalLiabilities)} + 权益 ¥${formatFen(sheet.totalEquity)}`
          : '账本不平衡，请检查期初或备份数据。'}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="资产">
          <Rows items={sheet.assets} total={sheet.totalAssets} max={maxSide} />
        </Card>
        <div className="space-y-4">
          <Card title="负债">
            <Rows
              items={sheet.liabilities}
              total={sheet.totalLiabilities}
              max={maxSide}
              empty="没有负债"
            />
          </Card>
          <Card title="权益">
            <ul className="space-y-3">
              <EquityRow label="期初净资产" fen={sheet.openingEquity} />
              <EquityRow label="累计结余" fen={sheet.retainedEarnings} signed />
              <li className="flex items-center justify-between border-t border-white/8 pt-3 text-sm font-medium">
                <span>权益合计</span>
                <MoneyText fen={sheet.totalEquity} />
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Summary({
  label,
  fen,
  tone = 'neutral',
}: {
  label: string
  fen: number
  tone?: 'neutral' | 'expense'
}) {
  return (
    <Card>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">
        <MoneyText fen={fen} tone={tone} />
      </div>
    </Card>
  )
}

function Rows({
  items,
  total,
  max,
  empty = '暂无数据',
}: {
  items: Array<{ account: { id?: number; name: string; color: string }; amount: number }>
  total: number
  max: number
  empty?: string
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">{empty}</p>
  }
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.account.id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-200">{item.account.name}</span>
            <MoneyText className="shrink-0" fen={item.amount} />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (Math.abs(item.amount) / max) * 100)}%`,
                background: item.account.color,
              }}
            />
          </div>
        </li>
      ))}
      <li className="flex items-center justify-between border-t border-white/8 pt-3 text-sm font-medium">
        <span>合计</span>
        <MoneyText fen={total} />
      </li>
    </ul>
  )
}

function EquityRow({
  label,
  fen,
  signed,
}: {
  label: string
  fen: number
  signed?: boolean
}) {
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-slate-300">{label}</span>
      <MoneyText fen={fen} signed={signed} tone={signed ? 'auto' : 'neutral'} />
    </li>
  )
}
