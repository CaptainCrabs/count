import { ensureToken, lanAddresses, readLedger, writeLedger } from './ledger-store.mjs'

function isLoopback(req) {
  const ip = req.socket?.remoteAddress ?? ''
  const forwarded = req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip']
  if (forwarded) return false
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1'
  )
}

function parseCookies(req) {
  const header = req.headers.cookie
  if (!header || typeof header !== 'string') return {}
  const out = {}
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key) out[key] = decodeURIComponent(rest.join('='))
  }
  return out
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(json)
}

async function authorized(req) {
  if (isLoopback(req)) return true
  const token = await ensureToken()
  const cookies = parseCookies(req)
  const header = req.headers['x-ledger-token']
  const query = new URL(req.url || '/', 'http://localhost').searchParams.get('token')
  return cookies.ledger_access === token || header === token || query === token
}

export async function handleLedgerRequest(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  if (!url.pathname.startsWith('/api/')) return false

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, X-Ledger-Token',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    })
    res.end()
    return true
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    const ledger = await readLedger()
    const local = isLoopback(req)
    const hostHeader = String(req.headers.host || '')
    const port = hostHeader.includes(':')
      ? hostHeader.split(':').pop()
      : String(process.env.LEDGER_PORT || 8787)
    send(res, 200, {
      ok: true,
      local,
      authRequired: !local,
      unlocked: await authorized(req),
      hasData: (ledger.accounts?.length ?? 0) > 0,
      updatedAt: ledger.updatedAt ?? 0,
      token: local ? await ensureToken() : undefined,
      lanUrls: local
        ? lanAddresses().map((ip) => `http://${ip}:${port}`)
        : [],
    })
    return true
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    const token = await ensureToken()
    let body = {}
    try {
      body = JSON.parse((await readBody(req)) || '{}')
    } catch {
      send(res, 400, { error: '无效请求' })
      return true
    }
    if (String(body.token || '').trim() !== token) {
      send(res, 401, { error: '访问码不正确' })
      return true
    }
    send(res, 200, { ok: true }, {
      'Set-Cookie': `ledger_access=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax`,
    })
    return true
  }

  if (!(await authorized(req))) {
    send(res, 401, { error: '需要访问码' })
    return true
  }

  if (url.pathname === '/api/ledger' && req.method === 'GET') {
    send(res, 200, await readLedger())
    return true
  }

  if (url.pathname === '/api/ledger' && req.method === 'PUT') {
    let body
    try {
      body = JSON.parse((await readBody(req)) || '{}')
    } catch {
      send(res, 400, { error: '账本数据无效' })
      return true
    }
    if (body.version !== 1) {
      send(res, 400, { error: '不支持的账本版本' })
      return true
    }
    send(res, 200, await writeLedger(body))
    return true
  }

  send(res, 404, { error: '接口不存在' })
  return true
}
