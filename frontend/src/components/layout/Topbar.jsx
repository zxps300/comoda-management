import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import GlobalNotificationCenter from '../notifications/GlobalNotificationCenter'

const PAGE_TITLES = {
    '/dashboard': { title: 'Dashboard', sub: 'Overview of your restaurant operations' },
    '/purchaser_dashboard': { title: 'Purchaser Dashboard', sub: 'Track and restock inventory' },
    '/users': { title: 'Staff Management', sub: 'Employees, schedules and attendance' },
    '/inventory': { title: 'Inventory Management', sub: 'Track ingredients and supplies' },
    '/orders': { title: 'Point of Sale', sub: 'Comoda Restaurant System' },
    '/kitchen': { title: 'Kitchen Display System', sub: 'Comoda Restaurant System' },
    '/billing': { title: 'Billing & Receipts', sub: 'Process payments and generate receipts' },
    '/sales': { title: 'Sales Records', sub: 'View completed transactions' },
    '/reports': { title: 'Reports', sub: 'Sales and inventory analytics' },
}

export default function Topbar({ onMenuClick }) {
    const location = useLocation()
    const { user } = useAuth()
    const [time, setTime] = useState(new Date())
    const info = user?.role === 'Purchaser' && location.pathname === '/inventory'
        ? { title: 'Purchaser Workspace', sub: 'Stock, requests and purchase reports' }
        : user?.role === 'Kitchen Staff' && location.pathname === '/inventory'
            ? { title: 'Ingredient Usage', sub: 'Record ingredients consumed by the kitchen' }
            : PAGE_TITLES[location.pathname] || { title: 'Comoda', sub: '' }

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    return (
        <header className="topbar">
            <button className="hamburger" onClick={onMenuClick}>
                <Menu size={22} />
            </button>
            <div className="topbar-left">
                <h1>{info.title}</h1>
                <p>{info.sub}</p>
            </div>
            <div className="topbar-right">
                <GlobalNotificationCenter />
                <div className="topbar-datetime">
                    <div className="date">
                        {time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="time">
                        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>
            </div>
        </header>
    )
}
