import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
    LayoutDashboard, Users, Package, ShoppingCart,
    ChefHat, Receipt, TrendingUp, BarChart3, LogOut,
} from 'lucide-react'

const PAGE_CONFIG = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'Main' },
    { key: 'purchaser_dashboard', icon: ShoppingCart, label: 'Purchaser Dashboard', section: 'Main' },
    { key: 'users', icon: Users, label: 'User Management', section: 'Main' },
    { key: 'inventory', icon: Package, label: 'Inventory', section: 'Operations' },
    { key: 'orders', icon: ShoppingCart, label: 'POS', section: 'Operations' },
    { key: 'kitchen', icon: ChefHat, label: 'Kitchen', section: 'Operations' },
    { key: 'billing', icon: Receipt, label: 'Billing', section: 'Operations' },
    { key: 'sales', icon: TrendingUp, label: 'Sales Records', section: 'Finance' },
    { key: 'reports', icon: BarChart3, label: 'Reports', section: 'Finance' },
]

export default function Sidebar({ open, onClose, badges = {} }) {
    const { user, logout, accessiblePages } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const initials = user?.fullName
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '?'

    const sections = {}
    PAGE_CONFIG
        .filter((p) => accessiblePages.includes(p.key))
        .forEach((p) => {
            if (!sections[p.section]) sections[p.section] = []
            sections[p.section].push(p)
        })

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`sidebar-overlay ${open ? 'show' : ''}`}
                onClick={onClose}
            />

            <aside className={`sidebar ${open ? 'open' : ''}`}>
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="brand-icon">🍽️</div>
                    <div className="brand-text">
                        <h2>Comoda</h2>
                        <span>Management System</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {Object.entries(sections).map(([section, items]) => (
                        <div className="nav-section" key={section}>
                            <div className="nav-section-title">{section}</div>
                            {items.map(({ key, icon: Icon, label }) => (
                                <NavLink
                                    key={key}
                                    to={`/${key}`}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    onClick={onClose}
                                >
                                    <Icon size={18} />
                                    <span>{label}</span>
                                    {badges[key] > 0 && (
                                        <span className={`nav-badge ${key === 'kitchen' ? 'accent' : key === 'orders' ? 'info' : ''}`}>
                                            {badges[key]}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Footer / User Panel */}
                <div className="sidebar-footer">
                    <div className="user-panel">
                        <div className="user-avatar">{initials}</div>
                        <div className="user-info">
                            <div className="user-name">{user?.fullName}</div>
                            <div className="user-role">{user?.role}</div>
                        </div>
                        <button className="btn-logout" onClick={handleLogout} title="Sign Out">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
