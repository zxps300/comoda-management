import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

// Attach Bearer token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('comoda_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Auto-logout on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('comoda_token')
            localStorage.removeItem('comoda_user')
            window.location.href = '/login'
        }
        return Promise.reject(err)
    }
)

export default api
