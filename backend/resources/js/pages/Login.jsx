import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, ArrowLeft } from 'lucide-react'

const ROLES = [
    { id: 'waiter', name: 'Waiter', icon: '🤵' },
    { id: 'cashier', name: 'Cashier', icon: '💵' },
    { id: 'kitchen', name: 'Kitchen', icon: '👨‍🍳' },
    { id: 'bar', name: 'Bar', icon: '🍹' },
    { id: 'pastry', name: 'Pastry', icon: '🍰' },
    { id: 'purchaser', name: 'Purchaser', icon: '🛒' },
    { id: 'admin', name: 'Admin', icon: '🔑' },
]

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [selectedRole, setSelectedRole] = useState(null)
    const [form, setForm] = useState({ username: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSelectRole = (role) => {
        setSelectedRole(role)
        // Pre-fill username for convenience if desired, or just clear
        setForm({ username: role === 'admin' ? 'admin' : role, password: '' })
        setError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.username || !form.password) {
            setError('Please enter both username and password')
            return
        }
        setLoading(true)
        setError('')
        try {
            const result = await login(form.username, form.password)
            if (result.success) {
                // If role is Cashier, redirect directly to the POS page (/orders)
                if (result.user && (result.user.role === 'Cashier' || result.user.role === 'Waiter')) {
                    navigate('/orders')
                } else if (result.user && result.user.role === 'Kitchen Staff') {
                    navigate('/kitchen')
                } else if (result.user && result.user.role === 'Purchaser') {
                    navigate('/purchaser_dashboard')
                } else {
                    navigate('/dashboard')
                }
            } else {
                setError(result.message || 'Invalid credentials')
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Connection failed. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }


    const currentRoleData = ROLES.find(r => r.id === selectedRole)

    return (
        <div className="login-page">
            <div className="login-bg" />
            <div className="login-card">
                <div className="login-logo">
                    <div className="logo-icon">🍽️</div>
                    <h1>Comoda</h1>
                    <p>Restaurant Management System</p>
                </div>

                {error && <div className="login-error show">{error}</div>}

                {!selectedRole ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
                            Select your role to continue
                        </p>
                        <div className="role-grid">
                            {ROLES.map((r) => (
                                <div key={r.id} className="role-card" onClick={() => handleSelectRole(r.id)}>
                                    <div className="role-icon">{r.icon}</div>
                                    <div className="role-name">{r.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => setSelectedRole(null)} 
                            style={{ marginBottom: 20, padding: '4px 8px', fontSize: '0.75rem', gap: 4 }}
                        >
                            <ArrowLeft size={14} /> Back to Roles
                        </button>

                        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.85rem', textAlign: 'center' }}>
                            Logging in as <strong>{currentRoleData?.name}</strong>
                        </p>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Enter your username"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    autoComplete="username"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    className="input"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, username: form.username, password: e.target.value })}
                                    autoComplete="current-password"
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg btn-block"
                                style={{ marginTop: 8 }}
                                disabled={loading}
                            >
                                <LogIn size={18} />
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>

                        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Default: <strong>{selectedRole}</strong> / <strong>{selectedRole}123</strong> {selectedRole === 'admin' ? '(or admin/admin123)' : ''}
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}

