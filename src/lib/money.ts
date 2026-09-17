const formatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compact = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
})

export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}

export function fenToYuan(fen: number): number {
  return fen / 100
}

export function parseYuanInput(input: string): number {
  const normalized = input.replace(/,/g, '').replace(/¥/g, '').trim()
  if (!normalized) return 0
  const value = Number(normalized)
  if (!Number.isFinite(value)) return 0
  return yuanToFen(value)
}

export function formatFen(fen: number): string {
  return formatter.format(fenToYuan(fen))
}

export function formatYuan(fen: number): string {
  return `¥${formatFen(fen)}`
}

export function formatSignedYuan(fen: number): string {
  if (fen > 0) return `+¥${formatFen(fen)}`
  if (fen < 0) return `-¥${formatFen(-fen)}`
  return `¥${formatFen(0)}`
}

export function formatCompactYuan(fen: number): string {
  return `¥${compact.format(Math.round(fenToYuan(fen)))}`
}

export function yuanInputFromFen(fen: number): string {
  if (!fen) return ''
  return (fen / 100).toFixed(2).replace(/\.00$/, '')
}
