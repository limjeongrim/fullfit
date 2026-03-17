import { useEffect } from 'react'
import useToastStore from '../store/toastStore'

const TYPE_STYLES = {
  success: 'bg-green-500 text-white',
  error:   'bg-red-500 text-white',
  warning: 'bg-yellow-400 text-gray-900',
  info:    'bg-blue-500 text-white',
}

const TYPE_ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}

function ToastItem({ toast }) {
  const removeToast = useToastStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id])

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
        min-w-[240px] max-w-sm animate-slide-in
        ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
    >
      <span>{TYPE_ICONS[toast.type] || 'ℹ️'}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity text-base leading-none"
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
