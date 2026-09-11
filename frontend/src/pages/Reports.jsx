import { useEffect, useState } from 'react'
import { reportsService } from '../services/reports.service'
import { inventoryService } from '../services/inventory.service'
import { useToastContext } from '../contexts/ToastContext'
import { BarChart3, ExternalLink, Image as ImageIcon, FileBarChart, CalendarDays, Sparkles, Printer } from 'lucide-react'
import Modal from '../components/ui/Modal'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })

export default function Reports() {
    const toast = useToastContext()
    const [tab, setTab] = useState('daily')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
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
                : tab === 'custom' ? reportsService.custom(fromDate, toDate)
                    : tab === 'all' ? reportsService.all()
                        : reportsService.inventory()
        p.then(setData)
            .catch(() => toast('Failed to load report', 'error'))
            .finally(() => setLoading(false))
    }

    const printReport = () => {
        document.body.classList.add('printing-report')
        window.addEventListener('afterprint', () => document.body.classList.remove('printing-report'), { once: true })
        window.print()
    }

    // Date inputs are applied by the report buttons; tab changes load immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [tab])

    return (
        <div className="reports-page">
            <div className="reports-page-header">
                <div className="reports-heading">
                    <span><FileBarChart size={23} /></span>
                    <div>
                        <h2>Business Reports</h2>
                        <p>Turn sales, inventory, and purchasing data into clear decisions.</p>
                    </div>
                </div>
                <div className="reports-header-actions no-print">
                    {data && ['all', 'daily', 'monthly', 'custom'].includes(tab) && (
                        <button type="button" className="btn btn-primary report-print-button" onClick={printReport}>
                            <Printer size={16} /> Print Report
                        </button>
                    )}
                    <div className="reports-live-badge"><Sparkles size={14} /> Live analytics</div>
                </div>
            </div>

            <div className="report-print-heading">
                <h1>Comoda Sales Report</h1>
                <p>{tab === 'monthly' ? month : tab === 'daily' ? date : tab === 'custom' ? `${fromDate} to ${toDate}` : 'All transactions'}</p>
            </div>

            <div className="reports-tab-bar no-print">
                {[ 
                    ['daily', 'Daily'], 
                    ['monthly', 'Monthly'], 
                    ['custom', 'Custom Range'],
                    ['inventory', 'Inventory'],
                    ['purchase_logs', 'Purchase Logs']
                ].map(([v, l]) => (
                    <button key={v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{l}</button>
                ))}
            </div>

            {/* Date pickers */}
            {tab === 'daily' && (
                <div className="report-date-controls no-print">
                    <CalendarDays size={18} />
                    <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    <button className="btn btn-primary" onClick={load}>Generate</button>
                </div>
            )}
            {tab === 'monthly' && (
                <div className="report-date-controls no-print">
                    <CalendarDays size={18} />
                    <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                    <button className="btn btn-primary" onClick={load}>Generate</button>
                </div>
            )}
            {tab === 'custom' && (
                <div className="report-date-controls report-date-range no-print">
                    <CalendarDays size={18} />
                    <span className="text-muted" style={{ fontWeight: 500 }}>From:</span>
                    <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    <span className="text-muted" style={{ fontWeight: 500 }}>To:</span>
                    <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    <button className="btn btn-primary" onClick={load}>Generate</button>
                </div>
            )}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : (
                <>
                    {/* ALL TRANSACTIONS REPORT */}
                    {tab === 'all' && data && (
                        <>
                            <div className="stats-grid">
                                {[
                                    { label: 'Total Revenue', value: fmt(data.totalRevenue) },
                                    { label: 'Total Transactions', value: data.transactionCount },
                                    { label: 'Active Days', value: data.activeDays },
                                    { label: 'Avg / Transaction', value: fmt(data.avgPerTransaction) },
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
                            <div className="dashboard-grid reports-dashboard-grid">
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>All Transactions</div>
                                    <div className="table-wrapper">
                                        <table>
                                            <thead><tr><th>#</th><th>Date</th><th>Time</th><th>Items</th><th>Total</th><th>Payment Status</th><th>Cashier</th></tr></thead>
                                            <tbody>
                                                {data.transactions?.length === 0 ? (
                                                    <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 20 }}>No transactions</td></tr>
                                                ) : data.transactions?.map((t) => (
                                                    <tr key={t.id}>
                                                        <td className="font-mono">#{t.id}</td>
                                                        <td>{t.date}</td>
                                                        <td>{t.time}</td>
                                                        <td>{t.items}</td>
                                                        <td><strong>{fmt(t.total)}</strong></td>
                                                        <td>
                                                            <span className={`report-payment-status ${t.isPaid ? 'paid' : 'pending'}`}>
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
                                    <div className="card-title" style={{ marginBottom: 16 }}>Daily Breakdown</div>
                                    {data.dailyBreakdown?.length === 0 ? <p className="text-muted">No data</p> : (
                                        <div className="table-wrapper">
                                            <table>
                                                <thead><tr><th>Date</th><th>Transactions</th><th>Total</th></tr></thead>
                                                <tbody>
                                                    {data.dailyBreakdown?.map((d) => (
                                                        <tr key={d.date}>
                                                            <td className="font-mono">{d.date}</td>
                                                            <td>{d.count}</td>
                                                            <td><strong>{fmt(d.total)}</strong></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div style={{ marginTop: 16 }}>
                                        <div className="card-title" style={{ marginBottom: 12, fontSize: '0.95rem' }}>Top Items (All Time)</div>
                                        <TopItemsList items={data.topItems} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* DAILY REPORT */}
                    {tab === 'daily' && data && (
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
                                                            <span className={`report-payment-status ${t.isPaid ? 'paid' : 'pending'}`}>
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
                    {tab === 'monthly' && data && (
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
                                                <thead><tr><th>Date</th><th>Transactions</th><th>Total</th></tr></thead>
                                                <tbody>
                                                    {data.dailyBreakdown?.map((d) => (
                                                        <tr key={d.date}>
                                                            <td className="font-mono">{d.date}</td>
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
                            <div className="monthly-sales-groups">
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>Sales by Product</div>
                                    <GroupedSalesTable rows={data.products} nameKey="name" nameLabel="Product" showCategory showUnitPrice />
                                </div>
                                <div className="card">
                                    <div className="card-title" style={{ marginBottom: 16 }}>Sales by Category</div>
                                    <GroupedSalesTable rows={data.categories} nameKey="category" nameLabel="Category" />
                                </div>
                            </div>
                        </>
                    )}

                    {/* CUSTOM REPORT */}
                    {tab === 'custom' && data && (
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
                    {tab === 'inventory' && data && (
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

function GroupedSalesTable({ rows = [], nameKey, nameLabel, showCategory = false, showUnitPrice = false }) {
    if (!rows?.length) return <p className="text-muted" style={{ fontSize: '0.85rem' }}>No sales recorded for this month.</p>

    return (
        <div className="table-wrapper">
            <table>
                <thead>
                    <tr><th>{nameLabel}</th>{showCategory && <th>Category</th>}{showUnitPrice && <th>Unit Price</th>}<th>Quantity</th><th>Sales</th></tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={`${row[nameKey]}-${row.menuItemId || ''}-${row.unitPrice ?? ''}`}>
                            <td><strong>{row[nameKey]}</strong></td>
                            {showCategory && <td>{row.category}</td>}
                            {showUnitPrice && <td>{fmt(row.unitPrice)}</td>}
                            <td>{row.qty}</td>
                            <td><strong>{fmt(row.revenue)}</strong></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
