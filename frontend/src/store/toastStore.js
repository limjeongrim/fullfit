import { create } from 'zustand'

let nextId = 1

const useToastStore = create((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    return id
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export default useToastStore
