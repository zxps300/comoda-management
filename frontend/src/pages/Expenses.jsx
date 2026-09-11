import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { expensesService } from '../services/expenses.service'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/ui/Modal'
import { Wallet, Search, Filter, Trash2, Plus, Clock, Tag, CalendarDays, ChevronLeft, ChevronRight, ReceiptText, TrendingDown, X } from 'lucide-react'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })
const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

const CATEGORIES = [
    'Supplies',
    'Ingredients',
    'Maintenance',
    'Utilities',
]

const toISODate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const fromISODate = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}
const displayDate = (value) => fromISODate(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

function ExpenseDateRangePicker({ value, onChange }) {
    const [open, setOpen] = useState(false)
    const [selecting, setSelecting] = useState('start')
    const [viewMonth, setViewMonth] = useState(() => new Date(fromISODate(value.start).getFullYear(), fromISODate(value.start).getMonth(), 1))
    const pickerRef = useRef(null)

    useEffect(() => {
        const close = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    const start = fromISODate(value.start)
    const end = fromISODate(value.end)
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const gridStart = new Date(firstDay)
    gridStart.setDate(1 - firstDay.getDay())
    const days = Array.from({ length: 42 }, (_, index) => {
        const day = new Date(gridStart)
        day.setDate(gridStart.getDate() + index)
        return day
    })

    const chooseDate = (day) => {
        const chosen = toISODate(day)
        if (selecting === 'start') {
            onChange({ start: chosen, end: day > end ? chosen : value.end })
            setSelecting('end')
        } else {
            onChange({ start: day < start ? chosen : value.start, end: chosen })
            setSelecting('start')
            setOpen(false)
        }
    }

    const openFor = (field) => {
        const date = fromISODate(value[field])
        setSelecting(field)
        setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1))
        setOpen(true)
    }

    return (
        <div className={`expense-date-picker ${open ? 'open' : ''}`} ref={pickerRef}>
            <div className="expense-date-fields">
                <button type="button" className={open && selecting === 'start' ? 'active' : ''} onClick={() => openFor('start')}>
                    <span>Start date</span><strong>{displayDate(value.start)}</strong>
                </button>
                <span className="expense-date-separator">→</span>
                <button type="button" className={open && selecting === 'end' ? 'active' : ''} onClick={() => openFor('end')}>
                    <span>End date</span><strong>{displayDate(value.end)}</strong>
                </button>
                <CalendarDays size={18} />
            </div>

            {open && (
                <div className="expense-calendar-popover">
                    <div className="expense-calendar-heading">
                        <div><small>{selecting === 'start' ? 'Choose start date' : 'Choose end date'}</small><strong>{viewMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</strong></div>
                        <div className="expense-calendar-nav">
                            <button type="button" aria-label="Previous month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
                            <button type="button" aria-label="Next month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
                        </div>
                    </div>
                    <div className="expense-calendar-weekdays">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day => <span key={day}>{day}</span>)}</div>
                    <div className="expense-calendar-grid">
                        {days.map(day => {
                            const iso = toISODate(day)
                            const outside = day.getMonth() !== viewMonth.getMonth()
                            const inRange = day >= start && day <= end
                            const edge = iso === value.start || iso === value.end
                            const today = iso === toISODate(new Date())
                            return <button type="button" key={iso} className={`${outside ? 'outside' : ''} ${inRange ? 'in-range' : ''} ${edge ? 'range-edge' : ''} ${today ? 'today' : ''}`} onClick={() => chooseDate(day)}>{day.getDate()}</button>
                        })}
                    </div>
                    <div className="expense-calendar-footer">
                        <span>{displayDate(value.start)} — {displayDate(value.end)}</span>
                        <button type="button" onClick={() => { const today = new Date(); setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); chooseDate(today) }}>Today</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function Expenses() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState('All')
    const [timeframe, setTimeframe] = useState('month')
    const [customDates, setCustomDates] = useState({ 
        start: new Date().toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    })

    // Form Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'Supplies',
        description: '',
        amount: ''
    })

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await expensesService.getAll()
            setExpenses(data)
        } catch (err) {
            toast('Failed to load expenses', 'error')
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => { loadData() }, [loadData])

    const now = useMemo(() => new Date(), [])
    const todayStr = now.toISOString().split('T')[0]
    
    // Stats
    const todayTotal = expenses
        .filter(e => e.date === todayStr)
        .reduce((sum, e) => sum + Number(e.amount), 0)
        
    const monthTotal = expenses
        .filter(e => {
            const d = new Date(e.date)
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        .reduce((sum, e) => sum + Number(e.amount), 0)

    // Filtered
    const filtered = useMemo(() => {
        return expenses.filter(e => {
            const edate = new Date(e.date)
            let matchesDate = true
            
            if (timeframe === 'today') matchesDate = e.date === todayStr
            else if (timeframe === 'week') {
                const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7)
                matchesDate = edate >= weekAgo
            }
            else if (timeframe === 'month') {
                matchesDate = edate.getMonth() === now.getMonth() && edate.getFullYear() === now.getFullYear()
            }
            else if (timeframe === 'custom') {
                const s = new Date(customDates.start)
                const end = new Date(customDates.end); end.setHours(23,59,59)
                matchesDate = edate >= s && edate <= end
            }

            const matchesCat = filterCategory === 'All' || e.category === filterCategory
            const matchesSearch = (e.description || '').toLowerCase().includes(search.toLowerCase()) || 
                                  (e.recorded_by || '').toLowerCase().includes(search.toLowerCase())
            return matchesDate && matchesCat && matchesSearch
        })
    }, [expenses, search, filterCategory, timeframe, customDates, todayStr, now])

    const totalFiltered = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.amount || form.amount <= 0) {
            toast('Please fill all required fields properly', 'warning')
            return
        }

        setSaving(true)
        try {
            const data = { ...form, recorded_by: user?.fullName || 'Admin' };
            if (editingId) {
                await expensesService.update(editingId, data)
                toast('Expense updated successfully', 'success')
            } else {
                await expensesService.create(data)
                toast('Expense recorded successfully', 'success')
            }
            setModalOpen(false)
            setEditingId(null)
            setForm({ date: new Date().toISOString().split('T')[0], category: 'Supplies', description: '', amount: '' })
            loadData()
        } catch (err) {
            toast('Failed to save expense. Please try again.', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (e, id) => {
        e.stopPropagation()
        if (!window.confirm('Are you sure you want to delete this expense record?')) return
        setLoading(true)
        try {
            await expensesService.delete(id)
            toast('Expense deleted', 'success')
            loadData()
        } catch (err) {
            toast('Failed to delete expense', 'error')
            setLoading(false)
        }
    }


    const openCreateModal = () => {
        setEditingId(null)
        setForm({ date: new Date().toISOString().split('T')[0], category: 'Supplies', description: '', amount: '' })
        setModalOpen(true)
    }

    return (
        <div className="expenses-page">
            {/* Header */}
            <div className="expenses-header">
                <div className="expenses-title-group">
                    <span className="expenses-title-icon"><ReceiptText size={23} /></span>
                    <div>
                        <h2>Expense Management</h2>
                        <p>Monitor spending and keep every business cost organized.</p>
                    </div>
                </div>
                <button className="expenses-add-button" onClick={openCreateModal}>
                    <span><Plus size={17} /></span> Record Expense
                </button>
            </div>

            {/* Metrics */}
            <div className="expenses-metrics">
                <div className="expense-metric-card expense-metric-today">
                    <div className="expense-metric-icon">
                        <Wallet size={20} />
                    </div>
                    <div className="expense-metric-copy">
                        <span>Today's expenses</span>
                        <strong>{fmt(todayTotal)}</strong>
                        <small>{expenses.filter(e => e.date === todayStr).length} transactions today</small>
                    </div>
                </div>
                <div className="expense-metric-card expense-metric-month">
                    <div className="expense-metric-icon">
                        <Clock size={20} />
                    </div>
                    <div className="expense-metric-copy">
                        <span>This month</span>
                        <strong>{fmt(monthTotal)}</strong>
                        <small>{now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</small>
                    </div>
                </div>
                <div className="expense-metric-card expense-metric-filtered">
                    <div className="expense-metric-icon">
                        <TrendingDown size={20} />
                    </div>
                    <div className="expense-metric-copy">
                        <span>Filtered total</span>
                        <strong>{fmt(totalFiltered)}</strong>
                        <small>{filtered.length} matching records</small>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="expenses-panel">
                <div className="expenses-toolbar">
                    <div className={`expenses-search ${search ? 'has-value' : ''}`}>
                        <Search size={17} />
                        <input 
                            placeholder="Search descriptions or recorders..." 
                            value={search} onChange={e => setSearch(e.target.value)}
                        />
                        {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
                    </div>
                    <div className="expenses-category-filter">
                        <Filter size={15} />
                        <select 
                            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="All">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Timeframe selector */}
                <div className="expenses-period-row">
                    <div className="expenses-period-tabs">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: 'This Week' },
                            { id: 'month', label: 'This Month' },
                            { id: 'custom', label: 'Custom Range' },
                            { id: 'all', label: 'All Time' }
                        ].map(t => (
                            <button 
                                key={t.id} 
                                className={timeframe === t.id ? 'active' : ''}
                                onClick={() => setTimeframe(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {timeframe === 'custom' && (
                        <ExpenseDateRangePicker value={customDates} onChange={setCustomDates} />
                    )}
                </div>

                {loading ? (
                    <div className="loading" style={{ padding: 60 }}><div className="spinner" /></div>
                ) : filtered.length === 0 ? (
                    <div className="expenses-empty-state">
                        <span className="expenses-empty-icon"><ReceiptText size={30} /></span>
                        <h3>No expenses found</h3>
                        <p>No records match the filters you selected.</p>
                        <button type="button" onClick={() => { setSearch(''); setFilterCategory('All'); setTimeframe('month') }}>Reset filters</button>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--cream-50)', borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>DATE</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CATEGORY</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>DESCRIPTION</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>RECORDED BY</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>AMOUNT</th>
                                    <th style={{ width: 60 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e) => (
                                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--cream-100)' }}>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {fmtDate(e.date)}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--brown-100)', color: 'var(--brown-700)', padding: '4px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Tag size={10} /> {e.category}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>{e.description}</td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.recorded_by}</td>
                                        <td style={{ padding: '14px 16px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--danger)', textAlign: 'right' }}>
                                            {fmt(e.amount)}
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                <button 
                                                    title="Delete"
                                                    onClick={(ev) => handleDelete(ev, e.id)}
                                                    style={{ border: 'none', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--danger)', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'var(--cream-100)' }}>
                                    <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>TOTAL</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: '1.05rem', color: 'var(--danger)', textAlign: 'right' }}>
                                        {fmt(totalFiltered)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Record Expense Modal */}
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Record New Expense">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Date</label>
                            <input className="input" type="date" required
                                value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Category</label>
                            <select className="input" required
                                value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Description <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>(Optional)</span></label>
                        <input className="input" type="text" placeholder="e.g. Bought cleaning supplies"
                            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label>Amount (₱)</label>
                        <input className="input" type="number" required min="0.01" step="0.01" placeholder="0.00"
                            value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <button type="button" className="btn btn-secondary btn-block" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Expense'}
                        </button>
                    </div>
                </form>
            </Modal>

        </div>
    )
}
