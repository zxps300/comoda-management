import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Welcome() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [isVisible, setIsVisible] = useState(false)
    const [isLeaving, setIsLeaving] = useState(false)

    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true })
            return
        }
        const timer = setTimeout(() => setIsVisible(true), 100)
        return () => clearTimeout(timer)
    }, [user, navigate])

    const handleEnter = () => {
        setIsLeaving(true)
        setTimeout(() => navigate('/login'), 700)
    }

    return (
        <div className={`welcome-page ${isVisible ? 'welcome-visible' : ''} ${isLeaving ? 'welcome-leaving' : ''}`}>
            {/* Background Image */}
            <div className="welcome-bg" style={{ backgroundImage: "url('/comoda-bg.jpg')" }} />
            
            {/* Rich Overlays */}
            <div className="welcome-overlay-bottom" />
            <div className="welcome-overlay-top" />

            {/* Floating Particles */}
            <div className="welcome-particles">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="particle" style={{ '--i': i }} />
                ))}
            </div>

            {/* Main Content */}
            <main className="welcome-content">
                <div className="welcome-badge">
                    <span className="badge-dot" />
                    <span>Est. 2024 • Tropical Dining</span>
                </div>

                <div className="welcome-logo-wrap">
                    <div className="welcome-logo-icon">🌿</div>
                    <h1 className="welcome-title">Comoda</h1>
                    <div className="welcome-title-underline" />
                </div>

                <p className="welcome-tagline">Where every meal feels like a tropical escape</p>
                <p className="welcome-sub">Restaurant Management System</p>

                <button className="welcome-btn" onClick={handleEnter}>
                    <div className="welcome-btn-ripple" />
                    <span className="welcome-btn-text">Enter System</span>
                    <span className="welcome-btn-arrow">→</span>
                </button>

                <div className="welcome-scroll-hint">
                    <div className="scroll-line" />
                    <span>Experience the Island Vibe</span>
                    <div className="scroll-line" />
                </div>
            </main>

            {/* Footer Strip */}
            <footer className="welcome-footer">
                Fresh • Local • Crafted with Love • Comoda Café
            </footer>
        </div>
    )
}
