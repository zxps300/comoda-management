import { useEffect, useState } from 'react'
import { reportsService } from '../services/reports.service'
import { inventoryService } from '../services/inventory.service'
import { useToastContext } from '../contexts/ToastContext'
import { BarChart3, Eye, ExternalLink, Image as ImageIcon, X } from 'lucide-react'
import Modal from '../components/ui/Modal'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })

export default function Reports() {
    const toast = useToastContext()
    const [tab, setTab] = useState('daily')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
    const [data, setData] = useState(null)
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [viewingReceipt, setViewingReceipt] = useState(null)

    const load = () => {
        setLoading(true)
        setData(null)
        
        if (tab === 'purchase_logs') {
            inventoryService.getLogs()
                .then(setLogs)
                .catch(() => toast('Failed to load purchase logs', 'error'))
                .finally(() => setLoading(false))
            return
        }

        const p = tab === 'daily' ? reportsService.daily(date)
            : tab === 'monthly' ? reportsService.monthly(month)
                : reportsService.inventory()
        p.then(setData)
            .catch(() => toast('Failed to load report', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(load, [tab])

    return (
        <div>
            <div className="page-header">
                <div><h2>Reports & Analytics</h2><p>Business performance and audit logs</p></div>
            </div>

            <div className="filter-tabs">
                {[
                    ['daily', 'Daily'], 
                    ['monthly', 'Monthly'], 
                    ['inventory', 'Inventory'],
                    ['purchase_logs', 'Purchase Logs']
                ].map(([v, l]) => (
                    <button key={v} className={`filter-tab ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</button>
                ))}
            </div>

            {/* Date pickers */}
            {tab === 'daily' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                    <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
                    <button className="btn btn-primary" onClick={load}>Generate</button>
                </div>
            )}
            {tab === 'monthly' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                    <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }} />
                    <button className="btn btn-primary" onClick={load}>Generate</button>
                </div>
            )}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : !data ? null : (

                <>
                    {/* DAILY REPORT */}
                    {tab === 'daily' && (
                        <>
                            <div className="stats-grid">
                                {[
                                    { label: 'Total Revenue', value: fmt(data.totalRevenue) },
                                    { label: 'Transactions', value: data.transactionCount },
                                    { label: 'Avg / Transaction', value: fmt(data.avgPerTransaction) },
                                    { label: 'Items Sold', value: data.itemsSold },
                                ].map((s) => (
                                    <div key={s.label} className="stat-card">
                                        <div className="stat-icon brown"><BarChart3 /></div>
                                        <div className="stat-info">
                                            <div className="stat-label">{s.label}</div>
                                            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{s.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="dashboard-grid">
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>Transactions</div>
                                    <div className="table-wrapper">
                                        <table>
                                            <thead><tr><th>#</th><th>Time</th><th>Items</th><th>Total</th><th>Payment Status</th><th>Cashier</th></tr></thead>
                                            <tbody>
                                                {data.transactions?.length === 0 ? (
                                                    <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 20 }}>No transactions</td></tr>
                                                ) : data.transactions?.map((t) => (
                                                    <tr key={t.id}>
                                                        <td className="font-mono">#{t.id}</td>
                                                        <td>{t.time}</td>
                                                        <td>{t.items}</td>
                                                        <td><strong>{fmt(t.total)}</strong></td>
                                                        <td>
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                fontWeight: 700,
                                                                padding: '3px 9px',
                                                                borderRadius: 20,
                                                                background: t.isPaid ? '#dcfce7' : '#fef3c7',
                                                                color: t.isPaid ? '#16a34a' : '#d97706',
                                                                border: t.isPaid ? '1px solid rgba(22, 163, 74, 0.25)' : '1px solid rgba(217, 119, 6, 0.35)',
                                                                whiteSpace: 'nowrap',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 4
                                                            }}>
                                                                {t.isPaid ? '● PAID' : '○ PENDING'}
                                                            </span>
                                                        </td>
                                                        <td>{t.cashier}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>Top Items</div>
                                    <TopItemsList items={data.topItems} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* MONTHLY REPORT */}
                    {tab === 'monthly' && (
                        <>
                            <div className="stats-grid">
                                {[
                                    { label: 'Total Revenue', value: fmt(data.totalRevenue) },
                                    { label: 'Transactions', value: data.transactionCount },
                                    { label: 'Active Days', value: data.activeDays },
                                    { label: 'Daily Average', value: fmt(data.dailyAverage) },
                                ].map((s) => (
                                    <div key={s.label} className="stat-card">
                                        <div className="stat-icon brown"><BarChart3 /></div>
                                        <div className="stat-info">
                                            <div className="stat-label">{s.label}</div>
                                            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{s.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="dashboard-grid">
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>Daily Breakdown</div>
                                    {data.dailyBreakdown?.length === 0 ? <p className="text-muted">No data</p> : (
                                        <div className="table-wrapper">
                                            <table>
                                                <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
                                                <tbody>
                                                    {data.dailyBreakdown?.map((d) => (
                                                        <tr key={d.date}>
                                                            <td>{d.date}</td>
                                                            <td>{d.count}</td>
                                                            <td><strong>{fmt(d.total)}</strong></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>Top Items</div>
                                    <TopItemsList items={data.topItems} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* INVENTORY REPORT */}
                    {tab === 'inventory' && (
                        <>
                            <div className="stats-grid">
                                {[
                                    { label: 'Total Items', value: data.totalItems, color: 'var(--info)' },
                                    { label: 'Well Stocked', value: data.wellStocked, color: 'var(--success)' },
                                    { label: 'Low Stock', value: data.lowStock, color: 'var(--warning)' },
                                    { label: 'Out of Stock', value: data.outOfStock, color: 'var(--danger)' },
                                ].map((s) => (
                                    <div key={s.label} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
                                        <div className="stat-info">
                                            <div className="stat-label">{s.label}</div>
                                            <div className="stat-value" style={{ fontSize: '1.4rem', color: s.color }}>{s.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 16 }}>All Inventory Items</div>
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Min. Stock</th><th>Unit</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {data.items?.map((i) => (
                                                <tr key={i.name}>
                                                    <td><strong>{i.name}</strong></td>
                                                    <td>{i.category}</td>
                                                    <td style={{ color: i.status === 'Out' ? 'var(--danger)' : i.status === 'Low' ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>{i.quantity}</td>
                                                    <td>{i.min_stock}</td>
                                                    <td>{i.unit}</td>
                                                    <td>
                                                        <div className="inv-status">
                                                            <div className={`inv-dot ${i.status.toLowerCase()}`} />
                                                            {i.status}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* PURCHASE LOGS */}
                    {tab === 'purchase_logs' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 16 }}>Inventory Stock Logs</div>
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>User</th><th>Receipt</th></tr></thead>
                                    <tbody>
                                        {logs.length === 0 ? (
                                            <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No logs found</td></tr>
                                        ) : (
                                            logs.map(log => (
                                                <tr key={log.id}>
                                                    <td style={{ fontSize: '0.8rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                                                    <td><strong>{log.item_name}</strong></td>
                                                    <td>
                                                        <span className={`badge ${log.type === 'in' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                                                            {log.type === 'in' ? 'Stock In' : 'Stock Out'}
                                                        </span>
                                                    </td>
                                                    <td>{log.quantity}</td>
                                                    <td>{log.performed_by}</td>
                                                    <td>
                                                        {log.receipt_url ? (
                                                            <button 
                                                                onClick={() => setViewingReceipt(log.receipt_url)}
                                                                className="btn btn-secondary btn-sm"
                                                                style={{ padding: '4px 8px' }}
                                                                title="View Receipt"
                                                            >
                                                                <ImageIcon size={14} style={{ marginRight: 4 }} /> 
                                                                View
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={!!viewingReceipt}
                onClose={() => setViewingReceipt(null)}
                title="Receipt Image"
                maxWidth="600px"
            >
                {viewingReceipt && (
                    <div style={{ textAlign: 'center' }}>
                        <img 
                            src={viewingReceipt} 
                            alt="Receipt" 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '70vh', 
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)'
                            }} 
                        />
                        <div style={{ marginTop: 16 }}>
                            <a href={viewingReceipt} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                <ExternalLink size={14} style={{ marginRight: 6 }} />
                                Open in New Tab
                            </a>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

function TopItemsList({ items = [] }) {
    if (!items.length) return <p className="text-muted" style={{ fontSize: '0.85rem' }}>No data</p>
    const max = items[0]?.qty || 1
    return (
        <div className="top-items-list">
            {items.map((item, i) => (
                <div className="top-item-row" key={item.name}>
                    <div className="top-item-rank">{i + 1}</div>
                    <div className="top-item-bar-wrap">
                        <div className="top-item-name">{item.name}</div>
                        <div className="top-item-bar-bg">
                            <div className="top-item-bar-fill" style={{ width: `${(item.qty / max) * 100}%` }} />
                        </div>
                    </div>
                    <div className="top-item-qty">{item.qty}</div>
                </div>
            ))}
        </div>
    )
}
