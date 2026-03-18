import { useEffect } from 'react'
import useToastStore from '../store/toastStore'

const TYPE_STYLES = {
  success: 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]',
  error:   'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]',
  warning: 'bg-[#FEF9C3] text-[#854D0E] border border-[#FEF08A]',
  info:    'bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]',
}

const TYPE_ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

function ToastItem({ toast }) {
  const removeToast = useToastStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id])

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-md text-sm font-medium
        min-w-[240px] max-w-sm animate-slide-in
        ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
    >
      <span className="text-base leading-none shrink-0">{TYPE_ICONS[toast.type] || TYPE_ICONS.info}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-2 opacity-50 hover:opacity-100 transition-opacity text-base leading-none"
      >
        ×
      </button>
    </div>
  )
}

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
