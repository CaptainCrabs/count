import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { monthKey } from '../lib/dates'
import type { NewEntry, TxType } from '../types'

type Prefs = {
  lastExpenseAccountId?: number
  lastExpenseCategoryId?: number
  lastIncomeAccountId?: number
  lastIncomeCategoryId?: number
  lastTransferFromId?: number
  lastTransferToId?: number
  lastRepayFromId?: number
  lastRepayToId?: number
}

type AppState = {
  currentMonth: string
  quickOpen: boolean
  draft: Partial<NewEntry> | null
  prefs: Prefs
  setMonth: (month: string) => void
  openQuick: (draft?: Partial<NewEntry>) => void
  closeQuick: () => void
  remember: (type: TxType, draft: Partial<NewEntry>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentMonth: monthKey(),
      quickOpen: false,
      draft: null,
      prefs: {},
      setMonth: (currentMonth) => set({ currentMonth }),
      openQuick: (draft) => set({ quickOpen: true, draft: draft ?? null }),
      closeQuick: () => set({ quickOpen: false, draft: null }),
      remember: (type, draft) =>
        set((state) => {
          const prefs = { ...state.prefs }
          if (type === 'expense') {
            prefs.lastExpenseAccountId = draft.accountId
            prefs.lastExpenseCategoryId = draft.categoryId
          }
          if (type === 'income') {
            prefs.lastIncomeAccountId = draft.accountId
            prefs.lastIncomeCategoryId = draft.categoryId
          }
          if (type === 'transfer') {
            prefs.lastTransferFromId = draft.fromAccountId
            prefs.lastTransferToId = draft.toAccountId
          }
          if (type === 'repayment') {
            prefs.lastRepayFromId = draft.fromAccountId
            prefs.lastRepayToId = draft.toAccountId
          }
          return { prefs }
        }),
    }),
    {
      name: 'count-ui',
      partialize: (state) => ({
        currentMonth: state.currentMonth,
        prefs: state.prefs,
      }),
    },
  ),
)
