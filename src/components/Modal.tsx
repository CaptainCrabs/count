import { useEffect, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { IconClose } from './icons'

type ModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 max-h-[92svh] w-full overflow-auto rounded-t-3xl border border-white/10 bg-[#10192c] p-5 shadow-2xl sm:rounded-3xl sm:p-6',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

type ConfirmProps = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  danger,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-6 text-sm leading-6 text-slate-300">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium text-white',
            danger ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400',
          )}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
