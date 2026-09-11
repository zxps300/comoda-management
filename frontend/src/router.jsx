import {
    createBrowserRouter,
    RouterProvider,
    Navigate,
} from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth, ROLE_ACCESS } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'

const Welcome = lazy(() => import('./pages/Welcome'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Users = lazy(() => import('./pages/Users'))
const Inventory = lazy(() => import('./pages/Inventory'))
const POS = lazy(() => import('./pages/POS'))
const Kitchen = lazy(() => import('./pages/Kitchen'))
const Sales = lazy(() => import('./pages/Sales'))
const Reports = lazy(() => import('./pages/Reports'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Settings = lazy(() => import('./pages/Settings'))
const QRCodePage = lazy(() => import('./pages/QRCode'))
const MenuManagement = lazy(() => import('./pages/MenuManagement'))

function AppRouter({ badges }) {
    const { user } = useAuth()
    const defaultPath = user ? `/${ROLE_ACCESS[user.role]?.[0] || 'login'}` : '/login'

    const router = createBrowserRouter([
        {
            path: '/welcome',
            element: user ? <Navigate to={defaultPath} replace /> : <Welcome />,
        },
        {
            path: '/login',
            element: user ? <Navigate to={defaultPath} replace /> : <Login />,
        },
        {
            element: <ProtectedRoute />,
            children: [
                {
                    element: <AppLayout badges={badges} />,
                    children: [
                        { path: '/', element: <Navigate to={defaultPath} replace /> },
                        { path: '/dashboard', element: <ProtectedRoute page="dashboard" />, children: [{ index: true, element: <Dashboard /> }] },
                        { path: '/users', element: <ProtectedRoute page="users" />, children: [{ index: true, element: <Users /> }] },
                        { path: '/inventory', element: <ProtectedRoute page="inventory" />, children: [{ index: true, element: <Inventory /> }] },
                        { path: '/menu-management', element: <ProtectedRoute page="menu-management" />, children: [{ index: true, element: <MenuManagement /> }] },
                        { path: '/orders', element: <ProtectedRoute page="orders" />, children: [{ index: true, element: <POS /> }] },
                        { path: '/kitchen', element: <ProtectedRoute page="kitchen" />, children: [{ index: true, element: <Kitchen /> }] },
                        { path: '/sales', element: <ProtectedRoute page="sales" />, children: [{ index: true, element: <Sales /> }] },
                        { path: '/expenses', element: <ProtectedRoute page="expenses" />, children: [{ index: true, element: <Expenses /> }] },
                        { path: '/reports', element: <ProtectedRoute page="reports" />, children: [{ index: true, element: <Reports /> }] },
                        { path: '/settings', element: <ProtectedRoute page="settings" />, children: [{ index: true, element: <Settings /> }] },
                        { path: '/qrcode', element: <ProtectedRoute page="qrcode" />, children: [{ index: true, element: <QRCodePage /> }] },
                    ],
                },
            ],
        },
        { path: '*', element: <Navigate to={defaultPath} replace /> },
    ])

    return (
        <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
            <RouterProvider router={router} />
        </Suspense>
    )
}

export default AppRouter
