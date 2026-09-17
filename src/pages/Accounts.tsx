import { useMemo, useState } from 'react'
import { ConfirmDialog, Modal } from '../components/Modal'
import { PageHeader } from '../components/Layout'
import { MoneyText } from '../components/MoneyText'
import {
  Field,
  PrimaryButton,
  SelectInput,
  TextInput,
} from '../components/ui'
import { useLedgerData } from '../hooks/useLedgerData'
import { parseYuanInput, yuanInputFromFen } from '../lib/money'
import {
  createAccount,
  deleteAccount,
  updateAccount,
} from '../services/ledger'
import { computeBalances } from '../services/reports'
import { useAppStore } from '../store/useAppStore'
import { monthEnd } from '../lib/dates'
import type { Account, AccountType } from '../types'

const COLORS = [
  '#34d399',
  '#22d3ee',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#fbbf24',
  '#4ade80',
  '#2dd4bf',
  '#38bdf8',
  '#c084fc',
]

type Tab = 'money' | 'category'

export function AccountsPage() {
  const { accounts, transactions, postings, ready } = useLedgerData()
  const currentMonth = useAppStore((state) => state.currentMonth)
  const [tab, setTab] = useState<Tab>('money')
  const [editing, setEditing] = useState<Partial<Account> | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const [error, setError] = useState('')

  const balances = useMemo(
    () => computeBalances(accounts, transactions, postings, monthEnd(currentMonth)),
    [accounts, transactions, postings, currentMonth],
  )

  const moneyAccounts = accounts.filter(
    (item) =>
      (item.type === 'asset' || item.type === 'liability') && !item.isSystem,
  )
  const categories = accounts.filter(
    (item) => item.type === 'income' || item.type === 'expense',
  )

  if (!ready) return null

  return (
    <div>
      <PageHeader
        title="账户与分类"
        subtitle="资金账户用于收付款，分类用于统计收入和支出。"
        actions={
          <button
            type="button"
            onClick={() =>
              setEditing({
                type: tab === 'money' ? 'asset' : 'expense',
                currency: 'CNY',
                openingBalance: 0,
                color: COLORS[0],
                sort: Date.now(),
                archived: false,
                isSystem: false,
                name: '',
              })
            }
            className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
          >
            {tab === 'money' ? '新增账户' : '新增分类'}
          </button>
        }
      />

      <div className="mb-5 flex gap-2">
        <TabButton active={tab === 'money'} onClick={() => setTab('money')}>
          资金账户
        </TabButton>
        <TabButton active={tab === 'category'} onClick={() => setTab('category')}>
          收支分类
        </TabButton>
      </div>

      {tab === 'money' ? (
        <div className="grid gap-3">
          {moneyAccounts.map((item) => (
            <AccountRow
              key={item.id}
              account={item}
              balance={balances.get(item.id as number) ?? 0}
              onEdit={() => setEditing(item)}
              onDelete={() => setPendingDelete(item)}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryGroup
            title="收入"
            items={categories.filter((item) => item.type === 'income')}
            onEdit={setEditing}
            onDelete={setPendingDelete}
          />
          <CategoryGroup
            title="支出"
            items={categories.filter((item) => item.type === 'expense')}
            onEdit={setEditing}
            onDelete={setPendingDelete}
          />
        </div>
      )}

      {editing && (
        <AccountEditor
          account={editing}
          onClose={() => setEditing(null)}
          moneyMode={tab === 'money'}
        />
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title="删除这个项目？"
        message="若已有流水或期初余额，将无法删除，请改为停用。"
        confirmText="删除"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete?.id) return
          void deleteAccount(pendingDelete.id).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : '删除失败')
          })
          setPendingDelete(null)
        }}
      />
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-2xl bg-emerald-400/15 px-4 py-2 text-sm text-emerald-300'
          : 'rounded-2xl bg-white/5 px-4 py-2 text-sm text-slate-400'
      }
    >
      {children}
    </button>
  )
}

function AccountRow({
  account,
  balance,
  onEdit,
  onDelete,
}: {
  account: Account
  balance: number
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-[#10192c] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm text-white">
          <i className="size-2.5 rounded-full" style={{ background: account.color }} />
          {account.name}
          {account.archived && (
            <span className="text-[11px] text-slate-500">已停用</span>
          )}
          <span className="text-[11px] text-slate-500">
            {account.type === 'asset' ? '资产' : '负债'}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          期初 ¥{yuanInputFromFen(account.openingBalance) || '0'}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <MoneyText fen={balance} className="text-base font-medium" />
        <button type="button" className="text-xs text-slate-400 hover:text-white" onClick={onEdit}>
          编辑
        </button>
        <button type="button" className="text-xs text-rose-300" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  )
}

function CategoryGroup({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string
  items: Account[]
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}) {
  return (
    <section className="rounded-3xl border border-white/8 bg-[#10192c] p-5">
      <h2 className="mb-4 text-sm text-slate-300">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-200">
              <i className="size-2.5 rounded-full" style={{ background: item.color }} />
              {item.name}
              {item.archived && <span className="text-[11px] text-slate-500">已停用</span>}
            </span>
            <span className="flex gap-3">
              <button type="button" className="text-xs text-slate-400" onClick={() => onEdit(item)}>
                编辑
              </button>
              <button type="button" className="text-xs text-rose-300" onClick={() => onDelete(item)}>
                删除
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AccountEditor({
  account,
  onClose,
  moneyMode,
}: {
  account: Partial<Account>
  onClose: () => void
  moneyMode: boolean
}) {
  const [name, setName] = useState(account.name ?? '')
  const [type, setType] = useState<AccountType>(account.type ?? (moneyMode ? 'asset' : 'expense'))
  const [opening, setOpening] = useState(yuanInputFromFen(account.openingBalance ?? 0))
  const [color, setColor] = useState(account.color ?? COLORS[0])
  const [archived, setArchived] = useState(Boolean(account.archived))
  const [error, setError] = useState('')
  const isNew = account.id == null

  async function onSave() {
    setError('')
    try {
      const payload = {
        name,
        type,
        currency: 'CNY',
        openingBalance:
          type === 'asset' || type === 'liability' ? parseYuanInput(opening) : 0,
        color,
        sort: account.sort ?? Date.now(),
        archived,
        isSystem: false,
      }
      if (isNew) await createAccount(payload)
      else await updateAccount(account.id as number, payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  return (
    <Modal
      open
      title={isNew ? (moneyMode ? '新增账户' : '新增分类') : '编辑'}
      onClose={onClose}
    >
      <div className="space-y-4">
        <Field label="名称">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {isNew && (
          <Field label="类型">
            <SelectInput
              value={type}
              onChange={(event) => setType(event.target.value as AccountType)}
            >
              {moneyMode ? (
                <>
                  <option value="asset">资产</option>
                  <option value="liability">负债</option>
                </>
              ) : (
                <>
                  <option value="income">收入</option>
                  <option value="expense">支出</option>
                </>
              )}
            </SelectInput>
          </Field>
        )}
        {(type === 'asset' || type === 'liability') && (
          <Field label={type === 'liability' ? '期初欠款' : '期初余额'}>
            <TextInput
              inputMode="decimal"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
            />
          </Field>
        )}
        <div>
          <div className="mb-2 text-xs text-slate-400">颜色</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                className="size-7 rounded-full border-2"
                style={{
                  background: item,
                  borderColor: color === item ? 'white' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />
            停用（记账时不再显示）
          </label>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <PrimaryButton onClick={() => void onSave()} className="w-full">
          保存
        </PrimaryButton>
      </div>
    </Modal>
  )
}
