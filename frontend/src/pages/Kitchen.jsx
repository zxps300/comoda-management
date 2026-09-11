import { useEffect, useState, useCallback, useMemo } from 'react'
import { ordersService } from '../services/orders.service'
import { useToastContext } from '../contexts/ToastContext'
import { StatusBadge } from '../components/ui/Badge'
import { ChefHat, RefreshCw, CalendarDays, CheckCircle2, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const STATUS_FLOW = { Pending: 'Preparing', Preparing: 'Ready', Ready: 'Completed' }
const STATUS_LABEL = { Pending: 'Start Cooking', Preparing: 'Mark Ready', Ready: 'Mark Served' }

const formatDateTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export default function Kitchen() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('active')
    const [showSummary, setShowSummary] = useState(true)
    const [stats, setStats] = useState(null)
    const [dateRange, setDateRange] = useState({ from: '', to: '' })
    const [rangeLoading, setRangeLoading] = useState(false)
    const [lastSearchedRange, setLastSearchedRange] = useState(null)

    const itemSummary = useMemo(() => {
        const counts = {}
        orders.filter(o => ['Pending', 'Preparing'].includes(o.status)).forEach(o => {
            (o.items || []).forEach(i => {
                counts[i.name] = (counts[i.name] || 0) + i.quantity
            })
        })
        return Object.entries(counts).sort((a, b) => b[1] - a[1])
    }, [orders])

    const loadOrders = useCallback((isBackground = false) => {
        if (!isBackground) setLoading(true)
        ordersService.getAll({ status: 'Pending,Preparing,Ready' })
            .then(setOrders)
            .catch(() => { if (!isBackground) toast('Failed to load orders', 'error') })
            .finally(() => { if (!isBackground) setLoading(false) })
    }, [toast])

    const loadStats = useCallback((rangeParams = null) => {
        const params = rangeParams || lastSearchedRange || {}
        ordersService.getKitchenStats(params)
            .then(setStats)
            .catch(() => { })
    }, [lastSearchedRange])

    const searchRange = () => {
        if (!dateRange.from || !dateRange.to) return
        setRangeLoading(true)
        const params = { from: dateRange.from, to: dateRange.to }
        setLastSearchedRange(params)
        ordersService.getKitchenStats(params)
            .then(d => {
                setStats(d);
                setRangeLoading(false);
                setFilter('completed');
            })
            .catch(() => setRangeLoading(false))
    }

    // Initial load
    useEffect(() => {
        loadOrders(false)
        loadStats()
    }, [loadOrders, loadStats])

    // Background polling: pause when user is viewing 'completed' tab to prevent constant refreshes
    useEffect(() => {
        const t = setInterval(() => {
            if (filter === 'completed') return
            loadOrders(true)
            loadStats()
        }, 5000)
        return () => clearInterval(t)
    }, [filter, loadOrders, loadStats])

    useEffect(() => {
        if (user?.role === 'Waiter') {
            const readyCount = orders.filter(o => o.status === 'Ready').length
            document.title = readyCount > 0 ? `(${readyCount}) Ready Orders` : 'Waiter Dashboard'
        }
        return () => { document.title = 'Comoda Management' }
    }, [orders, user?.role])

    const advance = async (order) => {
        const next = STATUS_FLOW[order.status]
        if (!next) return
        try {
            const result = await ordersService.updateStatus(order.id, next)
            toast(`Order #${order.id} → ${next}`, 'success')

            // Show stock deduction feedback when cooking starts
            if (next === 'Preparing' && result) {
                if (result.stock_deductions?.length > 0) {
                    toast(`📦 Stock deducted: ${result.stock_deductions.join(', ')}`, 'info')
                }
                if (result.stock_warnings?.length > 0) {
                    result.stock_warnings.forEach(w => toast(`⚠️ ${w}`, 'warning'))
                }
                if (result.unavailable_items?.length > 0) {
                    toast(`🚫 Now unavailable: ${result.unavailable_items.join(', ')}`, 'warning')
                }
            }

            loadOrders()
        } catch { toast('Error updating order', 'error') }
    }

    const statusClass = { Pending: 'pending', Preparing: 'preparing', Ready: 'ready' }

    const visible = filter === 'completed'
        ? (stats?.range_orders || [])
        : orders.filter((o) => {
            if (filter === 'active') {
                let activeStatuses = ['Pending', 'Preparing', 'Ready'];
                if (user?.role === 'Admin') activeStatuses = ['Preparing', 'Ready'];
                if (user?.role === 'Waiter') activeStatuses = ['Ready'];
                // Purchaser sees all active (Pending, Preparing, Ready) — same as Kitchen Staff
                return activeStatuses.includes(o.status);
            }
            if (filter === 'pending') return o.status === 'Pending'
            if (filter === 'preparing') return o.status === 'Preparing'
            if (filter === 'ready') return o.status === 'Ready'
            return true
        })

    return (
        <div className="kitchen-page">

            <div className="page-header kitchen-page-actions">
                <div></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {user?.role !== 'Waiter' && itemSummary.length > 0 && (
                        <button className="btn btn-secondary" onClick={() => setShowSummary(!showSummary)}>
                            {showSummary ? 'Hide Summary' : 'Show Summary'}
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={loadOrders}><RefreshCw size={15} /> Refresh</button>
                </div>
            </div>

            {showSummary && user?.role !== 'Waiter' && itemSummary.length > 0 && (
                <div className="card" style={{ marginBottom: 20, background: 'var(--cream-50)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '16px 20px', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brown-700)' }}>
                            <ChefHat size={18} color="var(--primary)" /> Total Preparation Summary
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aggregated counts for all active orders</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {itemSummary.map(([name, qty]) => (
                            <div key={name} style={{ background: '#fff', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-sm)' }}>
                                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>{qty}×</span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="filter-tabs">
                {[['active', user?.role === 'Waiter' ? 'Ready to Serve' : 'Active'], ['pending', 'Pending'], ['preparing', 'Preparing'], ['ready', 'Ready'], ['completed', 'Completed']]
                    .filter(([v]) => {
                        if (user?.role === 'Admin' && v === 'pending') return false;
                        if (user?.role === 'Waiter' && ['pending', 'preparing', 'ready'].includes(v)) return false;
                        if (user?.role === 'Purchaser' && ['pending', 'preparing', 'ready'].includes(v)) return false;
                        return true;
                    })
                    .map(([v, l]) => (
                        <button key={v} className={`filter-tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>
                            {l}
                            <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.8 }}>
                                ({v === 'completed' ? (stats?.range_orders?.length || 0) : orders.filter((o) => {
                                    if (v === 'active') {
                                        let activeStatuses = ['Pending', 'Preparing', 'Ready'];
                                        if (user?.role === 'Admin') activeStatuses = ['Preparing', 'Ready'];
                                        if (user?.role === 'Waiter') activeStatuses = ['Ready'];
                                        return activeStatuses.includes(o.status);
                                    }
                                    return o.status === l;
                                }).length})
                            </span>
                        </button>
                    ))}
            </div>

            {filter === 'completed' && (
                <div className="card" style={{ marginBottom: 20, background: 'var(--cream-50)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '18px 22px', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'var(--success-bg)', padding: 8, borderRadius: '50%', display: 'flex', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
                                <CheckCircle2 size={20} color='var(--success)' />
                            </div>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                                    {stats?.range ?? 0} Orders Served
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total completed orders in selected range</div>
                            </div>
                        </div>
                        {stats?.range_from && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>Selected Period</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{stats.range_from} — {stats.range_to}</div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--cream-100)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff' }}>
                            <div onClick={(e) => e.currentTarget.querySelector('input').showPicker()} style={{ position: 'relative', background: '#fff', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', minWidth: 140, fontSize: '0.82rem' }}>
                                <CalendarDays size={15} color="var(--primary)" />
                                <span>{dateRange.from ? new Date(dateRange.from).toLocaleDateString() : 'START DATE'}</span>
                                <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
                            </div>
                            <div style={{ width: 1, background: 'var(--border)' }} />
                            <div onClick={(e) => e.currentTarget.querySelector('input').showPicker()} style={{ position: 'relative', background: '#fff', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', minWidth: 140, fontSize: '0.82rem' }}>
                                <CalendarDays size={15} color="var(--primary)" />
                                <span>{dateRange.to ? new Date(dateRange.to).toLocaleDateString() : 'END DATE'}</span>
                                <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
                            </div>
                        </div>
                        <button onClick={searchRange} disabled={rangeLoading || !dateRange.from || !dateRange.to}
                            style={{ padding: '8px 22px', borderRadius: 6, border: 'none', background: '#d4a853', color: 'var(--cream-50)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: (!dateRange.from || !dateRange.to) ? 0.6 : 1, boxShadow: '0 2px 8px rgba(212,168,83,0.25)' }}>
                            {rangeLoading ? '...' : 'Update List'}
                        </button>
                    </div>
                </div>
            )}

            {loading && orders.length === 0 ? (
                <div className="loading"><div className="spinner" /></div>
            ) : user?.role === 'Admin' ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>id</th>
                                <th>Table</th>
                                <th>Items</th>
                                <th>Status</th>
                                <th>Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((order) => (
                                <tr key={order.id}>
                                    <td>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--brown-800)', background: 'var(--cream-200)', padding: '2px 6px', borderRadius: 6 }}>
                                            #{order.dailyNumber || order.id}
                                        </span>
                                    </td>
                                    <td>
                                        <strong>
                                            {order.orderType === 'Take Out'
                                                ? `🛍 Take Out #${order.takeOutNumber}`
                                                : `Table ${order.tableNumber}`}
                                        </strong>
                                        <span style={{ marginLeft: 6, fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: order.orderType === 'Take Out' ? 'rgba(249,115,22,0.12)' : 'rgba(20,184,166,0.12)', color: order.orderType === 'Take Out' ? '#f97316' : '#0d9488', border: order.orderType === 'Take Out' ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(20,184,166,0.3)' }}>
                                            {order.orderType === 'Take Out' ? 'Take Out' : 'Dine In'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            {(order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <StatusBadge status={order.status} />
                                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', border: '1px solid currentColor', borderRadius: 4, opacity: 0.8 }}>
                                                {order.isPaid ? 'PAID' : 'DELAYED'}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brown-600)' }}>
                                            {formatDateTime(order.createdAt)}
                                        </div>
                                    </td>
                                    <td>
                                        {STATUS_FLOW[order.status] && (order.status === 'Ready' ? user?.role === 'Waiter' : (user?.role !== 'Waiter' && user?.role !== 'Purchaser')) && (
                                            <button className="btn btn-primary btn-sm" onClick={() => advance(order)}>
                                                {STATUS_LABEL[order.status]}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="kitchen-grid">
                    {visible.map((order) => (
                        <div className={`kitchen-card ${statusClass[order.status] || ''}`} key={order.id}>
                            <div className="kitchen-card-header">
                                <div>
                                    <strong style={{ fontSize: '1rem' }}>
                                        {order.orderType === 'Take Out'
                                            ? `🛍️ Take Out #${order.takeOutNumber}`
                                            : `🍽️ Table ${order.tableNumber}`}
                                    </strong>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--brown-800)', background: 'var(--cream-200)', padding: '2px 8px', borderRadius: 6 }}>
                                            #{order.dailyNumber || order.id}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brown-600)' }}>
                                            {formatDateTime(order.createdAt)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: order.orderType === 'Take Out' ? 'rgba(249,115,22,0.15)' : 'rgba(20,184,166,0.15)', color: order.orderType === 'Take Out' ? '#f97316' : '#0d9488', border: order.orderType === 'Take Out' ? '1px solid rgba(249,115,22,0.35)' : '1px solid rgba(20,184,166,0.35)' }}>
                                        {order.orderType === 'Take Out' ? '🛍 Take Out' : '🍽 Dine In'}
                                    </span>
                                    <StatusBadge status={order.status} />
                                    {order.isPaid ? (
                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 10, fontWeight: 700 }}>PAID</span>
                                    ) : (
                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)', borderRadius: 10, fontWeight: 700 }}>PAY LATER</span>
                                    )}
                                </div>
                            </div>
                            <div className="kitchen-card-body">
                                {(order.items || []).map((item, i) => (
                                    <div className="kitchen-item-row" key={i}>
                                        <span className="kitchen-qty">×{item.quantity}</span>
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                                {order.notes && (
                                    <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        Note: {order.notes}
                                    </div>
                                )}
                            </div>
                            {STATUS_FLOW[order.status] && (order.status === 'Ready' ? user?.role === 'Waiter' : (user?.role !== 'Waiter' && user?.role !== 'Purchaser')) && (
                                <div className="kitchen-card-footer">
                                    <button className="btn btn-primary btn-sm btn-block" onClick={() => advance(order)}>
                                        {STATUS_LABEL[order.status]}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
