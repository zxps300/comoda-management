import { createContext, useContext, useState, useCallback } from 'react'
import { authService } from '../services/auth.service'

const AuthContext = createContext(null)

const ROLE_ACCESS = {
    Admin: ['dashboard', 'users', 'inventory', 'orders', 'kitchen', 'billing', 'sales', 'reports'],
    Cashier: ['orders', 'billing', 'sales'],
    Purchaser: ['purchaser_dashboard', 'inventory'],
    'Kitchen Staff': ['kitchen', 'inventory'],
    Waiter: ['orders', 'kitchen', 'inventory'],
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('comoda_user')
        return saved ? JSON.parse(saved) : null
    })
    const [token, setToken] = useState(() => localStorage.getItem('comoda_token') || null)

    const login = useCallback(async (username, password) => {
        const data = await authService.login(username, password)
        if (data.success) {
            localStorage.setItem('comoda_token', data.token)
            localStorage.setItem('comoda_user', JSON.stringify(data.user))
            setToken(data.token)
            setUser(data.user)
        }
        return data
    }, [])

    const logout = useCallback(async () => {
        try { await authService.logout() } catch (_) { }
        localStorage.removeItem('comoda_token')
        localStorage.removeItem('comoda_user')
        setToken(null)
        setUser(null)
    }, [])

    const canAccess = useCallback((page) => {
        if (!user) return false
        return (ROLE_ACCESS[user.role] || []).includes(page)
    }, [user])

    const accessiblePages = user ? (ROLE_ACCESS[user.role] || []) : []

    return (
        <AuthContext.Provider value={{ user, token, login, logout, canAccess, accessiblePages }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
