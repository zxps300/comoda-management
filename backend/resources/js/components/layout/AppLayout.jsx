import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout({ badges }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="app-shell">
            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                badges={badges}
            />
            <div className="main-area">
                <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
