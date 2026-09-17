import { db } from '../db'
import type { BackupFile } from '../types'
import { exportBackup, importBackup } from './backup'

const POLL_MS = 4000

let serverAvailable = false
let hydrating = false
let pushTimer: number | undefined
let pollTimer: number | undefined
let lastUpdatedAt = 0
let listeners: Array<() => void> = []

export type SyncStatus = {
  serverAvailable: boolean
  authRequired: boolean
  unlocked: boolean
  local: boolean
  token?: string
  lanUrls: string[]
  error?: string
}

let status: SyncStatus = {
  serverAvailable: false,
  authRequired: false,
  unlocked: true,
  local: true,
  lanUrls: [],
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSync(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

function emit() {
  for (const listener of listeners) listener()
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

export async function loginWithToken(token: string): Promise<void> {
  const response = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ token: token.trim() }),
  })
  const body = (await response.json()) as { error?: string }
  if (!response.ok) throw new Error(body.error || '访问码不正确')
  status = { ...status, unlocked: true, error: undefined }
  emit()
  await hydrateFromServer()
  startPolling()
}

export function schedulePush(): void {
  if (hydrating || !serverAvailable || !status.unlocked) return
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void pushNow()
  }, 500)
}

async function pushNow(): Promise<void> {
  if (hydrating || !serverAvailable || !status.unlocked) return
  const backup = await exportBackup()
  const response = await api('/api/ledger', {
    method: 'PUT',
    body: JSON.stringify(backup),
  })
  if (response.status === 401) {
    status = { ...status, unlocked: false }
    emit()
    return
  }
  if (!response.ok) return
  const saved = (await response.json()) as BackupFile
  lastUpdatedAt = saved.updatedAt ?? Date.now()
}

async function hydrateFromServer(): Promise<void> {
  const response = await api('/api/ledger')
  if (response.status === 401) {
    status = { ...status, unlocked: false }
    emit()
    return
  }
  if (!response.ok) return
  const remote = (await response.json()) as BackupFile
  const remoteStamp = remote.updatedAt ?? 0
  const remoteCount = remote.accounts?.length ?? 0
  const localCount = await db.accounts.count()

  if (remoteCount === 0 && localCount > 0) {
    await pushNow()
    return
  }

  if (remoteCount > 0 && remoteStamp !== lastUpdatedAt) {
    hydrating = true
    try {
      await importBackup(remote)
      lastUpdatedAt = remoteStamp
    } finally {
      hydrating = false
    }
  }
}

function startPolling(): void {
  window.clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    void hydrateFromServer()
  }, POLL_MS)
}

export async function initSync(): Promise<void> {
  try {
    const response = await api('/api/status')
    if (!response.ok) {
      serverAvailable = false
      return
    }
    const info = (await response.json()) as {
      authRequired: boolean
      unlocked: boolean
      local: boolean
      token?: string
      lanUrls?: string[]
    }
    serverAvailable = true
    status = {
      serverAvailable: true,
      authRequired: info.authRequired,
      unlocked: info.unlocked,
      local: info.local,
      token: info.token,
      lanUrls: info.lanUrls ?? [],
    }
    emit()
    if (!info.unlocked) return
    await hydrateFromServer()
    startPolling()
  } catch {
    serverAvailable = false
  }
}

export function attachSyncHooks(): void {
  const onChange = () => schedulePush()
  db.accounts.hook('creating', onChange)
  db.accounts.hook('updating', onChange)
  db.accounts.hook('deleting', onChange)
  db.transactions.hook('creating', onChange)
  db.transactions.hook('updating', onChange)
  db.transactions.hook('deleting', onChange)
  db.postings.hook('creating', onChange)
  db.postings.hook('updating', onChange)
  db.postings.hook('deleting', onChange)
  db.meta.hook('creating', onChange)
  db.meta.hook('updating', onChange)
  db.meta.hook('deleting', onChange)
  db.billImports.hook('creating', onChange)
  db.billImports.hook('updating', onChange)
  db.billImports.hook('deleting', onChange)
}
