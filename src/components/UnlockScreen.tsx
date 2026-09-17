import { useState } from 'react'
import { loginWithToken } from '../services/sync'
import { PrimaryButton, TextInput } from './ui'

export function UnlockScreen() {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await loginWithToken(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#070b14] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/8 bg-[#10192c] p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-xl font-bold text-emerald-300">
          账
        </div>
        <h1 className="text-2xl font-semibold text-white">输入访问码</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          你正在通过局域网或公网打开这台电脑上的账本。访问码显示在电脑启动窗口，或电脑本机打开后的设置页。
        </p>
        <div className="mt-6 space-y-3">
          <TextInput
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="8 位访问码"
            autoComplete="off"
          />
          <PrimaryButton
            disabled={busy || !token.trim()}
            className="w-full"
            onClick={() => void submit()}
          >
            进入
          </PrimaryButton>
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
