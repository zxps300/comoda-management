import {
    createBrowserRouter,
    RouterProvider,
    Navigate,
} from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Welcome from './pages/Welcome'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Inventory from './pages/Inventory'
import POS from './pages/POS'
import Kitchen from './pages/Kitchen'
import Billing from './pages/Billing'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import PurchaserDashboard from './pages/PurchaserDashboard'

function AppRouter({ badges }) {
    const { user } = useAuth()

    const router = createBrowserRouter([
        {
            path: '/welcome',
            element: user ? <Navigate to="/dashboard" replace /> : <Welcome />,
        },
        {
            path: '/login',
            element: user ? <Navigate to="/dashboard" replace /> : <Login />,
        },
        {
            element: <ProtectedRoute />,
            children: [
                {
                    element: <AppLayout badges={badges} />,
                    children: [
                        { path: '/', element: <Navigate to={user ? (user.role === 'Purchaser' ? '/purchaser_dashboard' : '/dashboard') : '/login'} replace /> },
                        { path: '/dashboard', element: <Dashboard /> },
                        { path: '/purchaser_dashboard', element: <ProtectedRoute page="purchaser_dashboard" />, children: [{ index: true, element: <PurchaserDashboard /> }] },
                        { path: '/users', element: <ProtectedRoute page="users" />, children: [{ index: true, element: <Users /> }] },
                        { path: '/inventory', element: <ProtectedRoute page="inventory" />, children: [{ index: true, element: <Inventory /> }] },
                        { path: '/orders', element: <ProtectedRoute page="orders" />, children: [{ index: true, element: <POS /> }] },
                        { path: '/kitchen', element: <ProtectedRoute page="kitchen" />, children: [{ index: true, element: <Kitchen /> }] },
                        { path: '/billing', element: <ProtectedRoute page="billing" />, children: [{ index: true, element: <Billing /> }] },
                        { path: '/sales', element: <ProtectedRoute page="sales" />, children: [{ index: true, element: <Sales /> }] },
                        { path: '/reports', element: <ProtectedRoute page="reports" />, children: [{ index: true, element: <Reports /> }] },
                    ],
                },
            ],
        },
        { path: '*', element: <Navigate to={user ? '/dashboard' : '/login'} replace /> },
    ])

    return <RouterProvider router={router} />
}

export default AppRouter
