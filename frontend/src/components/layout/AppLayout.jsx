import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../../contexts/AuthContext'
import InstallPurchaserApp from '../pwa/InstallPurchaserApp'

export default function AppLayout({ badges }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { user } = useAuth()

    return (
        <div className={`app-shell ${user?.role === 'Purchaser' ? 'purchaser-app-shell' : ''}`}>
            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                badges={badges}
            />
            <div className="main-area">
                <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
                <main className="page-content">
                    <InstallPurchaserApp />
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
