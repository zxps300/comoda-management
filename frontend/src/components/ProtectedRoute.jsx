import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, ROLE_ACCESS } from '../contexts/AuthContext'

export default function ProtectedRoute({ page }) {
    const { user, canAccess } = useAuth()
    if (!user) return <Navigate to="/login" replace />
    if (page && !canAccess(page)) {
        const defaultPage = `/${ROLE_ACCESS[user.role]?.[0] || 'login'}`
        return <Navigate to={defaultPage} replace />
    }
    return <Outlet />
}

