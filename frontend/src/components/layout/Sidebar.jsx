import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
    LayoutDashboard, Users, Package, ShoppingCart,
    TrendingUp, BarChart3, LogOut, Wallet, Settings as SettingsIcon, QrCode, ChefHat, Utensils
} from 'lucide-react'
import { useSettings } from '../../contexts/SettingsContext'

const PAGE_CONFIG = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'Main' },
    { key: 'menu-management', icon: Utensils, label: 'Menu Management', section: 'Operations' },
    { key: 'orders', icon: ShoppingCart, label: 'POS', section: 'Operations' },
    { key: 'qrcode', icon: QrCode, label: 'QR Digital Menu', section: 'Operations' },
    { key: 'kitchen', icon: ChefHat, label: 'Kitchen Queue', section: 'Operations' },
    { key: 'inventory', icon: Package, label: 'Inventory', section: 'Operations' },
    { key: 'sales', icon: TrendingUp, label: 'Sales Records', section: 'Finance' },
    { key: 'expenses', icon: Wallet, label: 'Expenses', section: 'Finance' },
    { key: 'reports', icon: BarChart3, label: 'Reports', section: 'Finance' },
    { key: 'users', icon: Users, label: 'Staff Management', section: 'System' },
    { key: 'settings', icon: SettingsIcon, label: 'Settings', section: 'System' },
]

export default function Sidebar({ open, onClose, badges = {} }) {
    const { user, logout, accessiblePages } = useAuth()
    const { settings } = useSettings()
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
                    <div className="brand-text">
                        <h2>{settings.store_name?.split(' ')[0] || 'Comoda'}</h2>
                        <span>{settings.store_name?.split(' ').slice(1).join(' ') || 'Management System'}</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {Object.entries(sections).map(([section, items]) => (
                        <div className="nav-section" key={section}>
                            <div className="nav-section-title">{section}</div>
                            {items.map(({ key, icon: Icon, label }) => {
                                let displayLabel = label;
                                if (key === 'kitchen' && user?.role === 'Waiter') {
                                    displayLabel = 'Waiter Dashboard';
                                }
                                if (key === 'inventory' && user?.role === 'Kitchen Staff') {
                                    displayLabel = 'Ingredient Usage';
                                }
                                return (
                                    <NavLink
                                        key={key}
                                        to={`/${key}`}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                        onClick={onClose}
                                    >
                                        <Icon size={18} />
                                        <span>{displayLabel}</span>
                                        {badges[key] > 0 && (
                                            <span className={`nav-badge ${key === 'kitchen' ? 'accent' : key === 'orders' ? 'info' : ''}`}>
                                                {badges[key]}
                                            </span>
                                        )}
                                    </NavLink>
                                )
                            })}
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
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
