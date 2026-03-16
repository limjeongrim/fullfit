import { create } from 'zustand'
import axios from 'axios'

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await axios.post('http://localhost:8000/auth/login', { email, password })
    window.__fullfit_access_token = data.access_token
    localStorage.setItem('fullfit_refresh_token', data.refresh_token)
    set({ user: { email, role: data.role }, isAuthenticated: true })
    // Fetch full user info
    const meRes = await axios.get('http://localhost:8000/auth/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    set({ user: meRes.data })
    return meRes.data
  },

  logout: () => {
    window.__fullfit_access_token = null
    localStorage.removeItem('fullfit_refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  loadFromStorage: async () => {
    const refreshToken = localStorage.getItem('fullfit_refresh_token')
    if (!refreshToken) return
    try {
      const { data } = await axios.post('http://localhost:8000/auth/refresh', {
        refresh_token: refreshToken,
      })
      window.__fullfit_access_token = data.access_token
      localStorage.setItem('fullfit_refresh_token', data.refresh_token)
      const meRes = await axios.get('http://localhost:8000/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      set({ user: meRes.data, isAuthenticated: true })
    } catch {
      localStorage.removeItem('fullfit_refresh_token')
      window.__fullfit_access_token = null
    }
  },
}))

export default useAuthStore
