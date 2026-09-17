import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLedgerData } from '../hooks/useLedgerData'
import { defaultEntryDate } from '../lib/dates'
import { parseYuanInput, yuanInputFromFen } from '../lib/money'
import { saveEntry } from '../services/ledger'
import { useAppStore } from '../store/useAppStore'
import type { Account, TxType } from '../types'
import { Modal } from './Modal'
import { Field, PrimaryButton, SelectInput, TextArea, TextInput } from './ui'

const TYPES: Array<{ id: TxType; label: string }> = [
  { id: 'expense', label: '支出' },
  { id: 'income', label: '收入' },
  { id: 'transfer', label: '转账' },
  { id: 'repayment', label: '还款' },
]

export function QuickEntry() {
  const open = useAppStore((state) => state.quickOpen)
  const draft = useAppStore((state) => state.draft)
  const close = useAppStore((state) => state.closeQuick)
  const remember = useAppStore((state) => state.remember)
  const prefs = useAppStore((state) => state.prefs)
  const currentMonth = useAppStore((state) => state.currentMonth)
  const { accounts } = useLedgerData()

  const [type, setType] = useState<TxType>('expense')
  const [date, setDate] = useState(defaultEntryDate(currentMonth))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const editingId = draft?.id

  const assets = useMemo(
    () => visible(accounts, 'asset'),
    [accounts],
  )
  const liabilities = useMemo(
    () => visible(accounts, 'liability'),
    [accounts],
  )
  const payAccounts = useMemo(
    () => [...visible(accounts, 'asset'), ...visible(accounts, 'liability')],
    [accounts],
  )
  const incomeCats = useMemo(() => visible(accounts, 'income'), [accounts])
  const expenseCats = useMemo(() => visible(accounts, 'expense'), [accounts])

  useEffect(() => {
    if (!open) return
    const nextType = draft?.type ?? 'expense'
    setType(nextType)
    setDate(draft?.date ?? defaultEntryDate(currentMonth))
    setAmount(draft?.amount ? yuanInputFromFen(draft.amount) : '')
    setNote(draft?.note ?? '')
    setTags(draft?.tags?.join(', ') ?? '')
    setError('')

    if (nextType === 'expense') {
      setCategoryId(String(draft?.categoryId ?? prefs.lastExpenseCategoryId ?? ''))
      setAccountId(String(draft?.accountId ?? prefs.lastExpenseAccountId ?? ''))
    } else if (nextType === 'income') {
      setCategoryId(String(draft?.categoryId ?? prefs.lastIncomeCategoryId ?? ''))
      setAccountId(String(draft?.accountId ?? prefs.lastIncomeAccountId ?? ''))
    } else if (nextType === 'transfer') {
      setFromAccountId(String(draft?.fromAccountId ?? prefs.lastTransferFromId ?? ''))
      setToAccountId(String(draft?.toAccountId ?? prefs.lastTransferToId ?? ''))
    } else {
      setFromAccountId(String(draft?.fromAccountId ?? prefs.lastRepayFromId ?? ''))
      setToAccountId(String(draft?.toAccountId ?? prefs.lastRepayToId ?? ''))
    }
  }, [open, draft, currentMonth, prefs])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        id: editingId,
        type,
        date,
        amount: parseYuanInput(amount),
        note: note.trim(),
        tags: tags
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean),
        categoryId: categoryId ? Number(categoryId) : undefined,
        accountId: accountId ? Number(accountId) : undefined,
        fromAccountId: fromAccountId ? Number(fromAccountId) : undefined,
        toAccountId: toAccountId ? Number(toAccountId) : undefined,
      }
      await saveEntry(payload)
      remember(type, payload)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editingId ? '编辑流水' : '记一笔'}
    >
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setType(item.id)
                setCategoryId('')
                setAccountId('')
                setFromAccountId('')
                setToAccountId('')
              }}
              className={
                type === item.id
                  ? 'rounded-xl bg-emerald-400/15 py-2 text-sm font-medium text-emerald-300'
                  : 'rounded-xl bg-white/5 py-2 text-sm text-slate-400 hover:bg-white/8'
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <Field label="金额">
          <TextInput
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="日期">
            <TextInput
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>

          {type === 'expense' && (
            <>
              <Field label="分类">
                <AccountOptions
                  value={categoryId}
                  onChange={setCategoryId}
                  accounts={expenseCats}
                  placeholder="选择支出分类"
                />
              </Field>
              <Field label="付款账户">
                <AccountOptions
                  value={accountId}
                  onChange={setAccountId}
                  accounts={payAccounts}
                  placeholder="从哪里出"
                />
              </Field>
            </>
          )}

          {type === 'income' && (
            <>
              <Field label="分类">
                <AccountOptions
                  value={categoryId}
                  onChange={setCategoryId}
                  accounts={incomeCats}
                  placeholder="选择收入分类"
                />
              </Field>
              <Field label="收款账户">
                <AccountOptions
                  value={accountId}
                  onChange={setAccountId}
                  accounts={assets}
                  placeholder="存到哪里"
                />
              </Field>
            </>
          )}

          {type === 'transfer' && (
            <>
              <Field label="转出">
                <AccountOptions
                  value={fromAccountId}
                  onChange={setFromAccountId}
                  accounts={assets}
                  placeholder="转出账户"
                />
              </Field>
              <Field label="转入">
                <AccountOptions
                  value={toAccountId}
                  onChange={setToAccountId}
                  accounts={assets}
                  placeholder="转入账户"
                />
              </Field>
            </>
          )}

          {type === 'repayment' && (
            <>
              <Field label="付款账户">
                <AccountOptions
                  value={fromAccountId}
                  onChange={setFromAccountId}
                  accounts={assets}
                  placeholder="用哪个账户还"
                />
              </Field>
              <Field label="负债账户">
                <AccountOptions
                  value={toAccountId}
                  onChange={setToAccountId}
                  accounts={liabilities}
                  placeholder="还哪一笔债"
                />
              </Field>
            </>
          )}
        </div>

        <Field label="备注">
          <TextArea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="可选，例如午餐、房租"
          />
        </Field>
        <Field label="标签">
          <TextInput
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="可选，逗号分隔"
          />
        </Field>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? '保存中…' : '保存'}
        </PrimaryButton>
      </form>
    </Modal>
  )
}

function visible(accounts: Account[], type: Account['type']): Account[] {
  return accounts.filter((item) => item.type === type && !item.archived && !item.isSystem)
}

function AccountOptions({
  value,
  onChange,
  accounts,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  accounts: Account[]
  placeholder: string
}) {
  return (
    <SelectInput value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">{placeholder}</option>
      {accounts.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </SelectInput>
  )
}
