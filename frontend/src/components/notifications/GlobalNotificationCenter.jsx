import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, BellRing, Check, CheckCircle2, Clock3, Info, Layers3, Megaphone, PackageX, Plus, Send, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { notificationService } from '../../services/notification.service'
import Modal from '../ui/Modal'
import { useToastContext } from '../../contexts/ToastContext'

const blankAnnouncement = { title:'', message:'', severity:'info', expires_at:'' }

export default function GlobalNotificationCenter() {
    const { user, accessiblePages } = useAuth()
    const toast = useToastContext()
    const navigate = useNavigate()
    const [items, setItems] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    const [compose, setCompose] = useState(false)
    const [form, setForm] = useState(blankAnnouncement)
    const [saving, setSaving] = useState(false)
    const [permission, setPermission] = useState(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported')
    const knownKeys = useRef(new Set(JSON.parse(localStorage.getItem('comoda_known_notifications') || '[]')))

    const deviceNotify = useCallback(async notification => {
        if (permission !== 'granted' || knownKeys.current.has(notification.key)) return
        const options = { body:notification.message, icon:'/comoda-purchaser-icon.svg', badge:'/comoda-purchaser-icon.svg', tag:`comoda-${notification.key}`, data:{url:notification.url || '/'} }
        try {
            const registration = await navigator.serviceWorker?.ready
            if (registration) await registration.showNotification(notification.title, options)
            else new Notification(notification.title, options)
        } catch { /* The in-app notification center remains available. */ }
    }, [permission])

    const load = useCallback(async () => {
        try {
            const data = await notificationService.getAll()
            setItems(data.notifications || [])
            setUnreadCount(data.unreadCount || 0)
            for (const notification of data.notifications || []) if (!notification.isRead) await deviceNotify(notification)
            knownKeys.current = new Set((data.notifications || []).map(item => item.key))
            localStorage.setItem('comoda_known_notifications', JSON.stringify([...knownKeys.current]))
        } catch { /* Keep the rest of the application usable during a notification refresh failure. */ }
    }, [deviceNotify])

    useEffect(() => {
        load()
        const timer = setInterval(load, 60000)
        const refresh = () => document.visibilityState === 'visible' && load()
        document.addEventListener('visibilitychange', refresh)
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
    }, [load])

    const enableDeviceNotifications = async () => {
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result === 'granted') toast('Device notifications enabled', 'success')
    }

    const markRead = async notification => {
        if (!notification.isRead) {
            await notificationService.markRead(notification.key)
            setItems(current => current.map(item => item.key === notification.key ? {...item,isRead:true} : item))
            setUnreadCount(value => Math.max(0, value - 1))
        }
        if (notification.url === '/inventory' && accessiblePages.includes('inventory')) { setOpen(false); navigate('/inventory') }
    }

    const markAllRead = async () => {
        const unread = items.filter(item => !item.isRead)
        await Promise.all(unread.map(item => notificationService.markRead(item.key)))
        setItems(current => current.map(item => ({...item,isRead:true})))
        setUnreadCount(0)
    }

    const postAnnouncement = async () => {
        if (!form.title.trim() || !form.message.trim()) return toast('Title and message are required', 'warning')
        setSaving(true)
        try {
            await notificationService.announce({...form, expires_at:form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null})
            toast('Update sent to all staff', 'success'); setCompose(false); setForm(blankAnnouncement); await load(); setOpen(true)
        } catch (e) { toast(e.response?.data?.message || 'Unable to send update', 'error') }
        finally { setSaving(false) }
    }

    const meta = {
        announcement:{icon:Megaphone,color:'#2868a8',bg:'#e9f3ff'}, out:{icon:PackageX,color:'#c2414b',bg:'#fff0f1'}, low:{icon:AlertTriangle,color:'#b56c14',bg:'#fff7e8'}, expiring:{icon:Clock3,color:'#d45d28',bg:'#fff1e9'}, fifo:{icon:Layers3,color:'#7950a8',bg:'#f5edff'}
    }
    const grouped = useMemo(() => ({ announcements:items.filter(i=>i.type==='announcement').length, inventory:items.filter(i=>i.type!=='announcement').length }), [items])

    return <div className="global-notification-wrap">
        <button className="global-notification-trigger" onClick={()=>setOpen(v=>!v)} aria-label={`Notifications, ${unreadCount} unread`}>
            {unreadCount ? <BellRing size={18}/> : <Bell size={18}/>} {unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}
        </button>
        {open && <><button className="global-notification-scrim" onClick={()=>setOpen(false)} aria-label="Close notifications"/><section className="global-notification-panel">
            <header><div><strong>Notifications</strong><span>{grouped.announcements} admin update{grouped.announcements!==1?'s':''} · {grouped.inventory} inventory alert{grouped.inventory!==1?'s':''}</span></div><button onClick={()=>setOpen(false)} aria-label="Close"><X size={17}/></button></header>
            <div className="global-notification-actions">
                {user?.role === 'Admin' && <button onClick={()=>{setOpen(false);setCompose(true)}}><Plus size={14}/> Post Update</button>}
                {permission !== 'granted' && permission !== 'unsupported' && <button onClick={enableDeviceNotifications}><BellRing size={14}/> Enable Device Alerts</button>}
                {unreadCount > 0 && <button onClick={markAllRead}><Check size={14}/> Mark All Read</button>}
            </div>
            <div className="global-notification-list">
                {items.length === 0 ? <div className="global-notification-empty"><CheckCircle2 size={30}/><strong>You're all caught up</strong><span>No Admin updates or inventory alerts.</span></div> : items.map(item => {
                    const config=meta[item.type] || {icon:Info,color:'#51718c',bg:'#edf5fa'}; const Icon=config.icon
                    return <button key={item.key} className={item.isRead?'read':'unread'} onClick={()=>markRead(item)}>
                        <i style={{color:config.color,background:config.bg}}><Icon size={17}/></i>
                        <span><strong>{item.title}</strong><em>{item.message}</em><small>{item.source}</small></span>
                        {!item.isRead && <b/>}
                    </button>
                })}
            </div>
        </section></>}

        <Modal isOpen={compose} onClose={()=>setCompose(false)} title="Post Staff Update" footer={<><button className="btn btn-secondary" onClick={()=>setCompose(false)}>Cancel</button><button className="btn btn-primary" onClick={postAnnouncement} disabled={saving}><Send size={15}/>{saving?'Sending...':'Send to Everyone'}</button></>}>
            <div className="form-group"><label>Update Title *</label><input className="input" placeholder="e.g. Staff meeting at 4:00 PM" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
            <div className="form-group"><label>Message *</label><textarea className="input" rows="4" placeholder="Write the update everyone should see..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></div>
            <div className="form-row"><div className="form-group"><label>Priority</label><select className="input" value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}><option value="info">Information</option><option value="success">Good News</option><option value="warning">Important</option><option value="urgent">Urgent</option></select></div><div className="form-group"><label>Show Until <span style={{fontWeight:400,color:'var(--text-muted)'}}>(optional)</span></label><input className="input" type="date" value={form.expires_at} onChange={e=>setForm({...form,expires_at:e.target.value})}/></div></div>
            <div style={{padding:'10px 12px',borderRadius:10,background:'var(--cream-100)',color:'var(--text-muted)',fontSize:'.72rem'}}>This update will appear for Admin, Cashier, Purchaser, Kitchen Staff, Waiter, Bar, and Pastry accounts.</div>
        </Modal>
    </div>
}
