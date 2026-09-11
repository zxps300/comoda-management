import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ page }) {
    const { user, canAccess } = useAuth()
    if (!user) return <Navigate to="/login" replace />
    if (page && !canAccess(page)) return <Navigate to="/dashboard" replace />
    return <Outlet />
}
