import { cn } from '../lib/cn'
import { formatSignedYuan, formatYuan } from '../lib/money'

type Props = {
  fen: number
  signed?: boolean
  tone?: 'auto' | 'income' | 'expense' | 'neutral'
  className?: string
}

export function MoneyText({ fen, signed, tone = 'neutral', className }: Props) {
  const color =
    tone === 'income'
      ? 'text-emerald-400'
      : tone === 'expense'
        ? 'text-rose-400'
        : tone === 'auto'
          ? fen > 0
            ? 'text-emerald-400'
            : fen < 0
              ? 'text-rose-400'
              : 'text-slate-200'
          : 'text-slate-100'

  return (
    <span className={cn('tabular-nums tracking-tight', color, className)}>
      {signed ? formatSignedYuan(fen) : formatYuan(fen)}
    </span>
  )
}
