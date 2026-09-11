import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
}

export default function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    {icons[t.type] || icons.info}
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    )
}
