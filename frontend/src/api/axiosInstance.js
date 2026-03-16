import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = window.__fullfit_access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: attempt token refresh, retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('fullfit_refresh_token')
      if (!refreshToken) {
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post('http://localhost:8000/auth/refresh', {
          refresh_token: refreshToken,
        })
        window.__fullfit_access_token = data.access_token
        localStorage.setItem('fullfit_refresh_token', data.refresh_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch {
        localStorage.removeItem('fullfit_refresh_token')
        window.__fullfit_access_token = null
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
