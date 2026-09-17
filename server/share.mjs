import { spawn } from 'node:child_process'
import { startServer } from './index.mjs'
import { lanAddresses } from './ledger-store.mjs'

function parseTunnelUrl(text) {
  const match = text.match(/https:\/\/[a-z0-9-]+\.(trycloudflare\.com|loca\.lt|ngrok-free\.app|ngrok\.io)/i)
  return match?.[0]
}

function runTunnel(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let settled = false
    const onData = (buf) => {
      const text = buf.toString()
      process.stdout.write(text)
      const url = parseTunnelUrl(text)
      if (url && !settled) {
        settled = true
        resolve({ url, child })
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      if (!settled) reject(new Error(`${command} 退出，代码 ${code}`))
    })
    setTimeout(() => {
      if (!settled) {
        child.kill()
        reject(new Error('等待公网地址超时'))
      }
    }, 45000)
  })
}

const { port, token } = await startServer()
const lan = lanAddresses()

console.log('')
console.log('本机服务已启动，正在开通公网隧道…')
console.log(`访问码: ${token}`)
console.log('')

let tunnel
try {
  tunnel = await runTunnel('npx', [
    '--yes',
    'cloudflared',
    'tunnel',
    '--url',
    `http://127.0.0.1:${port}`,
  ])
} catch {
  console.log('Cloudflare 隧道不可用，改用 localtunnel…')
  tunnel = await runTunnel('npx', [
    '--yes',
    'localtunnel',
    '--port',
    String(port),
  ])
}

console.log('')
console.log('现在可以用手机打开：')
console.log(`  ${tunnel.url}`)
console.log(`  访问码: ${token}`)
console.log('')
for (const ip of lan) {
  console.log(`同一 WiFi 也可: http://${ip}:${port}/`)
}
console.log('')
console.log('电脑不要休眠，也不要关闭这个窗口。')
