import { unzipSync } from 'fflate'
import * as XLSX from 'xlsx'
import { db, getMeta, setMeta } from '../db'
import { parseYuanInput } from '../lib/money'
import type {
  Account,
  BillImport,
  BillSource,
  NewEntry,
  TxType,
} from '../types'
import { saveEntry } from './ledger'

export type ParsedBillRow = {
  source: BillSource
  externalId: string
  date: string
  time: string
  direction: 'income' | 'expense' | 'neutral'
  amount: number
  counterparty: string
  product: string
  method: string
  status: string
  kind: string
  note: string
}

export type BillDraft = ParsedBillRow & {
  selected: boolean
  duplicate: boolean
  skipReason?: string
  entry?: NewEntry
}

const FAILED = /关闭|失败|未支付|未付款|等待|处理中|冻结|已撤销|已全额退款/

const EXPENSE_RULES: Array<[RegExp, string]> = [
  [/餐|外卖|美团|饿了么|肯德基|麦当劳|瑞幸|星巴克|奶茶|咖啡|火锅|面馆|食堂|小吃|烧烤|汉堡/, '餐饮'],
  [/滴滴|地铁|公交|高铁|铁路|出行|加油|停车|哈啰|青桔|顺风车|打车|机票|火车/, '交通'],
  [/房租|电费|水费|燃气|物业|宽带|房东/, '住房'],
  [/淘宝|天猫|京东|拼多多|抖音电商|得物|唯品会|超市|便利店|盒马|山姆/, '购物'],
  [/电影|游戏|会员|爱奇艺|腾讯视频|优酷|演出|门票|娱乐/, '娱乐'],
  [/医院|药房|药店|医保|口腔|体检/, '医疗'],
  [/话费|流量|中国移动|联通|电信|通信/, '通讯'],
  [/日用|清洁|洗衣液|纸巾/, '日用'],
]

function looksLikeBill(text: string): boolean {
  return (
    text.includes('微信支付') ||
    text.includes('支付宝') ||
    (text.includes('收/支') && text.includes('金额'))
  )
}

function decodeBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (looksLikeBill(utf8) && !utf8.includes('\uFFFD')) return utf8
  for (const encoding of ['gb18030', 'gbk', 'gb2312']) {
    try {
      const text = new TextDecoder(encoding as 'utf-8').decode(buffer)
      if (looksLikeBill(text)) return text
    } catch {
      // browser may not support this encoding
    }
  }
  return utf8
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 1
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',' || ch === '\t') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      if (row.some((item) => item)) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell.trim())
    if (row.some((item) => item)) rows.push(row)
  }
  return rows
}

function parseHtmlTables(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const rows: string[][] = []
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const cells = Array.from(tr.querySelectorAll('th,td')).map((cell) =>
      (cell.textContent ?? '').trim(),
    )
    if (cells.some((item) => item)) rows.push(cells)
  }
  return rows
}

function cleanHeader(value: string): string {
  return value.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')')
}

function findHeaderIndex(rows: string[][]): number {
  return rows.findIndex((row) => {
    const line = row.map(cleanHeader).join(',')
    return (
      line.includes('收/支') &&
      (line.includes('金额') || line.includes('交易时间') || line.includes('交易号'))
    )
  })
}

function pick(row: string[], headers: string[], aliases: string[]): string {
  const index = headers.findIndex((header) =>
    aliases.some((alias) => header.includes(alias)),
  )
  return index >= 0 ? (row[index] ?? '').trim() : ''
}

function detectSource(text: string, fileName: string): BillSource {
  const name = fileName.toLowerCase()
  if (name.includes('alipay') || name.includes('支付宝') || text.includes('支付宝')) {
    return 'alipay'
  }
  return 'wechat'
}

function pad2(value: string | number): string {
  return String(value).padStart(2, '0')
}

function toDate(value: string): { date: string; time: string } {
  const cn = value.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/,
  )
  if (cn) {
    const date = `${cn[1]}-${pad2(cn[2])}-${pad2(cn[3])}`
    return { date, time: cn[4] ? `${date} ${cn[4]}` : date }
  }
  const match = value.match(
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/,
  )
  if (!match) return { date: '', time: value }
  const date = `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`
  return { date, time: match[4] ? `${date} ${match[4]}` : date }
}

function cellText(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
  }
  return String(value).trim()
}

function flattenPreview(rows: string[][]): string {
  return rows.slice(0, 40).flat().join(' ')
}

function excelToRows(buffer: ArrayBuffer): string[][] | null {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name]
      if (!sheet) continue
      const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
        blankrows: false,
      }) as unknown[][]
      const rows = raw.map((row) => row.map((cell) => cellText(cell)))
      if (findHeaderIndex(rows) >= 0) return rows
    }
  } catch {
    return null
  }
  return null
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

function parseZipBills(bytes: Uint8Array, zipName: string): ParsedBillRow[] {
  const files = unzipSync(bytes)
  const entries = Object.entries(files)
    .filter(([name]) => {
      const lower = name.toLowerCase()
      return (
        !name.endsWith('/') &&
        !lower.includes('__macosx') &&
        (lower.endsWith('.xlsx') ||
          lower.endsWith('.xls') ||
          lower.endsWith('.xlsm') ||
          lower.endsWith('.csv') ||
          lower.endsWith('.txt'))
      )
    })
    .sort(([a], [b]) => {
      const rank = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return 0
        if (lower.endsWith('.xls')) return 1
        if (lower.endsWith('.csv')) return 2
        return 3
      }
      return rank(a) - rank(b)
    })

  for (const [name, data] of entries) {
    const copy = data.slice().buffer
    const lower = name.toLowerCase()
    try {
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = decodeBuffer(copy)
        return rowsToBills(parseCsv(text), detectSource(text, `${zipName}/${name}`))
      }
      const rows = excelToRows(copy)
      if (rows) {
        return rowsToBills(
          rows,
          detectSource(flattenPreview(rows), `${zipName}/${name}`),
        )
      }
    } catch {
      // try next file in the archive
    }
  }
  throw new Error('压缩包里没有识别到账单，请上传其中的 xlsx 或 csv')
}

function fingerprint(parts: string[]): string {
  return parts.join('|')
}

export function rowsToBills(
  rows: string[][],
  source: BillSource,
): ParsedBillRow[] {
  const headerAt = findHeaderIndex(rows)
  if (headerAt < 0) throw new Error('没有识别到账单表头，请确认是微信或支付宝官方导出文件')
  const headers = rows[headerAt].map(cleanHeader)
  const bills: ParsedBillRow[] = []

  for (const raw of rows.slice(headerAt + 1)) {
    if (raw.map(cleanHeader).join(',').includes('收/支')) continue
    const timeRaw =
      pick(raw, headers, ['交易时间', '付款时间', '交易创建时间']) ||
      pick(raw, headers, ['时间'])
    const { date, time } = toDate(timeRaw)
    const directionRaw = pick(raw, headers, ['收/支'])
    const amount = Math.abs(parseYuanInput(pick(raw, headers, ['金额'])))
    const counterparty = pick(raw, headers, ['交易对方', '对方'])
    const product = pick(raw, headers, ['商品名称', '商品', '说明'])
    const method = pick(raw, headers, ['支付方式', '收/付款方式'])
    const status = pick(raw, headers, ['当前状态', '交易状态', '资金状态'])
    const kind = pick(raw, headers, ['交易类型', '类型'])
    const note = pick(raw, headers, ['备注'])
    const externalId =
      pick(raw, headers, ['交易单号', '交易号']) ||
      fingerprint([source, timeRaw, String(amount), counterparty, product])
    if (!date || !amount) continue

    let direction: ParsedBillRow['direction'] = 'neutral'
    if (directionRaw.includes('收入') || directionRaw === '收') direction = 'income'
    else if (directionRaw.includes('支出') || directionRaw === '支') direction = 'expense'

    bills.push({
      source,
      externalId,
      date,
      time,
      direction,
      amount,
      counterparty,
      product,
      method,
      status,
      kind,
      note,
    })
  }
  return bills
}

export async function parseBillFile(file: File): Promise<ParsedBillRow[]> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const excelRows = excelToRows(buffer)
  if (excelRows) {
    return rowsToBills(
      excelRows,
      detectSource(flattenPreview(excelRows), file.name),
    )
  }
  if (isZip(bytes)) return parseZipBills(bytes, file.name)

  const text = decodeBuffer(buffer)
  const source = detectSource(text, file.name)
  const rows = /<html|<table/i.test(text) ? parseHtmlTables(text) : parseCsv(text)
  if (!rows.length) throw new Error('文件是空的')
  return rowsToBills(rows, source)
}

function findAccount(accounts: Account[], testers: Array<(name: string) => boolean>): Account | undefined {
  return accounts.find(
    (item) =>
      !item.archived &&
      !item.isSystem &&
      testers.some((test) => test(item.name)),
  )
}

function accountByTypeName(
  accounts: Account[],
  type: Account['type'],
  names: string[],
): Account | undefined {
  return findAccount(
    accounts.filter((item) => item.type === type),
    names.map((name) => (item: string) => item.includes(name)),
  )
}

function guessPayAccount(accounts: Account[], row: ParsedBillRow): Account | undefined {
  const method = row.method || ''
  if (/信用卡|花呗|白条/.test(method)) {
    return (
      accountByTypeName(accounts, 'liability', ['花呗', '白条', '信用卡']) ??
      accountByTypeName(accounts, 'asset', ['支付宝'])
    )
  }
  if (/银行|储蓄卡|借记卡|招行|工商|建设|农业|交通银行|广发|浦发|民生|邮储/.test(method)) {
    return accountByTypeName(accounts, 'asset', ['银行'])
  }
  if (/零钱|微信/.test(method)) {
    return accountByTypeName(accounts, 'asset', ['微信'])
  }
  if (/支付宝|余额宝|余额/.test(method)) {
    return accountByTypeName(accounts, 'asset', ['支付宝'])
  }
  if (row.source === 'wechat') return accountByTypeName(accounts, 'asset', ['微信'])
  return (
    accountByTypeName(accounts, 'asset', ['支付宝']) ??
    accounts.find((item) => item.type === 'asset' && !item.archived)
  )
}

function guessCategory(
  accounts: Account[],
  type: 'income' | 'expense',
  row: ParsedBillRow,
  merchantMap: Record<string, number>,
): Account | undefined {
  const mapped = merchantMap[merchantKey(row)]
  if (mapped) {
    const found = accounts.find((item) => item.id === mapped && item.type === type)
    if (found) return found
  }
  const hay = `${row.counterparty} ${row.product} ${row.kind} ${row.note}`
  const cats = accounts.filter((item) => item.type === type && !item.archived)
  if (type === 'income') {
    if (/工资|薪/.test(hay)) return cats.find((item) => item.name.includes('工资'))
    if (/理财|基金|利息|分红/.test(hay)) return cats.find((item) => item.name.includes('理财'))
    return cats.find((item) => item.name.includes('其他')) ?? cats[0]
  }
  for (const [pattern, name] of EXPENSE_RULES) {
    if (pattern.test(hay)) {
      const found = cats.find((item) => item.name.includes(name))
      if (found) return found
    }
  }
  return cats.find((item) => item.name.includes('其他')) ?? cats[0]
}

export function merchantKey(row: ParsedBillRow): string {
  return `${row.source}:${row.counterparty || row.product || '未知'}`
}

function isFailed(row: ParsedBillRow): boolean {
  return FAILED.test(row.status)
}

function isTransferLike(row: ParsedBillRow): boolean {
  const hay = `${row.kind}${row.product}${row.counterparty}`
  return /提现|充值|转入|转出|零钱通|余额宝自动转入|余额宝-转出/.test(hay)
}

function isRepayment(row: ParsedBillRow): boolean {
  const hay = `${row.kind}${row.product}${row.counterparty}`
  return /还款|还信用卡|花呗还款/.test(hay)
}

export function buildDrafts(
  rows: ParsedBillRow[],
  accounts: Account[],
  importedIds: Set<string>,
  merchantMap: Record<string, number>,
): BillDraft[] {
  return rows.map((row) => {
    const duplicate = importedIds.has(`${row.source}:${row.externalId}`)
    if (isFailed(row)) {
      return { ...row, selected: false, duplicate, skipReason: `状态：${row.status || '未成功'}` }
    }
    if (duplicate) {
      return { ...row, selected: false, duplicate, skipReason: '已经导入过' }
    }

    const pay = guessPayAccount(accounts, row)
    if (isRepayment(row)) {
      const from =
        guessPayAccount(accounts, { ...row, method: row.method || '银行卡' }) ??
        accountByTypeName(accounts, 'asset', ['银行', '支付宝', '微信'])
      const to =
        accountByTypeName(accounts, 'liability', ['信用卡', '花呗']) ??
        accounts.find((item) => item.type === 'liability' && !item.archived)
      if (!from || !to) {
        return { ...row, selected: false, duplicate, skipReason: '找不到还款账户' }
      }
      return {
        ...row,
        selected: true,
        duplicate,
        entry: {
          type: 'repayment',
          date: row.date,
          amount: row.amount,
          note: noteOf(row),
          tags: [row.source === 'wechat' ? '微信账单' : '支付宝账单'],
          fromAccountId: from.id,
          toAccountId: to.id,
        },
      }
    }

    if (row.direction === 'neutral' && isTransferLike(row)) {
      const wechat = accountByTypeName(accounts, 'asset', ['微信'])
      const alipay = accountByTypeName(accounts, 'asset', ['支付宝'])
      const bank = accountByTypeName(accounts, 'asset', ['银行'])
      const wallet = row.source === 'wechat' ? wechat : alipay
      let from = wallet
      let to = bank
      if (/充值|转入/.test(`${row.kind}${row.product}`) && !/转出/.test(row.kind)) {
        from = bank
        to = wallet
      }
      if (!from || !to || from.id === to.id) {
        return { ...row, selected: false, duplicate, skipReason: '无法判断转账账户' }
      }
      return {
        ...row,
        selected: true,
        duplicate,
        entry: {
          type: 'transfer',
          date: row.date,
          amount: row.amount,
          note: noteOf(row),
          tags: [row.source === 'wechat' ? '微信账单' : '支付宝账单'],
          fromAccountId: from.id,
          toAccountId: to.id,
        },
      }
    }

    const txType: TxType = row.direction === 'income' ? 'income' : 'expense'
    if (row.direction === 'neutral') {
      return { ...row, selected: false, duplicate, skipReason: '不计收支，已跳过' }
    }
    const category = guessCategory(accounts, txType, row, merchantMap)
    if (!pay?.id || !category?.id) {
      return { ...row, selected: false, duplicate, skipReason: '缺少账户或分类' }
    }
    return {
      ...row,
      selected: true,
      duplicate,
      entry: {
        type: txType,
        date: row.date,
        amount: row.amount,
        note: noteOf(row),
        tags: [row.source === 'wechat' ? '微信账单' : '支付宝账单'],
        categoryId: category.id,
        accountId: pay.id,
      },
    }
  })
}

function noteOf(row: ParsedBillRow): string {
  return [row.counterparty, row.product, row.note].filter(Boolean).join(' · ')
}

export async function loadMerchantMap(): Promise<Record<string, number>> {
  return (await getMeta<Record<string, number>>('billMerchantMap')) ?? {}
}

export async function rememberMerchantCategory(
  row: ParsedBillRow,
  categoryId: number,
): Promise<void> {
  const map = await loadMerchantMap()
  map[merchantKey(row)] = categoryId
  await setMeta('billMerchantMap', map)
}

export async function importedKeySet(): Promise<Set<string>> {
  const rows = await db.billImports.toArray()
  return new Set(rows.map((item) => `${item.source}:${item.externalId}`))
}

export async function commitBillDrafts(drafts: BillDraft[]): Promise<{
  imported: number
  skipped: number
}> {
  let imported = 0
  let skipped = 0
  for (const draft of drafts) {
    if (!draft.selected || !draft.entry || draft.duplicate || draft.skipReason) {
      skipped += 1
      continue
    }
    const exists = await db.billImports
      .where('[source+externalId]')
      .equals([draft.source, draft.externalId])
      .first()
    if (exists) {
      skipped += 1
      continue
    }
    const transactionId = await saveEntry(draft.entry)
    const record: BillImport = {
      source: draft.source,
      externalId: draft.externalId,
      transactionId,
      importedAt: Date.now(),
    }
    await db.billImports.add(record)
    if (draft.entry.categoryId) {
      await rememberMerchantCategory(draft, draft.entry.categoryId)
    }
    imported += 1
  }
  return { imported, skipped }
}
