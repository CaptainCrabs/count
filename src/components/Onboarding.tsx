import { useState } from 'react'
import { seedChartOfAccounts, seedDemoData } from '../db/seed'
import { PrimaryButton } from './ui'

export function Onboarding() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start(demo: boolean) {
    setBusy(true)
    setError('')
    try {
      if (demo) await seedDemoData()
      else await seedChartOfAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#070b14] px-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/8 bg-[#10192c] p-8 shadow-2xl">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-2xl font-bold text-emerald-300">
          账
        </div>
        <h1 className="text-3xl font-semibold text-white">开始你的资产负债表</h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          数据只保存在这台电脑的浏览器里，不会上传。你可以随时在设置里导出 JSON
          备份。底层按复式记账处理，记一笔支出或收入时会自动保持账本平衡。
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <PrimaryButton disabled={busy} onClick={() => void start(true)}>
            载入演示数据
          </PrimaryButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start(false)}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            从空白账本开始
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          空白账本会预置现金、银行卡、支付宝、信用卡以及常用收支分类。演示数据包含近四个月流水，方便先看看板效果。
        </p>
      </div>
    </div>
  )
}
