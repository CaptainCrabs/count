import { subMonths } from 'date-fns'
import { toISODate } from '../lib/dates'
import { yuanToFen } from '../lib/money'
import type { Account, AccountType, NewEntry } from '../types'
import { db, setMeta } from './index'
import { saveEntry } from '../services/ledger'

const DEFAULT_CURRENCY = 'CNY'

type SeedAccount = {
  name: string
  type: AccountType
  color: string
  sort: number
  isSystem?: boolean
}

export const DEFAULT_CHART: SeedAccount[] = [
  { name: '现金', type: 'asset', color: '#fbbf24', sort: 10 },
  { name: '银行卡', type: 'asset', color: '#60a5fa', sort: 20 },
  { name: '支付宝', type: 'asset', color: '#22d3ee', sort: 30 },
  { name: '微信支付', type: 'asset', color: '#34d399', sort: 40 },
  { name: '基金理财', type: 'asset', color: '#a78bfa', sort: 50 },
  { name: '信用卡', type: 'liability', color: '#fb7185', sort: 60 },
  {
    name: '期初净资产',
    type: 'equity',
    color: '#94a3b8',
    sort: 70,
    isSystem: true,
  },
  { name: '工资', type: 'income', color: '#34d399', sort: 110 },
  { name: '奖金', type: 'income', color: '#4ade80', sort: 120 },
  { name: '理财收益', type: 'income', color: '#2dd4bf', sort: 130 },
  { name: '其他收入', type: 'income', color: '#86efac', sort: 140 },
  { name: '餐饮', type: 'expense', color: '#fb923c', sort: 210 },
  { name: '交通', type: 'expense', color: '#38bdf8', sort: 220 },
  { name: '住房', type: 'expense', color: '#a78bfa', sort: 230 },
  { name: '购物', type: 'expense', color: '#f472b6', sort: 240 },
  { name: '日用', type: 'expense', color: '#2dd4bf', sort: 250 },
  { name: '娱乐', type: 'expense', color: '#c084fc', sort: 260 },
  { name: '医疗', type: 'expense', color: '#fb7185', sort: 270 },
  { name: '通讯', type: 'expense', color: '#60a5fa', sort: 280 },
  { name: '其他', type: 'expense', color: '#94a3b8', sort: 290 },
]

function toAccount(seed: SeedAccount): Account {
  return {
    name: seed.name,
    type: seed.type,
    currency: DEFAULT_CURRENCY,
    openingBalance: 0,
    color: seed.color,
    sort: seed.sort,
    archived: false,
    isSystem: Boolean(seed.isSystem),
  }
}

export async function seedChartOfAccounts(): Promise<void> {
  const count = await db.accounts.count()
  if (count > 0) return
  await db.accounts.bulkAdd(DEFAULT_CHART.map(toAccount))
  await setMeta('chartSeeded', true)
}

async function accountIdByName(name: string): Promise<number> {
  const account = await db.accounts.where('name').equals(name).first()
  if (!account?.id) throw new Error(`未找到账户：${name}`)
  return account.id
}

const DEMO_OPENINGS: Record<string, number> = {
  现金: 860,
  银行卡: 42850,
  支付宝: 3560,
  微信支付: 1280,
  基金理财: 12000,
  信用卡: 9800,
}

type DemoDraft = {
  day: number
  type: NewEntry['type']
  amount: number
  note: string
  category?: string
  account?: string
  from?: string
  to?: string
}

const MONTHLY_TEMPLATES: DemoDraft[] = [
  { day: 1, type: 'expense', amount: 4500, category: '住房', account: '银行卡', note: '房租' },
  { day: 3, type: 'expense', amount: 68, category: '餐饮', account: '支付宝', note: '午饭' },
  { day: 4, type: 'expense', amount: 12, category: '交通', account: '微信支付', note: '地铁' },
  { day: 5, type: 'expense', amount: 126, category: '日用', account: '支付宝', note: '超市' },
  { day: 6, type: 'expense', amount: 42, category: '餐饮', account: '微信支付', note: '早餐' },
  { day: 8, type: 'expense', amount: 89, category: '餐饮', account: '支付宝', note: '晚餐' },
  { day: 10, type: 'income', amount: 18500, category: '工资', account: '银行卡', note: '月薪' },
  { day: 11, type: 'transfer', amount: 3000, from: '银行卡', to: '支付宝', note: '备用金' },
  { day: 12, type: 'expense', amount: 35, category: '交通', account: '微信支付', note: '打车' },
  { day: 13, type: 'expense', amount: 58, category: '餐饮', account: '支付宝', note: '午饭' },
  { day: 15, type: 'repayment', amount: 1500, from: '银行卡', to: '信用卡', note: '信用卡还款' },
  { day: 16, type: 'expense', amount: 268, category: '购物', account: '信用卡', note: '日用品' },
  { day: 18, type: 'expense', amount: 79, category: '餐饮', account: '支付宝', note: '聚餐' },
  { day: 20, type: 'expense', amount: 99, category: '通讯', account: '银行卡', note: '话费网费' },
  { day: 21, type: 'expense', amount: 46, category: '餐饮', account: '微信支付', note: '午饭' },
  { day: 23, type: 'expense', amount: 168, category: '娱乐', account: '支付宝', note: '电影' },
  { day: 25, type: 'income', amount: 86.5, category: '理财收益', account: '基金理财', note: '基金分红' },
  { day: 27, type: 'expense', amount: 52, category: '餐饮', account: '支付宝', note: '晚饭' },
  { day: 28, type: 'expense', amount: 36, category: '交通', account: '微信支付', note: '地铁月结' },
]

const EXTRA_BY_OFFSET: Record<number, DemoDraft[]> = {
  1: [
    { day: 8, type: 'income', amount: 3200, category: '奖金', account: '银行卡', note: '季度奖金' },
    { day: 19, type: 'expense', amount: 320, category: '医疗', account: '微信支付', note: '配镜' },
  ],
  2: [
    { day: 14, type: 'expense', amount: 899, category: '购物', account: '信用卡', note: '换季衣服' },
  ],
  3: [
    { day: 9, type: 'expense', amount: 210, category: '其他', account: '支付宝', note: '礼金' },
  ],
}

export async function seedDemoData(): Promise<void> {
  await seedChartOfAccounts()

  const existing = await db.transactions.count()
  if (existing > 0) {
    throw new Error('当前账本已有流水，请先清空后再载入演示数据')
  }

  const names = Object.keys(DEMO_OPENINGS)
  for (const name of names) {
    const account = await db.accounts.where('name').equals(name).first()
    if (!account?.id) continue
    await db.accounts.update(account.id, {
      openingBalance: yuanToFen(DEMO_OPENINGS[name] ?? 0),
    })
  }

  const today = toISODate(new Date())
  const drafts: Array<NewEntry> = []

  for (let offset = 3; offset >= 0; offset -= 1) {
    const monthDate = subMonths(new Date(), offset)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const templates = [
      ...MONTHLY_TEMPLATES,
      ...(EXTRA_BY_OFFSET[offset] ?? []),
    ]

    for (const item of templates) {
      const date = toISODate(new Date(year, month, item.day))
      if (date > today) continue
      drafts.push({
        type: item.type,
        date,
        amount: yuanToFen(item.amount),
        note: item.note,
        tags: offset === 0 ? ['演示'] : [],
        categoryId: item.category
          ? await accountIdByName(item.category)
          : undefined,
        accountId: item.account ? await accountIdByName(item.account) : undefined,
        fromAccountId: item.from ? await accountIdByName(item.from) : undefined,
        toAccountId: item.to ? await accountIdByName(item.to) : undefined,
      })
    }
  }

  for (const draft of drafts) {
    await saveEntry(draft)
  }

  await setMeta('demoLoaded', true)
  await setMeta('onboarded', true)
}

export async function resetLedger(): Promise<void> {
  await db.transaction(
    'rw',
    db.accounts,
    db.transactions,
    db.postings,
    db.meta,
    db.billImports,
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.transactions.clear(),
        db.postings.clear(),
        db.meta.clear(),
        db.billImports.clear(),
      ])
    },
  )
}
