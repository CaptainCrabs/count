import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../components/Modal'
import { PageHeader } from '../components/Layout'
import { MoneyText } from '../components/MoneyText'
import { MonthPicker } from '../components/MonthPicker'
import { SelectInput, TextInput } from '../components/ui'
import { useLedgerData } from '../hooks/useLedgerData'
import { formatDateLabel, inMonth } from '../lib/dates'
import { deleteEntry, entryFromTransaction } from '../services/ledger'
import { describeTransaction } from '../services/reports'
import { useAppStore } from '../store/useAppStore'
import type { TxType } from '../types'

const TYPE_LABEL: Record<TxType, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
  repayment: '还款',
}

export function LedgerPage() {
  const { accounts, transactions, postings, ready } = useLedgerData()
  const currentMonth = useAppStore((state) => state.currentMonth)
  const openQuick = useAppStore((state) => state.openQuick)
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<TxType | 'all'>('all')
  const [accountId, setAccountId] = useState('all')
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)

  const rows = useMemo(() => {
    const accountTx = new Set(
      postings
        .filter((item) => String(item.accountId) === accountId)
        .map((item) => item.transactionId),
    )
    return transactions.filter((tx) => {
      if (!inMonth(tx.date, currentMonth)) return false
      if (type !== 'all' && tx.type !== type) return false
      if (accountId !== 'all' && !accountTx.has(tx.id ?? -1)) return false
      if (keyword) {
        const desc = describeTransaction(tx, postings, accounts)
        const hay = `${desc.title} ${desc.subtitle} ${tx.note} ${tx.tags.join(' ')}`
        if (!hay.includes(keyword.trim())) return false
      }
      return true
    })
  }, [transactions, postings, accounts, currentMonth, type, accountId, keyword])

  if (!ready) return null

  return (
    <div>
      <PageHeader
        title="流水"
        subtitle="查看、复制、修改或删除本月每一笔"
        actions={
          <div className="flex items-center gap-3">
            <MonthPicker />
            <Link
              to="/import"
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              导入账单
            </Link>
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextInput
          placeholder="搜索备注、分类、标签"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <SelectInput
          value={type}
          onChange={(event) => setType(event.target.value as TxType | 'all')}
        >
          <option value="all">全部类型</option>
          {Object.entries(TYPE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="all">全部账户</option>
          {accounts
            .filter((item) => !item.isSystem)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </SelectInput>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/8 bg-[#10192c]">
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            这个月还没有符合条件的流水
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((tx) => {
              const desc = describeTransaction(tx, postings, accounts)
              return (
                <li
                  key={tx.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {desc.title}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                        {TYPE_LABEL[tx.type]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateLabel(tx.date)} · {desc.subtitle}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <MoneyText
                      fen={
                        tx.type === 'expense'
                          ? -tx.amount
                          : tx.type === 'income'
                            ? tx.amount
                            : tx.amount
                      }
                      signed={tx.type === 'expense' || tx.type === 'income'}
                      tone={
                        tx.type === 'expense'
                          ? 'expense'
                          : tx.type === 'income'
                            ? 'income'
                            : 'neutral'
                      }
                      className="text-base font-medium"
                    />
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() =>
                        openQuick({
                          ...entryFromTransaction(tx, postings, accounts),
                          id: undefined,
                        })
                      }
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() =>
                        openQuick(entryFromTransaction(tx, postings, accounts))
                      }
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-rose-300 hover:text-rose-200"
                      onClick={() => setPendingDelete(tx.id ?? null)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        title="删除这笔流水？"
        message="删除后对应账户余额和报表会立刻重算，无法撤销。"
        confirmText="删除"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete != null) void deleteEntry(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
