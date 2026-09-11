import { useEffect, useState, useCallback, useMemo } from 'react'
import { ordersService } from '../services/orders.service'
import { inventoryService } from '../services/inventory.service'
import { useToastContext } from '../contexts/ToastContext'
import { StatusBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { ChefHat, RefreshCw, Minus, Package } from 'lucide-react'
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

    // Inventory usage state
    const [inventoryItems, setInventoryItems] = useState([])
    const [usageModal, setUsageModal] = useState(false)
    const [usageForm, setUsageForm] = useState({ itemId: '', quantity: 1, reason: '' })
    const [savingUsage, setSavingUsage] = useState(false)
    const [showSummary, setShowSummary] = useState(true)

    const itemSummary = useMemo(() => {
        const counts = {}
        orders.filter(o => ['Pending', 'Preparing'].includes(o.status)).forEach(o => {
            (o.items || []).forEach(i => {
                counts[i.name] = (counts[i.name] || 0) + i.quantity
            })
        })
        return Object.entries(counts).sort((a, b) => b[1] - a[1])
    }, [orders])

    const loadOrders = useCallback(() => {
        setLoading(true)
        ordersService.getAll({ status: 'Pending,Preparing,Ready' })
            .then(setOrders)
            .catch(() => toast('Failed to load orders', 'error'))
            .finally(() => setLoading(false))
    }, [toast])

    const loadInventory = useCallback(() => {
        inventoryService.getAll()
            .then(setInventoryItems)
            .catch(() => toast('Failed to load inventory', 'error'))
    }, [toast])

    useEffect(() => {
        loadOrders()
        loadInventory()
        const t = setInterval(loadOrders, 30000)
        return () => clearInterval(t)
    }, [loadOrders, loadInventory])

    const advance = async (order) => {
        const next = STATUS_FLOW[order.status]
        if (!next) return
        try {
            await ordersService.updateStatus(order.id, next)
            toast(`Order #${order.id} → ${next}`, 'success')
            loadOrders()
        } catch { toast('Error updating order', 'error') }
    }

    const handleReportUsage = async () => {
        if (!usageForm.itemId || usageForm.quantity <= 0) {
            toast('Please select an item and enter a quantity', 'warning')
            return
        }
        setSavingUsage(true)
        try {
            await inventoryService.stockAdjust({
                item_id: Math.floor(usageForm.itemId),
                type: 'out',
                quantity: usageForm.quantity,
                reason: usageForm.reason || 'Kitchen consumption',
                performed_by: user?.fullName || 'Kitchen staff'
            })
            toast('Inventory usage reported correctly', 'success')
            setUsageModal(false)
            setUsageForm({ itemId: '', quantity: 1, reason: '' })
            loadInventory()
        } catch (err) {
            toast(err.response?.data?.message || 'Error reporting usage', 'error')
        } finally {
            setSavingUsage(false)
        }
    }

    const selectedItemData = useMemo(() => 
        inventoryItems.find((i) => i.id === Number(usageForm.itemId)),
    [inventoryItems, usageForm.itemId])

    const statusClass = { Pending: 'pending', Preparing: 'preparing', Ready: 'ready' }

    const visible = orders.filter((o) => {
        if (filter === 'active') return ['Pending', 'Preparing', 'Ready'].includes(o.status)
        if (filter === 'pending') return o.status === 'Pending'
        if (filter === 'preparing') return o.status === 'Preparing'
        if (filter === 'ready') return o.status === 'Ready'
        return true
    })

    return (
        <div>
            <div className="page-header">
                <div><h2>Kitchen Display</h2><p>Live order queue</p></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => setShowSummary(!showSummary)}>
                        {showSummary ? 'Hide Summary' : 'Show Summary'}
                    </button>
                    <button className="btn btn-secondary" onClick={loadOrders}><RefreshCw size={15} /> Refresh</button>
                </div>
            </div>

            {showSummary && itemSummary.length > 0 && (
                <div className="card" style={{ marginBottom: 20, background: 'var(--brown-800)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ChefHat size={18} /> Total Preparation Summary
                        </h3>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Aggregated counts for all active orders</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {itemSummary.map(([name, qty]) => (
                            <div key={name} style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }}>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, marginRight: 8 }}>{qty}x</span>
                                <span style={{ fontSize: '0.9rem' }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="filter-tabs">
                {[['active', 'Active'], ['pending', 'Pending'], ['preparing', 'Preparing'], ['ready', 'Ready']].map(([v, l]) => (
                    <button key={v} className={`filter-tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>
                        {l}
                        <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.8 }}>
                            ({orders.filter((o) => v === 'active' ? ['Pending', 'Preparing', 'Ready'].includes(o.status) : o.status === l).length})
                        </span>
                    </button>
                ))}
            </div>

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
                                    <td style={{ fontSize: '0.85rem' }}>#{order.id}</td>
                                    <td><strong>Table {order.tableNumber}</strong></td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
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
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDateTime(order.createdAt)}</td>
                                    <td>
                                        {STATUS_FLOW[order.status] && (
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
                                    <strong style={{ fontSize: '1rem' }}>Table {order.tableNumber}</strong>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        #{order.id} · {formatDateTime(order.createdAt)}
                                    </div>
                                </div>
                                 <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                            {STATUS_FLOW[order.status] && (
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

            {/* Inventory Usage Modal */}
            <Modal
                isOpen={usageModal}
                onClose={() => setUsageModal(false)}
                title="Report Stock Usage"
                footer={
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setUsageModal(false)}>Cancel</button>
                        <button className="btn btn-warning btn-block" onClick={handleReportUsage} disabled={savingUsage}>
                            {savingUsage ? 'Reporting...' : 'Confirm Usage'}
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '5px 0' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                        Select the item used during preparation (e.g., portions of chicken).
                    </p>
                    
                    <div className="form-group">
                        <label>Inventory Item</label>
                        <select 
                            className="input" 
                            value={usageForm.itemId} 
                            onChange={(e) => setUsageForm({ ...usageForm, itemId: e.target.value })}
                        >
                            <option value="">-- Select Item --</option>
                            {inventoryItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.quantity} {item.unit} available)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Quantity Used</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input 
                                    className="input" 
                                    type="number" 
                                    min="0.1" 
                                    step="0.1"
                                    value={usageForm.quantity} 
                                    onChange={(e) => setUsageForm({ ...usageForm, quantity: parseFloat(e.target.value) || 0 })} 
                                />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {selectedItemData?.unit || ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Reason / Note (Optional)</label>
                        <input 
                            className="input" 
                            placeholder="e.g., Prepared 10 portions of chicken" 
                            value={usageForm.reason} 
                            onChange={(e) => setUsageForm({ ...usageForm, reason: e.target.value })} 
                        />
                    </div>

                    {selectedItemData && (
                        <div style={{ 
                            marginTop: 15, 
                            padding: 12, 
                            background: 'var(--info-bg)', 
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10
                        }}>
                            <Minus size={18} color="var(--info)" />
                            <div style={{ fontSize: '0.8rem', color: 'var(--info)' }}>
                                This will deduct <strong>{usageForm.quantity} {selectedItemData.unit}</strong> from <strong>{selectedItemData.name}</strong>.
                                <br />Remaining: {Number(selectedItemData.quantity - usageForm.quantity).toFixed(2)} {selectedItemData.unit}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}
