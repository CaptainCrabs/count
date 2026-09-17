import { db } from '../db'
import type { Account, AccountType, NewEntry, Posting, Side } from '../types'

export function signedDelta(
  accountType: AccountType,
  side: Side,
  amount: number,
): number {
  const debitPositive = accountType === 'asset' || accountType === 'expense'
  const sign = side === 'debit' ? 1 : -1
  return (debitPositive ? sign : -sign) * amount
}

function requireId(id: number | undefined, message: string): number {
  if (id == null) throw new Error(message)
  return id
}

export function buildPostings(
  input: NewEntry,
): Array<Omit<Posting, 'id' | 'transactionId'>> {
  const amount = input.amount
  if (amount <= 0) throw new Error('金额必须大于 0')

  switch (input.type) {
    case 'expense':
      return [
        {
          accountId: requireId(input.categoryId, '请选择支出分类'),
          amount,
          side: 'debit',
        },
        {
          accountId: requireId(input.accountId, '请选择付款账户'),
          amount,
          side: 'credit',
        },
      ]
    case 'income':
      return [
        {
          accountId: requireId(input.accountId, '请选择收款账户'),
          amount,
          side: 'debit',
        },
        {
          accountId: requireId(input.categoryId, '请选择收入分类'),
          amount,
          side: 'credit',
        },
      ]
    case 'transfer': {
      const fromId = requireId(input.fromAccountId, '请选择转出账户')
      const toId = requireId(input.toAccountId, '请选择转入账户')
      if (fromId === toId) throw new Error('转出与转入不能是同一个账户')
      return [
        { accountId: toId, amount, side: 'debit' },
        { accountId: fromId, amount, side: 'credit' },
      ]
    }
    case 'repayment': {
      const fromId = requireId(input.fromAccountId, '请选择付款账户')
      const toId = requireId(input.toAccountId, '请选择还款负债')
      if (fromId === toId) throw new Error('付款账户与负债账户不能相同')
      return [
        { accountId: toId, amount, side: 'debit' },
        { accountId: fromId, amount, side: 'credit' },
      ]
    }
    default: {
      const neverType: never = input.type
      throw new Error(`未知类型 ${neverType}`)
    }
  }
}

async function assertAccountType(
  id: number,
  allowed: AccountType[],
  message: string,
): Promise<Account> {
  const account = await db.accounts.get(id)
  if (!account) throw new Error('账户不存在')
  if (!allowed.includes(account.type)) throw new Error(message)
  return account
}

export async function saveEntry(input: NewEntry): Promise<number> {
  const postings = buildPostings(input)
  const debit = postings
    .filter((item) => item.side === 'debit')
    .reduce((sum, item) => sum + item.amount, 0)
  const credit = postings
    .filter((item) => item.side === 'credit')
    .reduce((sum, item) => sum + item.amount, 0)
  if (debit !== credit) throw new Error('借贷不平衡')

  if (input.type === 'expense') {
    await assertAccountType(
      requireId(input.categoryId, '请选择支出分类'),
      ['expense'],
      '支出分类无效',
    )
    await assertAccountType(
      requireId(input.accountId, '请选择付款账户'),
      ['asset', 'liability'],
      '付款账户必须是资产或负债',
    )
  }
  if (input.type === 'income') {
    await assertAccountType(
      requireId(input.categoryId, '请选择收入分类'),
      ['income'],
      '收入分类无效',
    )
    await assertAccountType(
      requireId(input.accountId, '请选择收款账户'),
      ['asset'],
      '收款账户必须是资产账户',
    )
  }
  if (input.type === 'transfer') {
    await assertAccountType(
      requireId(input.fromAccountId, '请选择转出账户'),
      ['asset'],
      '转出账户必须是资产',
    )
    await assertAccountType(
      requireId(input.toAccountId, '请选择转入账户'),
      ['asset'],
      '转入账户必须是资产',
    )
  }
  if (input.type === 'repayment') {
    await assertAccountType(
      requireId(input.fromAccountId, '请选择付款账户'),
      ['asset'],
      '付款账户必须是资产',
    )
    await assertAccountType(
      requireId(input.toAccountId, '请选择还款负债'),
      ['liability'],
      '还款对象必须是负债账户',
    )
  }

  const now = Date.now()

  return db.transaction('rw', db.transactions, db.postings, async () => {
    if (input.id != null) {
      const existingId = input.id
      await db.postings.where('transactionId').equals(existingId).delete()
      await db.transactions.update(existingId, {
        date: input.date,
        type: input.type,
        amount: input.amount,
        note: input.note,
        tags: input.tags,
        updatedAt: now,
      })
      await db.postings.bulkAdd(
        postings.map((item) => ({ ...item, transactionId: existingId })),
      )
      return existingId
    }

    const id = await db.transactions.add({
      date: input.date,
      type: input.type,
      amount: input.amount,
      note: input.note,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error('保存失败')
    await db.postings.bulkAdd(
      postings.map((item) => ({ ...item, transactionId: id })),
    )
    return id
  })
}

export async function deleteEntry(id: number): Promise<void> {
  await db.transaction('rw', db.transactions, db.postings, async () => {
    await db.postings.where('transactionId').equals(id).delete()
    await db.transactions.delete(id)
  })
}

export async function createAccount(
  input: Omit<Account, 'id'>,
): Promise<number> {
  const name = input.name.trim()
  if (!name) throw new Error('请填写账户名称')
  const id = await db.accounts.add({ ...input, name })
  if (id == null) throw new Error('创建账户失败')
  return id
}

export async function updateAccount(
  id: number,
  patch: Partial<Account>,
): Promise<void> {
  const current = await db.accounts.get(id)
  if (!current) throw new Error('账户不存在')
  if (current.isSystem && patch.archived) {
    throw new Error('系统账户不能停用')
  }
  await db.accounts.update(id, patch)
}

export async function deleteAccount(id: number): Promise<void> {
  const account = await db.accounts.get(id)
  if (!account) return
  if (account.isSystem) throw new Error('系统账户不能删除')
  const used = await db.postings.where('accountId').equals(id).count()
  if (used > 0 || account.openingBalance !== 0) {
    throw new Error('该账户已有余额或流水，请改为停用')
  }
  await db.accounts.delete(id)
}

export function entryFromTransaction(
  transaction: {
    id?: number
    date: string
    type: NewEntry['type']
    amount: number
    note: string
    tags: string[]
  },
  postings: Posting[],
  accounts: Account[],
): NewEntry {
  const byId = new Map(accounts.map((item) => [item.id, item]))
  const legs = postings.filter((item) => item.transactionId === transaction.id)
  const findByType = (type: AccountType) =>
    legs.find((item) => byId.get(item.accountId)?.type === type)

  switch (transaction.type) {
    case 'expense':
      return {
        id: transaction.id,
        type: 'expense',
        date: transaction.date,
        amount: transaction.amount,
        note: transaction.note,
        tags: transaction.tags,
        categoryId: findByType('expense')?.accountId,
        accountId: legs.find(
          (item) =>
            byId.get(item.accountId)?.type === 'asset' ||
            byId.get(item.accountId)?.type === 'liability',
        )?.accountId,
      }
    case 'income':
      return {
        id: transaction.id,
        type: 'income',
        date: transaction.date,
        amount: transaction.amount,
        note: transaction.note,
        tags: transaction.tags,
        categoryId: findByType('income')?.accountId,
        accountId: findByType('asset')?.accountId,
      }
    case 'transfer': {
      const debit = legs.find((item) => item.side === 'debit')
      const credit = legs.find((item) => item.side === 'credit')
      return {
        id: transaction.id,
        type: 'transfer',
        date: transaction.date,
        amount: transaction.amount,
        note: transaction.note,
        tags: transaction.tags,
        toAccountId: debit?.accountId,
        fromAccountId: credit?.accountId,
      }
    }
    case 'repayment':
      return {
        id: transaction.id,
        type: 'repayment',
        date: transaction.date,
        amount: transaction.amount,
        note: transaction.note,
        tags: transaction.tags,
        toAccountId: findByType('liability')?.accountId,
        fromAccountId: findByType('asset')?.accountId,
      }
    default: {
      const neverType: never = transaction.type
      throw new Error(`未知类型 ${neverType}`)
    }
  }
}
