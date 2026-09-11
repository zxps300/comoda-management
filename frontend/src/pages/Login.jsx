import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ username: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

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
                if (result.user && (result.user.role === 'Cashier' || result.user.role === 'Waiter' || result.user.role === 'Bar')) {
                    navigate('/orders')
                } else if (result.user && (result.user.role === 'Kitchen Staff' || result.user.role === 'Pastry')) {
                    navigate('/kitchen')
                } else if (result.user && result.user.role === 'Purchaser') {
                    navigate('/inventory')
                } else {
                    navigate('/dashboard')
                }
            } else {
                setError(result.message || 'Invalid credentials')
            }
        } catch (err) {
            console.error('Login error:', err)
            setError(err.response?.data?.message || 'Connection failed. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <img
                className="login-bg"
                src="/bgforcomoda.png"
                alt=""
                aria-hidden="true"
                draggable="false"
            />
            <div className="login-page">
                <div className="login-shade" aria-hidden="true" />
                <div className="login-card">
                    <div className="login-form-panel">
                        <div className="login-logo">
                            <h1>Comoda</h1>
                            <p>Owner &amp; Staff Portal</p>
                        </div>

                        {error && <div className="login-error show" role="alert">{error}</div>}

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <label htmlFor="login-username">Username</label>
                                <div className="login-input-wrap">
                                    <UserRound size={17} aria-hidden="true" />
                                    <input
                                        id="login-username"
                                        className="input"
                                        type="text"
                                        placeholder="Enter your username"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        autoComplete="username"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="login-password">Password</label>
                                <div className="login-input-wrap">
                                    <LockKeyhole size={17} aria-hidden="true" />
                                <input
                                    id="login-password"
                                    className="input"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="login-password-toggle"
                                    title={showPassword ? "Hide Password" : "Show Password"}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            </div>
                            <button
                                type="submit"
                                className="login-submit"
                                disabled={loading}
                            >
                                <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                                <ArrowRight size={18} />
                            </button>
                        </form>

                    </div>
                </div>
            </div>
        </>
    )
}
