import { useEffect, useState } from 'react'
import {
    DollarSign, ShoppingBag, AlertTriangle, UtensilsCrossed,
    TrendingUp, TrendingDown,
} from 'lucide-react'
import { dashboardService } from '../services/dashboard.service'
import { useToastContext } from '../contexts/ToastContext'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Dashboard() {
    const toast = useToastContext()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        dashboardService.get()
            .then(setData)
            .catch(() => toast('Failed to load dashboard stats', 'error'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="loading"><div className="spinner" /></div>
    if (!data) return null

    const maxBar = Math.max(...(data.weeklyData || []).map((d) => d.total), 1)

    return (
        <div>
            {/* Stat Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon brown"><DollarSign /></div>
                    <div className="stat-info">
                        <div className="stat-label">Today's Revenue</div>
                        <div className="stat-value">{fmt(data.todayRevenue)}</div>
                        <div className={`stat-sub ${data.monthGrowth >= 0 ? 'up' : 'down'}`}>
                            {data.monthGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(data.monthGrowth)}% vs last month
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"><ShoppingBag /></div>
                    <div className="stat-info">
                        <div className="stat-label">Active Orders</div>
                        <div className="stat-value">{data.activeOrders}</div>
                        <div className="stat-sub">Currently in progress</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange"><AlertTriangle /></div>
                    <div className="stat-info">
                        <div className="stat-label">Low Stock Items</div>
                        <div className="stat-value">{data.lowStockCount}</div>
                        <div className="stat-sub">Need restocking</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><UtensilsCrossed /></div>
                    <div className="stat-info">
                        <div className="stat-label">Menu Items</div>
                        <div className="stat-value">{data.totalMenuItems}</div>
                        <div className="stat-sub">Available dishes</div>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Weekly Chart */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Weekly Sales</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {fmt(data.weeklyTotal)} · {data.weeklyTransactions} transactions
                        </span>
                    </div>
                    <div className="chart-bars" style={{ height: 140 }}>
                        {(data.weeklyData || []).map((d) => (
                            <div className="chart-bar-item" key={d.date}>
                                <div className="chart-bar-value">{d.total > 0 ? fmt(d.total).replace('₱', '') : ''}</div>
                                <div
                                    className="chart-bar-fill"
                                    style={{ height: `${Math.max((d.total / maxBar) * 100, 4)}%` }}
                                />
                                <div className="chart-bar-label">{d.day}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ padding: '12px 16px', background: 'var(--cream-100)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>This Month</div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{fmt(data.thisMonthTotal)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{data.thisMonthTransactions} transactions</div>
                        </div>
                        <div style={{ padding: '12px 16px', background: 'var(--cream-100)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Last Month</div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{fmt(data.lastMonthTotal)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{data.lastMonthTransactions} transactions</div>
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Top Items */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Top Items This Month</span>
                        </div>
                        {data.topItems?.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No sales yet</p>
                        ) : (
                            <div className="top-items-list">
                                {(data.topItems || []).map((item, i) => (
                                    <div className="top-item-row" key={item.name}>
                                        <div className="top-item-rank">{i + 1}</div>
                                        <div className="top-item-bar-wrap">
                                            <div className="top-item-name">{item.name}</div>
                                            <div className="top-item-bar-bg">
                                                <div
                                                    className="top-item-bar-fill"
                                                    style={{ width: `${(item.qty / (data.topItems[0]?.qty || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="top-item-qty">{item.qty}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Low Stock */}
                    {data.lowStockItems?.length > 0 && (
                        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                            <div className="card-header">
                                <span className="card-title">⚠️ Low Stock Alerts</span>
                            </div>
                            {data.lowStockItems.slice(0, 5).map((i) => (
                                <div key={i.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                                    <span>{i.name}</span>
                                    <span style={{ color: i.quantity === 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>
                                        {i.quantity} {i.unit}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Live Kitchen Status */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Live Kitchen Status</span>
                        </div>
                        {data.activeKitchenOrders?.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No orders in kitchen</p>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                <table className="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Items</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.activeKitchenOrders || []).map((order) => (
                                            <tr key={order.id}>
                                                <td style={{ fontSize: '0.75rem' }}>#{order.id}</td>
                                                <td>
                                                    <div style={{ fontSize: '0.75rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {order.items?.map(i => i.name).join(', ')}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${order.status === 'Ready' ? 'success' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
