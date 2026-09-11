import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, footer, wide, narrow, className = '' }) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        if (isOpen) document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`modal ${wide ? 'modal-wide' : ''} ${narrow ? 'modal-narrow' : ''} ${className}`.trim()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal"><X size={16} /></button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    )
}
