import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = path.join(root, 'data')
export const DIST_DIR = path.join(root, 'dist')
export const LEDGER_PATH = path.join(DATA_DIR, 'ledger.json')
export const TOKEN_PATH = path.join(DATA_DIR, 'access-token.txt')

const emptyLedger = () => ({
  version: 1,
  exportedAt: '',
  updatedAt: 0,
  accounts: [],
  transactions: [],
  postings: [],
  meta: [],
  billImports: [],
})

export async function ensureToken() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    const existing = (await readFile(TOKEN_PATH, 'utf8')).trim()
    if (existing) return existing
  } catch {
    // first run
  }
  const token = randomBytes(4).toString('hex')
  await writeFile(TOKEN_PATH, `${token}\n`, 'utf8')
  return token
}

export async function readLedger() {
  try {
    const raw = await readFile(LEDGER_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data || data.version !== 1) return emptyLedger()
    return data
  } catch {
    return emptyLedger()
  }
}

export async function writeLedger(data) {
  await mkdir(DATA_DIR, { recursive: true })
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    updatedAt: Date.now(),
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    postings: Array.isArray(data.postings) ? data.postings : [],
    meta: Array.isArray(data.meta) ? data.meta : [],
    billImports: Array.isArray(data.billImports) ? data.billImports : [],
  }
  await writeFile(LEDGER_PATH, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

export function lanAddresses() {
  const result = []
  const nets = os.networkInterfaces()
  for (const list of Object.values(nets)) {
    if (!list) continue
    for (const item of list) {
      if (item.internal) continue
      if (item.family !== 'IPv4' && item.family !== 4) continue
      result.push(item.address)
    }
  }
  return result
}
