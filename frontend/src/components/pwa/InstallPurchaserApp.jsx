import { useEffect, useState } from 'react'
import { Download, Share2, Smartphone, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function InstallPurchaserApp() {
    const { user } = useAuth()
    const [prompt, setPrompt] = useState(null)
    const [showIosHelp, setShowIosHelp] = useState(false)
    const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pwa-install-dismissed') === '1')
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

    useEffect(() => {
        const ready = event => { event.preventDefault(); setPrompt(event) }
        window.addEventListener('beforeinstallprompt', ready)
        return () => window.removeEventListener('beforeinstallprompt', ready)
    }, [])

    if (user?.role !== 'Purchaser' || isStandalone || dismissed) return null

    const install = async () => {
        if (prompt) {
            await prompt.prompt()
            await prompt.userChoice
            setPrompt(null)
        } else if (isIos) setShowIosHelp(true)
        else setShowIosHelp(true)
    }
    const dismiss = () => { sessionStorage.setItem('pwa-install-dismissed','1'); setDismissed(true) }

    return <>
        <div className="purchaser-install-banner">
            <div className="purchaser-install-icon"><Smartphone size={19}/></div>
            <div><strong>Install Purchaser App</strong><span>Open Comoda quickly from your home screen.</span></div>
            <button className="purchaser-install-action" onClick={install}><Download size={15}/> Install</button>
            <button className="purchaser-install-close" onClick={dismiss} aria-label="Dismiss install prompt"><X size={16}/></button>
        </div>
        {showIosHelp && <div className="purchaser-install-help" onClick={()=>setShowIosHelp(false)}><div onClick={e=>e.stopPropagation()}><Share2 size={27}/><h3>Add Comoda to Home Screen</h3><p>Open your browser menu, choose <strong>Add to Home screen</strong>. On iPhone, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p><button className="btn btn-primary" onClick={()=>setShowIosHelp(false)}>Got it</button></div></div>}
    </>
}
