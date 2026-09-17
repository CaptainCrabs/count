import { db, setMeta } from '../db'
import type { BackupFile } from '../types'

export async function exportBackup(): Promise<BackupFile> {
  const [accounts, transactions, postings, meta, billImports] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.postings.toArray(),
    db.meta.toArray(),
    db.billImports.toArray(),
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    postings,
    meta,
    billImports,
  }
}

export function downloadBackup(backup: BackupFile): void {
  const stamp = backup.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `记账备份-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function importBackup(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object') throw new Error('备份文件无效')
  const backup = data as Partial<BackupFile>
  if (backup.version !== 1) throw new Error('不支持的备份版本')
  if (
    !Array.isArray(backup.accounts) ||
    !Array.isArray(backup.transactions) ||
    !Array.isArray(backup.postings)
  ) {
    throw new Error('备份缺少必要数据')
  }

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
      if (backup.accounts?.length) await db.accounts.bulkAdd(backup.accounts)
      if (backup.transactions?.length) {
        await db.transactions.bulkAdd(backup.transactions)
      }
      if (backup.postings?.length) await db.postings.bulkAdd(backup.postings)
      if (backup.meta?.length) await db.meta.bulkAdd(backup.meta)
      if (backup.billImports?.length) await db.billImports.bulkAdd(backup.billImports)
      await setMeta('onboarded', true)
    },
  )
}

export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text) as unknown
}
