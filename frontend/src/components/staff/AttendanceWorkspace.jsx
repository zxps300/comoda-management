import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Clock3, Fingerprint, Plus, Search, Timer, TriangleAlert, Trash2 } from 'lucide-react'
import { attendanceService } from '../../services/attendance.service'
import Modal from '../ui/Modal'

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${today().slice(0, 7)}-01`
const blank = { user_id: '', work_date: today(), time_in: '', time_out: '', source: 'Manual', notes: '' }

const fmtTime = value => value ? new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtHours = mins => `${Math.floor((mins || 0) / 60)}h ${Math.round((mins || 0) % 60)}m`

export default function AttendanceWorkspace({ mode, users, toast }) {
    const [records, setRecords] = useState([])
    const [summary, setSummary] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState(blank)
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState(monthStart())
    const [endDate, setEndDate] = useState(today())

    const load = useCallback(async () => {
        setLoading(true)
        try {
            if (mode === 'reports') setSummary(await attendanceService.getSummary({ start_date: startDate, end_date: endDate }))
            else setRecords(await attendanceService.getAll({ start_date: startDate, end_date: endDate }))
        } catch { toast('Unable to load attendance data', 'error') }
        finally { setLoading(false) }
    }, [endDate, mode, startDate, toast])
    useEffect(() => { load() }, [load])

    const save = async () => {
        if (!form.user_id || !form.work_date || !form.time_in) return toast('Employee, date and time in are required', 'warning')
        const payload = {
            ...form,
            time_in: `${form.work_date}T${form.time_in}:00`,
            time_out: form.time_out ? `${form.work_date}T${form.time_out}:00` : null,
        }
        try {
            await attendanceService.create(payload)
            toast('Attendance saved', 'success'); setModal(false); setForm(blank); load()
        } catch (e) { toast(e.response?.data?.message || 'Unable to save attendance', 'error') }
    }

    const remove = async record => {
        if (!confirm(`Delete ${record.employee}'s attendance for ${record.work_date}?`)) return
        await attendanceService.delete(record.id); toast('Attendance deleted', 'success'); load()
    }

    const filtered = useMemo(() => records.filter(r => `${r.employee} ${r.role} ${r.status}`.toLowerCase().includes(search.toLowerCase())), [records, search])
    const present = records.filter(r => r.time_in).length
    const onDuty = records.filter(r => r.status === 'On Duty').length
    const totalMinutes = records.reduce((sum, r) => sum + r.totalMinutes, 0)
    const incomplete = mode === 'reports' ? summary.reduce((sum, r) => sum + r.incompleteRecords, 0) : onDuty

    return <div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', marginBottom:18, flexWrap:'wrap' }}>
            <div>
                <h2 style={{ fontSize:'1.05rem', margin:0 }}>{mode === 'reports' ? 'Attendance Reports' : 'Daily Attendance'}</h2>
                <p style={{ margin:'4px 0 0', color:'var(--text-muted)', fontSize:'.78rem' }}>
                    {mode === 'reports' ? 'Review duty hours, present days and attendance exceptions.' : 'Record staff duty time manually or from a future fingerprint sync.'}
                </p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input className="input" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={{ width:145, height:38 }}/>
                <span style={{ color:'var(--text-muted)', fontSize:'.75rem' }}>to</span>
                <input className="input" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={{ width:145, height:38 }}/>
                {mode !== 'reports' && <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={15}/> Add Attendance</button>}
            </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))', gap:12, marginBottom:18 }}>
            {[
                { label: mode==='reports'?'Employees Recorded':'Attendance Records', value: mode==='reports'?summary.length:records.length, icon:CalendarCheck, color:'#8a4b25', bg:'#f8eadc' },
                { label: mode==='reports'?'Total Present Days':'Present Entries', value: mode==='reports'?summary.reduce((s,r)=>s+r.daysPresent,0):present, icon:Fingerprint, color:'#26734d', bg:'#e6f4ec' },
                { label:'Total Duty Hours', value: mode==='reports'?summary.reduce((s,r)=>s+r.totalHours,0).toFixed(1):fmtHours(totalMinutes), icon:Timer, color:'#2868a8', bg:'#e8f1fb' },
                { label:'Incomplete Records', value:incomplete, icon:TriangleAlert, color:'#b05f16', bg:'#fff1dc' },
            ].map(({label,value,icon:Icon,color,bg}) => <div key={label} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:16, display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ width:42,height:42,borderRadius:12,background:bg,color,display:'grid',placeItems:'center' }}><Icon size={19}/></div>
                <div><strong style={{ fontSize:'1.25rem', display:'block', lineHeight:1.1 }}>{value}</strong><span style={{ fontSize:'.7rem',color:'var(--text-muted)' }}>{label}</span></div>
            </div>)}
        </div>

        {mode !== 'reports' && <div className="search-input-wrapper" style={{ width:320, marginBottom:14 }}><Search size={15}/><input className="input" placeholder="Search employee or status..." value={search} onChange={e=>setSearch(e.target.value)}/></div>}

        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
            {loading ? <div className="loading"><div className="spinner"/></div> : <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'var(--cream-100)', textAlign:'left' }}>
                    {(mode === 'reports' ? ['Employee','Role','Days Present','Completed Days','Duty Hours','Late','Incomplete'] : ['Date','Employee','Role','Time In','Time Out','Duty Hours','Source','Status','']).map(h=><th key={h} style={{ padding:'12px 14px',fontSize:'.7rem',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'.04em' }}>{h}</th>)}
                </tr></thead>
                <tbody>{(mode === 'reports' ? summary : filtered).length === 0 ? <tr><td colSpan="9" style={{ padding:52,textAlign:'center',color:'var(--text-muted)' }}>No attendance records for this period.</td></tr> : mode === 'reports' ? summary.map(row=><tr key={row.userId} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{padding:'13px 14px',fontWeight:700}}>{row.employee}</td><td style={{padding:14}}>{row.role}</td><td style={{padding:14}}>{row.daysPresent}</td><td style={{padding:14}}>{row.completedDays}</td><td style={{padding:14,fontWeight:700}}>{row.totalHours.toFixed(2)}h</td><td style={{padding:14,color:row.lateMinutes?'#b05f16':'inherit'}}>{row.lateMinutes}m</td><td style={{padding:14}}>{row.incompleteRecords}</td>
                </tr>) : filtered.map(row=><tr key={row.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{padding:'13px 14px'}}>{new Date(`${row.work_date}T00:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td><td style={{padding:14,fontWeight:700}}>{row.employee}</td><td style={{padding:14}}>{row.role}</td><td style={{padding:14}}>{fmtTime(row.time_in)}</td><td style={{padding:14}}>{fmtTime(row.time_out)}</td><td style={{padding:14,fontWeight:700}}>{fmtHours(row.totalMinutes)}</td><td style={{padding:14}}><span style={{fontSize:'.68rem',padding:'4px 8px',borderRadius:20,background:row.source==='Biometric'?'#e8f1fb':'var(--cream-100)'}}>{row.source}</span></td><td style={{padding:14}}><span style={{fontSize:'.68rem',fontWeight:700,color:row.status==='Completed'?'#26734d':'#b05f16'}}>{row.status}</span></td><td style={{padding:14}}><button onClick={()=>remove(row)} style={{background:'none',border:0,color:'var(--danger)',cursor:'pointer'}}><Trash2 size={15}/></button></td>
                </tr>)}</tbody>
            </table></div>}
        </div>

        <Modal isOpen={modal} onClose={()=>setModal(false)} title="Add Attendance Record" footer={<><button className="btn btn-secondary" onClick={()=>setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Attendance</button></>}>
            <div style={{padding:'10px 12px',borderRadius:12,background:'#f8eadc',color:'#70401f',fontSize:'.75rem',marginBottom:16,display:'flex',gap:8}}><Fingerprint size={17}/> Manual records can later be replaced or updated by the fingerprint-device synchronization.</div>
            <div className="form-group"><label>Employee *</label><select className="input" value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})}><option value="">Select employee...</option>{users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>)}</select></div>
            <div className="form-row"><div className="form-group"><label>Duty Date *</label><input className="input" type="date" value={form.work_date} onChange={e=>setForm({...form,work_date:e.target.value})}/></div><div className="form-group"><label>Source</label><select className="input" value={form.source} onChange={e=>setForm({...form,source:e.target.value})}><option>Manual</option><option>Biometric</option><option>Import</option></select></div></div>
            <div className="form-row"><div className="form-group"><label>Time In *</label><input className="input" type="time" value={form.time_in} onChange={e=>setForm({...form,time_in:e.target.value})}/></div><div className="form-group"><label>Time Out</label><input className="input" type="time" value={form.time_out} onChange={e=>setForm({...form,time_out:e.target.value})}/></div></div>
            <div className="form-group"><label>Notes</label><textarea className="input" rows="3" placeholder="Optional correction or duty note" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
        </Modal>
    </div>
}
