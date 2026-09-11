import { useCallback, useEffect, useState } from 'react'
import {
    Plus, Pencil, Trash2, Search, UserRound, CalendarDays,
    Clock, X, ChefHat, ShoppingCart, LayoutDashboard,
    Users as UsersIcon, CheckCircle2, XCircle, Filter, ClipboardCheck, FileBarChart,
    Archive, RotateCcw, ShieldAlert
} from 'lucide-react'
import { usersService } from '../services/users.service'
import { scheduleService } from '../services/schedule.service'
import Modal from '../components/ui/Modal'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import AttendanceWorkspace from '../components/staff/AttendanceWorkspace'

const ROLES = ['Admin', 'Cashier', 'Purchaser', 'Kitchen Staff', 'Waiter', 'Bar', 'Pastry']
const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = { Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat',Sunday:'Sun' }
const SHIFTS = ['Morning','Afternoon','Evening','Night','Full Day']

const BLANK = { fullName:'', username:'', email:'', biometricId:'', password:'', role:'', is_active:true }
const BLANK_SCHED = { user_id:'', day_of_week:'Monday', start_time:'08:00', end_time:'17:00', shift_label:'Morning', notes:'' }

const ROLE_COLOR = {
    Admin:'#7a3718', Cashier:'#1565c0', Purchaser:'#2e7d32',
    'Kitchen Staff':'#e65100', Waiter:'#6a1b9a',
}
const ROLE_BG = {
    Admin:'#f5d9c2', Cashier:'#e3f2fd', Purchaser:'#e8f5e9',
    'Kitchen Staff':'#fff3e0', Waiter:'#f3e8fd',
}

function fmt12(t) {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`
}

function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function Users() {
    const toast = useToastContext()
    const { user: currentUser } = useAuth()
    const [users, setUsers]         = useState([])
    const [archivedUsers, setArchivedUsers] = useState([])
    const [archivedSelected, setArchivedSelected] = useState([])
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading]     = useState(true)
    const [search, setSearch]       = useState('')
    const [roleFilter, setRoleFilter] = useState('All')
    const [view, setView]           = useState('employees')

    // User modal
    const [userModal, setUserModal]   = useState(false)
    const [editing, setEditing]       = useState(null)
    const [form, setForm]             = useState(BLANK)
    const [saving, setSaving]         = useState(false)

    // Schedule modal
    const [schedModal, setSchedModal]     = useState(false)
    const [editingSched, setEditingSched] = useState(null)
    const [schedForm, setSchedForm]       = useState(BLANK_SCHED)

    // Detail panel
    const [panel, setPanel] = useState(null) // user object

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([usersService.getAll(), usersService.getArchived(), scheduleService.getAll()])
            .then(([u, archived, s]) => {
                setUsers(u)
                setArchivedUsers(archived)
                setArchivedSelected(selected => selected.filter(id => archived.some(user => user.id === id)))
                setSchedules(s)
            })
            .catch(() => toast('Failed to load data', 'error'))
            .finally(() => setLoading(false))
    }, [toast])
    useEffect(load, [load])

    /* ── User CRUD ── */
    const openAdd = () => { setEditing(null); setForm(BLANK); setUserModal(true) }
    const openEdit = (u) => {
        setEditing(u)
        setForm({ fullName: u.fullName, username: u.username, email: u.email || '', biometricId: u.biometricId || '', password: '', role: u.role, is_active: u.is_active })
        setUserModal(true)
    }
    const saveUser = async () => {
        if (!form.fullName || !form.username || !form.role) { toast('Name, username and role are required','warning'); return }
        if (!editing && !form.password) { toast('Password required for new users','warning'); return }
        setSaving(true)
        try {
            const payload = { ...form }
            if (!payload.password) delete payload.password
            editing ? await usersService.update(editing.id, payload) : await usersService.create(payload)
            toast(editing ? 'User updated' : 'User created', 'success')
            setUserModal(false); load()
        } catch (e) { toast(e.response?.data?.message || 'Error saving user','error') }
        finally { setSaving(false) }
    }
    const archiveUser = async (u) => {
        if (!confirm(`Archive ${u.fullName}? They will no longer be able to sign in, but their account can be restored.`)) return
        try {
            await usersService.archive(u.id)
            toast('User moved to archive','success')
            if (panel?.id === u.id) setPanel(null)
            load()
        } catch (error) { toast(error.response?.data?.message || 'Error archiving user','error') }
    }
    const restoreUser = async (u) => {
        try {
            await usersService.restore(u.id)
            toast(`${u.fullName} restored`, 'success')
            load()
        } catch (error) { toast(error.response?.data?.message || 'Error restoring user', 'error') }
    }
    const permanentlyDeleteUser = async (u) => {
        if (!confirm(`Permanently delete ${u.fullName}? This cannot be undone.`)) return
        try {
            await usersService.forceDelete(u.id)
            toast('User permanently deleted', 'success')
            load()
        } catch (error) { toast(error.response?.data?.message || 'Error deleting user', 'error') }
    }
    const permanentlyDeleteSelected = async () => {
        if (archivedSelected.length === 0) return
        if (!confirm(`Permanently delete ${archivedSelected.length} selected archived user${archivedSelected.length > 1 ? 's' : ''}? This cannot be undone.`)) return
        setSaving(true)
        try {
            await Promise.all(archivedSelected.map(id => usersService.forceDelete(id)))
            toast(`${archivedSelected.length} archived user${archivedSelected.length > 1 ? 's' : ''} permanently deleted`, 'success')
            setArchivedSelected([])
            load()
        } catch (error) { toast(error.response?.data?.message || 'Error deleting selected users', 'error') }
        finally { setSaving(false) }
    }

    /* ── Schedule CRUD ── */
    const openAddSched = (userId = '') => {
        setEditingSched(null)
        setSchedForm({ ...BLANK_SCHED, user_id: userId })
        setSchedModal(true)
    }
    const openEditSched = (s) => {
        setEditingSched(s)
        setSchedForm({ user_id: s.user_id, day_of_week: s.day_of_week, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5), shift_label: s.shift_label || '', notes: s.notes || '' })
        setSchedModal(true)
    }
    const saveSched = async () => {
        if (!schedForm.user_id || !schedForm.day_of_week) { toast('Staff and day required','warning'); return }
        setSaving(true)
        try {
            editingSched ? await scheduleService.update(editingSched.id, schedForm) : await scheduleService.create(schedForm)
            toast(editingSched ? 'Schedule updated' : 'Schedule added','success')
            setSchedModal(false); load()
        } catch (e) { toast(e.response?.data?.message || 'Error saving schedule','error') }
        finally { setSaving(false) }
    }
    const deleteSched = async (s) => {
        if (!confirm(`Remove ${s.day_of_week} shift for ${s.userName}?`)) return
        try { await scheduleService.delete(s.id); toast('Schedule removed','success'); load() }
        catch { toast('Error removing schedule','error') }
    }

    /* ── Filtered list ── */
    const filtered = users.filter(u => {
        const matchSearch = [u.fullName, u.username, u.email, u.role].join(' ').toLowerCase().includes(search.toLowerCase())
        const matchRole   = roleFilter === 'All' || u.role === roleFilter
        return matchSearch && matchRole
    })
    const filteredArchived = archivedUsers.filter(u => {
        const matchSearch = [u.fullName, u.username, u.email, u.role].join(' ').toLowerCase().includes(search.toLowerCase())
        const matchRole = roleFilter === 'All' || u.role === roleFilter
        return matchSearch && matchRole
    })

    const userSched = (uid) => schedules.filter(s => s.user_id === uid)

    /* ── Stats ── */
    const stats = {
        total:  users.length,
        active: users.filter(u => u.is_active).length,
        archived: archivedUsers.length,
        byRole: ROLES.reduce((a, r) => { a[r] = users.filter(u => u.role === r).length; return a }, {}),
    }

    return (
        <div className="staff-page-shell">

            {/* ─────────── Main Column ─────────── */}
            <div className="staff-page-main">

                {/* Page Header */}
                <div className="page-header staff-page-header">
                <div></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {view === 'schedule'
                            ? <button className="btn btn-primary" onClick={() => openAddSched()}><Plus size={16}/> Add Shift</button>
                            : view === 'employees' ? <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Employee</button> : null
                        }
                    </div>
                </div>

                {/* ── Stats Strip ── */}
                <div className="staff-stats-strip">
                    {[
                        { label:'Total Staff', value: stats.total, icon: <UsersIcon size={18}/>, color:'var(--brown-600)', bg:'var(--brown-100)' },
                        { label:'Active',      value: stats.active, icon: <CheckCircle2 size={18}/>, color:'var(--success)', bg:'var(--success-bg)' },
                        { label:'Inactive',    value: stats.total - stats.active, icon: <XCircle size={18}/>, color:'var(--danger)', bg:'var(--danger-bg)' },
                        { label:'Archived',    value: stats.archived, icon: <Archive size={18}/>, color:'#7b5b43', bg:'#f1e8df' },
                    ].map(s => (
                        <div className="staff-glass-stat" key={s.label}>
                            <div style={{ width:38, height:38, borderRadius:'var(--radius-md)', background:s.bg, color:s.color, display:'flex', alignItems:'center', justifyContent:'center' }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize:'1.4rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
                                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
                            </div>
                        </div>
                    ))}

                    {/* Role Summary Mini Pills */}
                    <div className="staff-role-summary">
                        {ROLES.filter(r => stats.byRole[r] > 0).map(r => (
                            <span key={r} style={{ fontSize:'0.72rem', fontWeight:700, padding:'4px 10px', borderRadius:20, background: ROLE_BG[r], color: ROLE_COLOR[r] }}>
                                {r} ×{stats.byRole[r]}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── View Tabs ── */}
                <div className="staff-view-toolbar">
                    <div className="filter-tabs" style={{ marginBottom:0 }}>
                        <button className={`filter-tab ${view==='employees'?'active':''}`} onClick={()=>{setView('employees');setPanel(null)}}>
                            <UserRound size={14}/> Employees
                        </button>
                        <button className={`filter-tab ${view==='schedule'?'active':''}`} onClick={()=>setView('schedule')}>
                            <CalendarDays size={14}/> Weekly Schedule
                        </button>
                        <button className={`filter-tab ${view==='attendance'?'active':''}`} onClick={()=>{setView('attendance');setPanel(null)}}><ClipboardCheck size={14}/> Attendance</button>
                        <button className={`filter-tab ${view==='reports'?'active':''}`} onClick={()=>{setView('reports');setPanel(null)}}><FileBarChart size={14}/> Attendance Reports</button>
                        <button className={`filter-tab ${view==='archived'?'active':''}`} onClick={()=>{setView('archived');setPanel(null)}}><Archive size={14}/> Archived Users {stats.archived > 0 && <span className="staff-archive-count">{stats.archived}</span>}</button>
                    </div>

                    {(view === 'employees' || view === 'archived') && (
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            {/* Search */}
                            <div className="search-input-wrapper" style={{ minWidth:200 }}>
                                <Search size={14}/>
                                <input className="input" style={{ padding:'6px 12px 6px 32px', height:'auto' }}
                                    placeholder="Search staff..." value={search}
                                    onChange={e => setSearch(e.target.value)}/>
                            </div>
                            {/* Role filter */}
                            <select className="input" style={{ width:'auto', padding:'6px 12px', height:'auto' }}
                                value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                <option value="All">All Roles</option>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* ── Staff Grid ── */}
                {view === 'employees' && (
                    loading ? <div className="loading"><div className="spinner"/></div> : (
                        filtered.length === 0 ? (
                            <div className="empty-state"><UserRound size={48}/><h3>No staff found</h3></div>
                        ) : (
                            <div className="staff-cards-grid">
                                {filtered.map(u => {
                                    const sched = userSched(u.id)
                                    const isSelected = panel?.id === u.id
                                    return (
                                        <div key={u.id}
                                            className={`staff-glass-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setPanel(isSelected ? null : u)}
                                            style={{
                                                background: isSelected ? ROLE_BG[u.role] : undefined,
                                                border: `2px solid ${isSelected ? ROLE_COLOR[u.role] : 'var(--border)'}`,
                                                boxShadow: isSelected ? `0 8px 24px ${ROLE_COLOR[u.role]}30` : undefined
                                            }}>
                                            {/* Top row */}
                                            <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                                                <div style={{
                                                    width:46, height:46, borderRadius:'50%', flexShrink:0,
                                                    background: ROLE_COLOR[u.role] || 'var(--brown-600)', color:'#fff',
                                                    display:'flex', alignItems:'center', justifyContent:'center',
                                                    fontWeight:700, fontSize:'1rem'
                                                }}>{initials(u.fullName)}</div>
                                                <div style={{ flex:1, minWidth:0 }}>
                                                    <div style={{ fontWeight:700, fontSize:'0.95rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.fullName}</div>
                                                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:1 }}>@{u.username}</div>
                                                    <span style={{
                                                        display:'inline-block', marginTop:4,
                                                        fontSize:'0.65rem', fontWeight:700, padding:'2px 8px', borderRadius:12,
                                                        background: ROLE_BG[u.role], color: ROLE_COLOR[u.role]
                                                    }}>{u.role}</span>
                                                </div>
                                                <div style={{
                                                    width:8, height:8, borderRadius:'50%', marginTop:4,
                                                    background: u.is_active ? 'var(--success)' : 'var(--danger)',
                                                    boxShadow: u.is_active ? '0 0 6px var(--success)' : 'none'
                                                }} title={u.is_active ? 'Active' : 'Inactive'}/>
                                            </div>

                                            {u.email && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>✉ {u.email}</div>}

                                            {/* Day dots */}
                                            <div style={{ display:'flex', gap:4, marginBottom:12 }}>
                                                {DAYS.map(d => {
                                                    const has = sched.find(s => s.day_of_week === d)
                                                    return (
                                                        <div key={d} title={has ? `${d}: ${fmt12(has.start_time)}–${fmt12(has.end_time)}` : d}
                                                            style={{
                                                                flex:1, height:4, borderRadius:4,
                                                                background: has ? ROLE_COLOR[u.role] : 'var(--cream-300)',
                                                                opacity: has ? 1 : 0.4
                                                            }}/>
                                                    )
                                                })}
                                            </div>
                                            <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginBottom:12 }}>
                                                {sched.length > 0 ? `${sched.length} shift${sched.length>1?'s':''} scheduled` : 'No shifts yet'}
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
                                                <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={() => openEdit(u)}>
                                                    <Pencil size={13}/> Edit
                                                </button>
                                                <button className="btn btn-sm" style={{ flex:1, justifyContent:'center', background:ROLE_BG[u.role], color:ROLE_COLOR[u.role], border:'none' }}
                                                    onClick={() => { setView('schedule'); setPanel(u) }}>
                                                    <CalendarDays size={13}/> Schedule
                                                </button>
                                                <button className="btn btn-sm staff-archive-button" onClick={() => archiveUser(u)} disabled={currentUser?.id === u.id} title={currentUser?.id === u.id ? 'You cannot archive your own account' : 'Archive user'}>
                                                    <Archive size={13}/>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    )
                )}

                {/* ── Archived Users ── */}
                {view === 'archived' && (
                    <section className="staff-archive-panel">
                        <div className="staff-archive-panel-heading">
                            <div>
                                <span><Archive size={18}/></span>
                                <div>
                                    <h3>Archived Users</h3>
                                    <p>Restore accounts or select users for permanent deletion.</p>
                                </div>
                            </div>
                            <div className="staff-archive-bulk-actions">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={filteredArchived.length > 0 && filteredArchived.every(user => archivedSelected.includes(user.id))}
                                        onChange={event => setArchivedSelected(event.target.checked ? filteredArchived.map(user => user.id) : [])}
                                    />
                                    Select all
                                </label>
                                <button className="btn btn-danger btn-sm" disabled={saving || archivedSelected.length === 0} onClick={permanentlyDeleteSelected}>
                                    <Trash2 size={13}/> Delete Selected {archivedSelected.length > 0 && `(${archivedSelected.length})`}
                                </button>
                            </div>
                        </div>

                        {loading ? <div className="loading"><div className="spinner"/></div> : filteredArchived.length === 0 ? (
                            <div className="staff-archive-empty">
                                <Archive size={42}/>
                                <h3>No archived users</h3>
                                <p>Archived staff accounts will appear here.</p>
                            </div>
                        ) : (
                            <div className="staff-archived-grid">
                                {filteredArchived.map(u => {
                                    const selected = archivedSelected.includes(u.id)
                                    return (
                                        <article className={`staff-archived-card ${selected ? 'selected' : ''}`} key={u.id}>
                                            <label className="staff-archive-checkbox" title="Select user">
                                                <input type="checkbox" checked={selected} onChange={event => setArchivedSelected(ids => event.target.checked ? [...new Set([...ids, u.id])] : ids.filter(id => id !== u.id))}/>
                                            </label>
                                            <div className="staff-archived-avatar" style={{ background: ROLE_COLOR[u.role] || 'var(--brown-600)' }}>{initials(u.fullName)}</div>
                                            <div className="staff-archived-info">
                                                <h4>{u.fullName}</h4>
                                                <p>@{u.username} · {u.role}</p>
                                                <small>Archived {u.archivedAt ? new Date(u.archivedAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : 'recently'}</small>
                                            </div>
                                            <div className="staff-archived-actions">
                                                <button className="btn btn-secondary btn-sm" onClick={() => restoreUser(u)}><RotateCcw size={13}/> Restore</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => permanentlyDeleteUser(u)}><Trash2 size={13}/> Delete Permanently</button>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        )}
                        <div className="staff-archive-warning"><ShieldAlert size={15}/> Permanent deletion is available only inside this archive and cannot be undone.</div>
                    </section>
                )}

                {/* ── Weekly Schedule ── */}
                {view === 'schedule' && (
                    <div>
                        {/* Staff filter pills */}
                        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
                            <Filter size={13} style={{ color:'var(--text-muted)'}}/>
                            <button className={`filter-tab ${!panel?'active':''}`} onClick={() => setPanel(null)} style={{ fontSize:'0.75rem' }}>All Staff</button>
                            {users.map(u => (
                                <button key={u.id}
                                    className={`filter-tab ${panel?.id===u.id?'active':''}`}
                                    onClick={() => setPanel(panel?.id===u.id?null:u)}
                                    style={{ fontSize:'0.75rem', borderColor: panel?.id===u.id ? ROLE_COLOR[u.role] : undefined }}>
                                    <span style={{ width:8, height:8, borderRadius:'50%', background:ROLE_COLOR[u.role], display:'inline-block', marginRight:4 }}/>
                                    {u.fullName.split(' ')[0]}
                                </button>
                            ))}
                        </div>

                        {/* 7-day grid */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
                            {DAYS.map(day => {
                                const isSun = day === 'Sunday'; const isSat = day === 'Saturday'
                                const isWeekend = isSat || isSun
                                const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
                                const isToday = day === today
                                const dayScheds = schedules.filter(s => s.day_of_week === day && (!panel || s.user_id === panel.id))
                                return (
                                    <div key={day} style={{
                                        background: isWeekend ? 'rgba(0,0,0,0.02)' : 'var(--bg-card)',
                                        border:`2px solid ${isToday?'var(--brown-400)':'var(--border)'}`,
                                        borderTop:`3px solid ${isToday?'var(--brown-600)':isWeekend?'var(--text-muted)':'var(--cream-400)'}`,
                                        borderRadius:'var(--radius-md)', padding:10, minHeight:160
                                    }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                                            <div>
                                                <div style={{ fontWeight:700, fontSize:'0.8rem', color: isToday?'var(--brown-600)':isWeekend?'var(--text-muted)':'var(--text-primary)' }}>
                                                    {DAY_SHORT[day]}
                                                </div>
                                                {isToday && <div style={{ fontSize:'0.6rem', color:'var(--brown-500)', fontWeight:600 }}>TODAY</div>}
                                            </div>
                                            <button onClick={() => openAddSched(panel?.id || '')}
                                                style={{ background:'none', border:'1px dashed var(--border)', borderRadius:4, cursor:'pointer', color:'var(--text-muted)', padding:'1px 5px', fontSize:'0.75rem' }}>
                                                +
                                            </button>
                                        </div>

                                        {dayScheds.length === 0
                                            ? <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textAlign:'center', paddingTop:16, opacity:0.6 }}>—</div>
                                            : dayScheds.map(s => (
                                                <div key={s.id} style={{
                                                    marginBottom:6, padding:'5px 7px', borderRadius:5,
                                                    background:`${ROLE_COLOR[s.userRole] || '#999'}15`,
                                                    borderLeft:`3px solid ${ROLE_COLOR[s.userRole] || '#999'}`,
                                                }}>
                                                    <div style={{ fontWeight:700, fontSize:'0.7rem', color:ROLE_COLOR[s.userRole] }}>{s.userName.split(' ')[0]}</div>
                                                    {s.shift_label && <div style={{ fontSize:'0.6rem', color:'var(--text-muted)' }}>{s.shift_label}</div>}
                                                    <div style={{ fontSize:'0.6rem', color:'var(--text-secondary)', marginTop:2 }}>
                                                        <Clock size={8} style={{ display:'inline', marginRight:2 }}/>
                                                        {fmt12(s.start_time)}–{fmt12(s.end_time)}
                                                    </div>
                                                    <div style={{ display:'flex', gap:6, marginTop:4 }}>
                                                        <button onClick={() => openEditSched(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0 }}><Pencil size={10}/></button>
                                                        <button onClick={() => deleteSched(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', padding:0 }}><Trash2 size={10}/></button>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
                {(view === 'attendance' || view === 'reports') && <AttendanceWorkspace mode={view} users={users} toast={toast}/>}
            </div>

            {/* ─────────── Side Detail Panel ─────────── */}
            {panel && view === 'employees' && (
                <div className="staff-detail-glass" style={{
                    width:280, flexShrink:0, marginLeft:20,
                    border:'1px solid var(--border)',
                    borderRadius:'var(--radius-lg)', padding:20, alignSelf:'flex-start',
                    position:'sticky', top:24,
                    boxShadow:`0 4px 20px ${ROLE_COLOR[panel.role]}20`
                }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                        <span style={{ fontWeight:700, fontSize:'0.85rem' }}>Staff Detail</span>
                        <button onClick={() => setPanel(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16}/></button>
                    </div>

                    {/* Avatar */}
                    <div style={{ textAlign:'center', marginBottom:16 }}>
                        <div style={{
                            width:72, height:72, borderRadius:'50%', margin:'0 auto 10px',
                            background: ROLE_COLOR[panel.role], color:'#fff',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:'1.6rem', fontWeight:800, boxShadow:`0 4px 16px ${ROLE_COLOR[panel.role]}50`
                        }}>{initials(panel.fullName)}</div>
                        <div style={{ fontWeight:800, fontSize:'1rem' }}>{panel.fullName}</div>
                        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>@{panel.username}</div>
                        <div style={{ marginTop:6, display:'flex', justifyContent:'center', gap:6 }}>
                            <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'3px 10px', borderRadius:20, background:ROLE_BG[panel.role], color:ROLE_COLOR[panel.role] }}>{panel.role}</span>
                            <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'3px 10px', borderRadius:20, background: panel.is_active?'var(--success-bg)':'var(--danger-bg)', color: panel.is_active?'var(--success)':'var(--danger)' }}>
                                {panel.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>

                    {panel.email && (
                        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', textAlign:'center', marginBottom:16, padding:'8px', background:'var(--cream-100)', borderRadius:'var(--radius-sm)' }}>
                            ✉ {panel.email}
                        </div>
                    )}

                    {/* Their schedule */}
                    <div style={{ marginBottom:12 }}>
                        <div style={{ fontWeight:600, fontSize:'0.8rem', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            Schedule
                            <button className="btn btn-sm btn-secondary" style={{ padding:'3px 8px', fontSize:'0.68rem' }} onClick={() => openAddSched(panel.id)}>
                                <Plus size={11}/> Add
                            </button>
                        </div>
                        {userSched(panel.id).length === 0
                            ? <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textAlign:'center', padding:'12px 0' }}>No shifts scheduled</div>
                            : userSched(panel.id).map(s => (
                                <div key={s.id} style={{
                                    display:'flex', justifyContent:'space-between', alignItems:'center',
                                    padding:'6px 8px', marginBottom:5, borderRadius:'var(--radius-sm)',
                                    background:'var(--cream-50)', border:'1px solid var(--cream-300)'
                                }}>
                                    <div>
                                        <div style={{ fontWeight:600, fontSize:'0.75rem' }}>{DAY_SHORT[s.day_of_week]}{s.shift_label ? ` · ${s.shift_label}` : ''}</div>
                                        <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                                    </div>
                                    <div style={{ display:'flex', gap:4 }}>
                                        <button onClick={() => openEditSched(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}><Pencil size={11}/></button>
                                        <button onClick={() => deleteSched(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', padding:2 }}><Trash2 size={11}/></button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    {/* Quick actions */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                        <button className="btn btn-secondary btn-sm" style={{ justifyContent:'center', width:'100%' }} onClick={() => openEdit(panel)}>
                            <Pencil size={13}/> Edit Profile
                        </button>
                        <button className="btn btn-sm" style={{ justifyContent:'center', width:'100%', background:ROLE_BG[panel.role], color:ROLE_COLOR[panel.role], border:'none' }}
                            onClick={() => { setView('schedule'); }}>
                            <CalendarDays size={13}/> Full Schedule View
                        </button>
                        <button className="btn btn-sm staff-archive-button" style={{ justifyContent:'center', width:'100%' }} onClick={() => archiveUser(panel)} disabled={currentUser?.id === panel.id}>
                            <Archive size={13}/> Archive Staff
                        </button>
                    </div>
                </div>
            )}

            {/* ── User Modal ── */}
            <Modal isOpen={userModal} onClose={() => setUserModal(false)} title={editing ? 'Edit Staff' : 'Add New Staff'}
                footer={<><button className="btn btn-secondary" onClick={() => setUserModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving?'Saving...':'Save'}</button></>}>
                <div className="form-group">
                    <label>Full Name *</label>
                    <input className="input" placeholder="Juan dela Cruz" value={form.fullName} onChange={e => setForm({...form, fullName:e.target.value})}/>
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input className="input" type="email" placeholder="juan@comoda.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})}/>
                </div>
                <div className="form-group"><label>Biometric Employee ID <span style={{color:'var(--text-muted)',fontWeight:400}}>(optional)</span></label><input className="input" placeholder="e.g. BIO-001" value={form.biometricId} onChange={e=>setForm({...form,biometricId:e.target.value})}/><small style={{color:'var(--text-muted)'}}>Use the employee number registered in the fingerprint device.</small></div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Username *</label>
                        <input className="input" placeholder="juandc" value={form.username} onChange={e => setForm({...form, username:e.target.value})}/>
                    </div>
                    <div className="form-group">
                        <label>{editing ? 'New Password (blank = keep)' : 'Password *'}</label>
                        <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password:e.target.value})}/>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Role *</label>
                        <select className="input" value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
                            <option value="">Select role...</option>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Status</label>
                        <select className="input" value={String(form.is_active)} onChange={e => setForm({...form, is_active:e.target.value==='true'})}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                </div>
            </Modal>

            {/* ── Schedule Modal ── */}
            <Modal isOpen={schedModal} onClose={() => setSchedModal(false)} title={editingSched ? 'Edit Shift' : 'Add Shift'}
                footer={<><button className="btn btn-secondary" onClick={() => setSchedModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveSched} disabled={saving}>{saving?'Saving...':'Save Shift'}</button></>}>
                <div className="form-group">
                    <label>Staff Member *</label>
                    <select className="input" value={schedForm.user_id} onChange={e => setSchedForm({...schedForm, user_id:e.target.value})}>
                        <option value="">Select staff...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
                    </select>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Day *</label>
                        <select className="input" value={schedForm.day_of_week} onChange={e => setSchedForm({...schedForm, day_of_week:e.target.value})}>
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Shift Type</label>
                        <select className="input" value={schedForm.shift_label} onChange={e => setSchedForm({...schedForm, shift_label:e.target.value})}>
                            <option value="">No label</option>
                            {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Start Time *</label>
                        <input className="input" type="time" value={schedForm.start_time} onChange={e => setSchedForm({...schedForm, start_time:e.target.value})}/>
                    </div>
                    <div className="form-group">
                        <label>End Time *</label>
                        <input className="input" type="time" value={schedForm.end_time} onChange={e => setSchedForm({...schedForm, end_time:e.target.value})}/>
                    </div>
                </div>
                <div className="form-group">
                    <label>Notes <span style={{color:'var(--text-muted)',fontWeight:400}}>(optional)</span></label>
                    <input className="input" placeholder="e.g. Covering closing shift" value={schedForm.notes} onChange={e => setSchedForm({...schedForm, notes:e.target.value})}/>
                </div>
            </Modal>
        </div>
    )
}
