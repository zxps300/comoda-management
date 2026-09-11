import axios from 'axios'

const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
    }
    const host = window.location.hostname || '127.0.0.1'
    const protocol = window.location.protocol || 'http:'
    return `${protocol}//${host}:8000/api`
}

const api = axios.create({
    baseURL: getBaseUrl(),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

// Attach Bearer token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('comoda_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Auto-logout on 401 for authenticated endpoints (excluding login / register)
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const isAuthEndpoint = err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/auth/register')
        if (err.response?.status === 401 && !isAuthEndpoint) {
            localStorage.removeItem('comoda_token')
            localStorage.removeItem('comoda_user')
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        }
        return Promise.reject(err)
    }
)

export default api
