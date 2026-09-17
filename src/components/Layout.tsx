import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/useAppStore'
import {
  IconChart,
  IconGear,
  IconHome,
  IconList,
  IconMenu,
  IconPiggy,
  IconPlus,
  IconScale,
  IconUpload,
  IconWallet,
} from './icons'
import { QuickEntry } from './QuickEntry'

const NAV = [
  { to: '/', label: '总览', icon: IconHome, end: true },
  { to: '/ledger', label: '流水', icon: IconList },
  { to: '/import', label: '导入账单', icon: IconUpload },
  { to: '/balance-sheet', label: '资产负债', icon: IconScale },
  { to: '/income', label: '月度收支', icon: IconChart },
  { to: '/savings', label: '存钱分析', icon: IconPiggy },
  { to: '/accounts', label: '账户', icon: IconWallet },
  { to: '/settings', label: '设置', icon: IconGear },
]

const MOBILE_NAV = new Set(['/', '/ledger', '/savings', '/income', '/accounts'])

export function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const openQuick = useAppStore((state) => state.openQuick)
  const quickOpen = useAppStore((state) => state.quickOpen)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (typing) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        openQuick()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openQuick])

  return (
    <div className="min-h-svh bg-[#070b14] text-slate-100">
      <div className="flex min-h-svh">
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-white/8 bg-[#0c1424] px-4 py-6 lg:flex">
          <Brand />
          <NavList />
          <p className="mt-auto px-3 text-[11px] leading-5 text-slate-500">
            数据保存在这台电脑。按 N 可快速记账。
          </p>
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="关闭菜单"
              onClick={() => setMenuOpen(false)}
            />
            <aside className="relative z-10 flex h-full w-64 flex-col bg-[#0c1424] px-4 py-6">
              <Brand />
              <NavList />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-[#070b14]/90 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-xl p-2 text-slate-300 hover:bg-white/5"
              aria-label="打开菜单"
            >
              <IconMenu />
            </button>
            <div className="text-sm font-semibold">记账看板</div>
            <button
              type="button"
              onClick={() => openQuick()}
              className="rounded-xl p-2 text-emerald-300 hover:bg-white/5"
              aria-label="记一笔"
            >
              <IconPlus />
            </button>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-10">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/8 bg-[#0c1424]/95 px-1 py-1 backdrop-blur lg:hidden">
        {NAV.filter((item) => MOBILE_NAV.has(item.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px]',
                isActive ? 'text-emerald-300' : 'text-slate-400',
              )
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => openQuick()}
        className={cn(
          'fixed right-6 z-30 hidden size-14 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-300 lg:flex',
          quickOpen ? 'bottom-8 opacity-0' : 'bottom-8',
        )}
        aria-label="记一笔"
      >
        <IconPlus className="size-7" />
      </button>

      <QuickEntry />
    </div>
  )
}

function Brand() {
  return (
    <div className="mb-8 flex items-center gap-3 px-2">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-lg font-bold text-emerald-300">
        账
      </div>
      <div>
        <div className="text-sm font-semibold text-white">记账看板</div>
        <div className="text-xs text-slate-500">本地资产负债表</div>
      </div>
    </div>
  )
}

function NavList() {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition',
              isActive
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <item.icon />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  )
}
