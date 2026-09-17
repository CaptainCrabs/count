import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function monthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM')
}

export function parseMonth(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(year, (monthNum ?? 1) - 1, 1)
}

export function monthStart(month: string): string {
  return toISODate(startOfMonth(parseMonth(month)))
}

export function monthEnd(month: string): string {
  return toISODate(endOfMonth(parseMonth(month)))
}

export function shiftMonth(month: string, delta: number): string {
  return monthKey(addMonths(parseMonth(month), delta))
}

export function formatMonthLabel(month: string): string {
  return format(parseMonth(month), 'yyyy年M月', { locale: zhCN })
}

export function formatDateLabel(iso: string): string {
  return format(parseISODate(iso), 'M月d日 EEE', { locale: zhCN })
}

export function formatDateShort(iso: string): string {
  return format(parseISODate(iso), 'MM-dd')
}

export function defaultEntryDate(month: string): string {
  const today = toISODate(new Date())
  const start = monthStart(month)
  const end = monthEnd(month)
  if (today >= start && today <= end) return today
  if (today < start) return start
  return end
}

export function recentMonths(count: number, endMonth?: string): string[] {
  const origin = endMonth ? parseMonth(endMonth) : startOfMonth(new Date())
  return Array.from({ length: count }, (_, index) =>
    monthKey(subMonths(origin, count - 1 - index)),
  )
}

export function inMonth(date: string, month: string): boolean {
  return date >= monthStart(month) && date <= monthEnd(month)
}
