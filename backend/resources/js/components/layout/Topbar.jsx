import { useState, useEffect } from 'react'
import { Menu, LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const PAGE_TITLES = {
    '/dashboard': { title: 'Dashboard', sub: 'Overview of your restaurant operations' },
    '/purchaser_dashboard': { title: 'Purchaser Dashboard', sub: 'Track and restock inventory' },
    '/users': { title: 'User Management', sub: 'Manage staff accounts and access' },
    '/inventory': { title: 'Inventory Management', sub: 'Track ingredients and supplies' },
    '/orders': { title: 'Point of Sale', sub: 'Comoda Restaurant System' },
    '/kitchen': { title: 'Kitchen Display System', sub: 'Comoda Restaurant System' },
    '/billing': { title: 'Billing & Receipts', sub: 'Process payments and generate receipts' },
    '/sales': { title: 'Sales Records', sub: 'View completed transactions' },
    '/reports': { title: 'Reports', sub: 'Sales and inventory analytics' },
}

export default function Topbar({ onMenuClick }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { logout } = useAuth()
    const [time, setTime] = useState(new Date())
    const info = PAGE_TITLES[location.pathname] || { title: 'Comoda', sub: '' }

    const handleSwitchStaff = async () => {
        await logout()
        navigate('/login')
    }

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
                <button className="btn-switch-staff" onClick={handleSwitchStaff}>
                    <LogOut size={16} />
                    <span>Switch Staff</span>
                </button>
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
