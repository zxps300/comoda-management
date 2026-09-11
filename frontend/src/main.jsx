import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

const localDevelopmentHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

if ('serviceWorker' in navigator && (import.meta.env.PROD || !localDevelopmentHost)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
