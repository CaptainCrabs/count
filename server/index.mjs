import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { handleLedgerRequest } from './http-api.mjs'
import { DIST_DIR, ensureToken, lanAddresses } from './ledger-store.mjs'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function safeFile(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0])
  const relative = decoded.replace(/^\/+/, '')
  const file = path.normalize(path.join(DIST_DIR, relative))
  if (!file.startsWith(DIST_DIR)) return null
  return file
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
  })
  createReadStream(file).pipe(res)
}

async function ensureBuild() {
  const index = path.join(DIST_DIR, 'index.html')
  if (existsSync(index)) return
  console.log('首次启动，正在构建网页…')
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build'], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
      stdio: 'inherit',
      shell: true,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`构建失败，退出码 ${code}`))
    })
  })
}

export async function startServer() {
  await ensureBuild()
  const token = await ensureToken()
  const port = Number(process.env.LEDGER_PORT || 8787)

  const server = createServer(async (req, res) => {
    try {
      if (await handleLedgerRequest(req, res)) return
      const url = new URL(req.url || '/', 'http://localhost')
      let file = safeFile(url.pathname)
      if (file && existsSync(file) && statSync(file).isFile()) {
        sendFile(res, file)
        return
      }
      sendFile(res, path.join(DIST_DIR, 'index.html'))
    } catch (err) {
      console.error(err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      }
      res.end('服务器错误')
    }
  })

  await new Promise((resolve) => {
    server.listen(port, '0.0.0.0', resolve)
  })

  return { server, port, token }
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const { port, token } = await startServer()
  const lan = lanAddresses()
  console.log('')
  console.log('记账看板已启动')
  console.log(`  本机:     http://localhost:${port}/`)
  for (const ip of lan) {
    console.log(`  同一WiFi: http://${ip}:${port}/`)
  }
  console.log(`  访问码:   ${token}`)
  console.log('')
  console.log('电脑浏览器可直接打开本机地址。手机或公网访问时输入访问码。')
  console.log('不要关闭这个窗口。公网访问请再运行 公网分享.bat')
  console.log('')
}
