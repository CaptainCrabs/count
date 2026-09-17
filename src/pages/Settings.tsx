import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/Modal'
import { PageHeader } from '../components/Layout'
import { Card, PrimaryButton } from '../components/ui'
import { resetLedger, seedDemoData } from '../db/seed'
import {
  downloadBackup,
  exportBackup,
  importBackup,
  readBackupFile,
} from '../services/backup'
import { getSyncStatus, subscribeSync, type SyncStatus } from '../services/sync'

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus)

  useEffect(() => subscribeSync(() => setSync(getSyncStatus())), [])

  async function onExport() {
    const backup = await exportBackup()
    downloadBackup(backup)
    setMessage('已开始下载备份文件')
  }

  async function onImport(file: File) {
    setBusy(true)
    setError('')
    try {
      const data = await readBackupFile(file)
      await importBackup(data)
      setMessage('备份已导入，页面数据会自动刷新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDemo() {
    setBusy(true)
    setError('')
    try {
      await seedDemoData()
      setMessage('演示数据已载入')
    } catch (err) {
      setError(err instanceof Error ? err.message : '载入失败')
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    setBusy(true)
    try {
      await resetLedger()
      setConfirmReset(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="设置"
        subtitle="账本存在这台电脑上。重启后请运行「启动记账.bat」，手机才能连上来。"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="手机访问">
          {sync.serverAvailable ? (
            <div className="space-y-2 text-sm leading-6 text-slate-300">
              {sync.token && (
                <p>
                  访问码：
                  <span className="ml-2 font-mono text-emerald-300">
                    {sync.token}
                  </span>
                </p>
              )}
              {sync.lanUrls.length > 0 && (
                <p>
                  同一 WiFi 打开：
                  {sync.lanUrls.map((url) => (
                    <span key={url} className="mt-1 block font-mono text-cyan-300">
                      {url}
                    </span>
                  ))}
                </p>
              )}
              <p className="text-xs text-slate-500">
                离开家里的网时，在电脑上运行「公网分享.bat」，把生成的 https 地址发给手机，再用访问码进入。
              </p>
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-400">
              当前是开发预览。请双击项目里的「启动记账.bat」，电脑才会作为服务器，手机才能看到同一本账。
            </p>
          )}
        </Card>

        <Card title="备份">
          <p className="mb-4 text-sm leading-6 text-slate-400">
            换电脑或清理浏览器前，请先导出 JSON。导入会覆盖当前账本。
          </p>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={busy} onClick={() => void onExport()}>
              导出备份
            </PrimaryButton>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
            >
              导入备份
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onImport(file)
              }}
            />
          </div>
        </Card>

        <Card title="演示与重置">
          <p className="mb-4 text-sm leading-6 text-slate-400">
            演示数据只能在没有流水时载入。清空账本后会回到欢迎页。
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDemo()}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
            >
              载入演示数据
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
              className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/25"
            >
              清空账本
            </button>
          </div>
        </Card>
      </div>

      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <ConfirmDialog
        open={confirmReset}
        title="清空全部账本？"
        message="账户、分类和流水都会删除，且无法恢复。若需要请先导出备份。"
        confirmText="清空"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void onReset()}
      />
    </div>
  )
}
