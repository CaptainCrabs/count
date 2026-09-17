import { formatMonthLabel, shiftMonth } from '../lib/dates'
import { useAppStore } from '../store/useAppStore'

export function MonthPicker() {
  const currentMonth = useAppStore((state) => state.currentMonth)
  const setMonth = useAppStore((state) => state.setMonth)

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 p-1">
      <button
        type="button"
        className="rounded-xl px-3 py-1.5 text-slate-300 hover:bg-white/5"
        onClick={() => setMonth(shiftMonth(currentMonth, -1))}
      >
        ‹
      </button>
      <div className="min-w-28 text-center text-sm font-medium text-white">
        {formatMonthLabel(currentMonth)}
      </div>
      <button
        type="button"
        className="rounded-xl px-3 py-1.5 text-slate-300 hover:bg-white/5"
        onClick={() => setMonth(shiftMonth(currentMonth, 1))}
      >
        ›
      </button>
    </div>
  )
}
