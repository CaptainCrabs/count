import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { MoneyText } from '../components/MoneyText'
import { Card, PrimaryButton, SelectInput } from '../components/ui'
import { useLedgerData } from '../hooks/useLedgerData'
import {
  buildDrafts,
  commitBillDrafts,
  importedKeySet,
  loadMerchantMap,
  parseBillFile,
  type BillDraft,
} from '../services/bills'
import type { Account, TxType } from '../types'

const TYPE_LABEL: Record<TxType, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
  repayment: '还款',
}

export function ImportBillsPage() {
  const { accounts, ready } = useLedgerData()
  const [drafts, setDrafts] = useState<BillDraft[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')

  const usable = useMemo(
    () => drafts.filter((item) => item.selected && item.entry && !item.duplicate && !item.skipReason),
    [drafts],
  )

  async function onFile(file: File) {
    setBusy(true)
    setError('')
    setMessage('')
    setFileName(file.name)
    try {
      const rows = await parseBillFile(file)
      const [imported, merchantMap] = await Promise.all([
        importedKeySet(),
        loadMerchantMap(),
      ])
      setDrafts(buildDrafts(rows, accounts, imported, merchantMap))
    } catch (err) {
      setDrafts([])
      setError(err instanceof Error ? err.message : '无法读取账单')
    } finally {
      setBusy(false)
    }
  }

  async function onImport() {
    setBusy(true)
    setError('')
    try {
      const result = await commitBillDrafts(drafts)
      setMessage(`已入账 ${result.imported} 笔，跳过 ${result.skipped} 笔`)
      const imported = await importedKeySet()
      const merchantMap = await loadMerchantMap()
      setDrafts((current) =>
        buildDrafts(current, accounts, imported, merchantMap).map((item) => ({
          ...item,
          selected: false,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  function patch(index: number, next: Partial<BillDraft['entry']> & { selected?: boolean }) {
    setDrafts((current) =>
      current.map((item, i) => {
        if (i !== index) return item
        const entry = item.entry
          ? { ...item.entry, ...next }
          : item.entry
        return {
          ...item,
          selected: next.selected ?? item.selected,
          entry,
        }
      }),
    )
  }

  if (!ready) return null

  return (
    <div>
      <PageHeader
        title="导入账单"
        subtitle="用微信、支付宝官方导出的账单自动记账。不会登录你的账号。"
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="怎么导出">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>
              微信：我 → 服务 → 钱包 → 账单 → 右上角 → 下载账单。可直接上传解压后的 xlsx，或未解压的 zip。
            </li>
            <li>
              支付宝：我的 → 账单 → 右上角 → 导出，上传 xlsx / xls / csv 均可。
            </li>
            <li>同一笔交易单号只会入账一次，重复上传会自动跳过。</li>
          </ol>
        </Card>
        <Card title="上传文件">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0b1324] px-4 py-10 text-center">
            <span className="text-sm text-slate-200">
              {fileName || '点击选择 xlsx / xls / csv / zip'}
            </span>
            <span className="mt-2 text-xs text-slate-500">
              建议用官方导出文件，不要改列名
            </span>
            <input
              type="file"
              accept=".csv,.txt,.xls,.xlsx,.xlsm,.zip,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onFile(file)
                event.target.value = ''
              }}
            />
          </label>
        </Card>
      </div>

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
      {message && <p className="mb-3 text-sm text-emerald-300">{message}</p>}

      {drafts.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-400">
              共 {drafts.length} 笔，将导入 {usable.length} 笔
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                onClick={() =>
                  setDrafts((current) =>
                    current.map((item) => ({
                      ...item,
                      selected: Boolean(item.entry) && !item.duplicate && !item.skipReason,
                    })),
                  )
                }
              >
                全选可导入
              </button>
              <PrimaryButton disabled={busy || usable.length === 0} onClick={() => void onImport()}>
                {busy ? '导入中…' : `导入选中的 ${usable.length} 笔`}
              </PrimaryButton>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/8 bg-[#10192c]">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-3">选</th>
                  <th className="px-3 py-3">日期</th>
                  <th className="px-3 py-3">对方 / 商品</th>
                  <th className="px-3 py-3">金额</th>
                  <th className="px-3 py-3">类型</th>
                  <th className="px-3 py-3">账户</th>
                  <th className="px-3 py-3">分类</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((item, index) => (
                  <DraftRow
                    key={`${item.source}-${item.externalId}-${index}`}
                    item={item}
                    accounts={accounts}
                    onToggle={(selected) => patch(index, { selected })}
                    onAccount={(accountId) => patch(index, { accountId })}
                    onCategory={(categoryId) => patch(index, { categoryId })}
                    onFrom={(fromAccountId) => patch(index, { fromAccountId })}
                    onTo={(toAccountId) => patch(index, { toAccountId })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        导入后可到 <Link to="/ledger" className="text-emerald-300">流水</Link> 里检查或改分类。
      </p>
    </div>
  )
}

function DraftRow({
  item,
  accounts,
  onToggle,
  onAccount,
  onCategory,
  onFrom,
  onTo,
}: {
  item: BillDraft
  accounts: Account[]
  onToggle: (selected: boolean) => void
  onAccount: (id: number) => void
  onCategory: (id: number) => void
  onFrom: (id: number) => void
  onTo: (id: number) => void
}) {
  const disabled = Boolean(item.skipReason) || item.duplicate
  const assets = accounts.filter((acc) => acc.type === 'asset' && !acc.archived)
  const pay = accounts.filter(
    (acc) => (acc.type === 'asset' || acc.type === 'liability') && !acc.archived && !acc.isSystem,
  )
  const cats = accounts.filter(
    (acc) =>
      acc.type === (item.entry?.type === 'income' ? 'income' : 'expense') && !acc.archived,
  )
  const debts = accounts.filter((acc) => acc.type === 'liability' && !acc.archived)

  return (
    <tr className={disabled ? 'opacity-50' : ''}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={item.selected && !disabled}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </td>
      <td className="px-3 py-3 text-slate-300">{item.date}</td>
      <td className="px-3 py-3">
        <div className="text-slate-100">{item.counterparty || '—'}</div>
        <div className="text-xs text-slate-500">
          {item.product || item.kind}
          {item.skipReason ? ` · ${item.skipReason}` : ''}
        </div>
      </td>
      <td className="px-3 py-3">
        <MoneyText
          fen={item.direction === 'income' ? item.amount : item.direction === 'expense' ? -item.amount : item.amount}
          signed={item.direction !== 'neutral'}
          tone={item.direction === 'income' ? 'income' : item.direction === 'expense' ? 'expense' : 'neutral'}
        />
      </td>
      <td className="px-3 py-3 text-slate-300">
        {item.entry ? TYPE_LABEL[item.entry.type] : '跳过'}
      </td>
      <td className="px-3 py-3">
        {item.entry?.type === 'expense' || item.entry?.type === 'income' ? (
          <SelectInput
            value={item.entry.accountId ?? ''}
            onChange={(event) => onAccount(Number(event.target.value))}
            disabled={disabled}
          >
            {pay.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </SelectInput>
        ) : null}
        {item.entry?.type === 'transfer' || item.entry?.type === 'repayment' ? (
          <div className="grid gap-2">
            <SelectInput
              value={item.entry.fromAccountId ?? ''}
              onChange={(event) => onFrom(Number(event.target.value))}
              disabled={disabled}
            >
              {assets.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={item.entry.toAccountId ?? ''}
              onChange={(event) => onTo(Number(event.target.value))}
              disabled={disabled}
            >
              {(item.entry.type === 'repayment' ? debts : assets).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </SelectInput>
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        {item.entry?.type === 'expense' || item.entry?.type === 'income' ? (
          <SelectInput
            value={item.entry.categoryId ?? ''}
            onChange={(event) => onCategory(Number(event.target.value))}
            disabled={disabled}
          >
            {cats.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </SelectInput>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
    </tr>
  )
}
