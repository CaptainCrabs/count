import type { TooltipContentProps } from 'recharts'
import { formatYuan } from '../lib/money'

export function ChartTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const items = payload

  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1324]/95 px-3 py-2 text-xs shadow-xl">
      {label != null && label !== '' && (
        <div className="mb-1 text-slate-400">{String(label)}</div>
      )}
      {items.map((item, index) => (
        <div
          key={`${item.name ?? item.dataKey ?? index}`}
          className="flex items-center justify-between gap-6 py-0.5"
        >
          <span className="flex items-center gap-2 text-slate-300">
            <i
              className="inline-block size-2 rounded-full"
              style={{ background: item.color }}
            />
            {item.name}
          </span>
          <span className="tabular-nums text-white">
            {typeof item.value === 'number'
              ? formatYuan(item.value)
              : Array.isArray(item.value)
                ? item.value.join(', ')
                : String(item.value ?? '')}
          </span>
        </div>
      ))}
    </div>
  )
}
