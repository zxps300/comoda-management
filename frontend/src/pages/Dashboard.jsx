import { useEffect, useState, useRef, useCallback } from 'react'
import {
    PhilippinePeso, CookingPot, OctagonAlert, UtensilsCrossed,
    TrendingUp, TrendingDown, RefreshCw, Trophy, TriangleAlert,
} from 'lucide-react'
import { dashboardService } from '../services/dashboard.service'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/* ── Donut Pie Chart ──────────────────────────────────────────────── */
const PIE_COLORS = [
    '#918464', // khaki gold
    '#c0956a', // warm amber
    '#6b9e8a', // sage green
    '#9e6b8a', // mauve
    '#6b8a9e', // steel blue
]

function DonutChart({ items, isCurrency = false, unit = "sold", totalLabel = "total sold", customCenterValue = null, customCenterLabel = null }) {
    const [hovered, setHovered] = useState(null)
    const ref = useRef(null)

    if (!items || items.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No sales data yet
            </div>
        )
    }

    const total = items.reduce((s, i) => s + i.qty, 0)
    const size = 220
    const cx = size / 2
    const cy = size / 2
    const R = 85
    const r = 52

    const segments = items.map((item, idx) => {
        const frac = item.qty / total
        const precedingQty = items.slice(0, idx).reduce((sum, entry) => sum + entry.qty, 0)
        const startAngle = -Math.PI / 2 + (precedingQty / total) * 2 * Math.PI
        const endAngle = startAngle + (frac >= 1 ? 0.9999 : frac) * 2 * Math.PI

        const x1 = cx + R * Math.cos(startAngle)
        const y1 = cy + R * Math.sin(startAngle)
        const x2 = cx + R * Math.cos(endAngle)
        const y2 = cy + R * Math.sin(endAngle)
        const ix1 = cx + r * Math.cos(endAngle)
        const iy1 = cy + r * Math.sin(endAngle)
        const ix2 = cx + r * Math.cos(startAngle)
        const iy2 = cy + r * Math.sin(startAngle)
        const large = frac > 0.5 ? 1 : 0

        const midAngle = startAngle + (endAngle - startAngle) / 2

        return { item, idx, frac, x1, y1, x2, y2, ix1, iy1, ix2, iy2, large, midAngle }
    })

    const hoveredItem = hovered !== null ? items[hovered] : null

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <svg ref={ref} width={size} height={size} style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))' }}>
                    <circle cx={cx} cy={cy} r={R} fill="#f0e9d8" />
                    {segments.map(({ item, idx, frac, x1, y1, x2, y2, ix1, iy1, ix2, iy2, large, midAngle }) => {
                        const isHov = hovered === idx
                        const offset = isHov ? 8 : 0
                        const ox = offset * Math.cos(midAngle)
                        const oy = offset * Math.sin(midAngle)
                        const color = item.color || PIE_COLORS[idx % PIE_COLORS.length]
                        return (
                            <g key={item.name} style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                                transform={`translate(${ox}, ${oy})`}
                                onMouseEnter={() => setHovered(idx)} onMouseLeave={() => setHovered(null)}>
                                <path
                                    d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`}
                                    fill={color} opacity={hovered === null || isHov ? 1 : 0.65}
                                    stroke="#fff" strokeWidth={2} style={{ transition: 'opacity 0.2s ease' }} />
                                {frac > 0.12 && (
                                    <text x={cx + (r + (R - r) / 2) * Math.cos(midAngle)}
                                        y={cy + (r + (R - r) / 2) * Math.sin(midAngle)}
                                        textAnchor="middle" dominantBaseline="middle"
                                        fill="#fff" fontSize={11} fontWeight={700} style={{ pointerEvents: 'none' }}>
                                        {Math.round(frac * 100)}%
                                    </text>
                                )}
                            </g>
                        )
                    })}
                    <circle cx={cx} cy={cy} r={r - 2} fill="#fff" />
                    {hoveredItem ? (
                        <>
                            <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--text-primary)" fontSize={isCurrency ? 11 : 13} fontWeight={700}>{isCurrency ? fmt(hoveredItem.qty) : hoveredItem.qty}</text>
                            <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>{unit}</text>
                            <foreignObject x={cx - 40} y={cy + 16} width={80} height={24}>
                                <div xmlns="http://www.w3.org/1999/xhtml" style={{ fontSize: 8, textAlign: 'center', color: '#6b6147', fontWeight: 600, lineHeight: '12px', wordBreak: 'break-word' }}>
                                    {hoveredItem.name}
                                </div>
                            </foreignObject>
                        </>
                    ) : (
                        <>
                            <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-primary)" fontSize={isCurrency ? 13 : 22} fontWeight={800}>
                                {customCenterValue !== null ? (isCurrency ? fmt(customCenterValue) : customCenterValue) : (isCurrency ? fmt(total) : total)}
                            </text>
                            <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
                                {customCenterLabel || totalLabel}
                            </text>
                        </>
                    )}
                </svg>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
                {items.map((item, idx) => {
                    const pct = Math.round((item.qty / total) * 100)
                    const color = item.color || PIE_COLORS[idx % PIE_COLORS.length]
                    const isHov = hovered === idx
                    return (
                        <div key={item.name} onMouseEnter={() => setHovered(idx)} onMouseLeave={() => setHovered(null)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: isHov ? '#f5f0e8' : 'transparent', transition: 'background 0.15s ease' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: isHov ? `0 0 0 3px ${color}40` : 'none', transition: 'box-shadow 0.15s ease' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                <div style={{ height: 4, background: '#e8e0c8', borderRadius: 4, marginTop: 3 }}>
                                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{isCurrency ? fmt(item.qty) : item.qty}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{pct}%</div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Dashboard Page ───────────────────────────────────────────────── */
export default function Dashboard() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadData = useCallback(() => {
        setLoading(true)
        setError(null)
        dashboardService.get()
            .then((d) => { setData(d); setError(null) })
            .catch((err) => {
                console.error('Dashboard load error:', err)
                const proxyPayload = typeof err.response?.data === 'string'
                    ? err.response.data
                    : err.response?.data?.message || ''
                const looksLikeBackendDown = err.code === 'ERR_NETWORK'
                    || (err.response?.status === 500 && (!proxyPayload || /proxy error|econnrefused|connect/i.test(proxyPayload)))
                const msg = looksLikeBackendDown
                    ? 'Backend server is not running. Start it with: php artisan serve'
                    : err.response?.data?.message
                    || err.message
                    || 'Failed to load dashboard'
                setError(msg)
            })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadData() }, [loadData])

    if (loading) return <div className="loading"><div className="spinner" /></div>

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ textAlign: 'center', maxWidth: 420 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Unable to load dashboard
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.6 }}>
                        {error}
                    </p>
                    <button className="btn btn-primary" onClick={loadData} style={{ gap: 8 }}>
                        <RefreshCw size={16} /> Try Again
                    </button>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.75rem', marginTop: 16 }}>
                        Make sure the backend is running:<br />
                        <code style={{ background: 'var(--cream-200)', padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem' }}>
                            php artisan serve
                        </code>
                    </p>
                </div>
            </div>
        )
    }

    if (!data) return null

    const maxBar = Math.max(...(data.weeklyData || []).map((d) => d.total), 1)

    return (
        <div className="dashboard-page">
            {/* Stat Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon brown"><PhilippinePeso /></div>
                    <div className="stat-info">
                        <div className="stat-label">Today's Revenue</div>
                        <div className="stat-value">{fmt(data.todayRevenue)}</div>
                        <div className="stat-sub" style={{ color: 'var(--text-muted)' }}>
                            Paid sales today
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"><CookingPot /></div>
                    <div className="stat-info">
                        <div className="stat-label">Active Orders</div>
                        <div className="stat-value">{data.activeOrders}</div>
                        <div className="stat-sub">Pending / Preparing</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange"><OctagonAlert /></div>
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
                        <div className="stat-sub">Active available dishes</div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="dashboard-content-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginTop: 12 }}>

                {/* LEFT COLUMN */}
                <div className="dashboard-main-column" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Weekly Sales Chart */}
                    <div className="dashboard-panel dashboard-weekly-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Weekly Sales</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt(data.weeklyTotal)} · {data.weeklyTransactions} paid transactions</div>
                            </div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--brown-100)', color: 'var(--brown-600)' }}>This Week</div>
                        </div>

                        {/* Bar Chart */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 2px' }}>
                            {(data.weeklyData || []).map((d) => {
                                const pct = Math.max((d.total / maxBar) * 100, 4)
                                return (
                                    <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {d.total > 0 ? fmt(d.total).replace('₱', '') : ''}
                                        </div>
                                        <div style={{
                                            width: '100%', height: `${pct}%`,
                                            background: d.total > 0 ? 'linear-gradient(to top, var(--brown-700), var(--brown-400))' : 'var(--cream-300)',
                                            borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease', minHeight: 4
                                        }} />
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d.day}</div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Monthly Comparison */}
                        <div className="dashboard-month-compare" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                            <div className="dashboard-month-card current" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, var(--brown-100), var(--cream-100))', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--brown-400)' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>This Month (Paid)</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brown-700)' }}>{fmt(data.thisMonthTotal)}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{data.thisMonthTransactions} transactions</div>
                            </div>
                            <div className="dashboard-month-card previous" style={{ padding: '8px 12px', background: 'var(--cream-50)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--cream-400)' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Last Month (Paid)</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{fmt(data.lastMonthTotal)}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{data.lastMonthTransactions} transactions</div>
                            </div>
                        </div>
                    </div>

                    {/* Cash Flow & Net Income Breakdown */}
                    <div className="dashboard-panel dashboard-cash-card" style={{ background: 'linear-gradient(135deg, #fffdf8, #fefcf3)', border: '1px solid #e8dfc8', borderRadius: 'var(--radius-lg)', padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'radial-gradient(circle, rgba(192,149,106,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Monthly Cash Flow &amp; Net Income</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Net Income = Total Revenue (Paid) − Total Expenses</div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #8a7855, #6b6147)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.05em' }}>LIVE</div>
                        </div>

                        {/* Financial metric summary boxes */}
                        <div className="dashboard-financial-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                            <div className="dashboard-financial-metric revenue" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>TOTAL REVENUE</div>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#16a34a' }}>{fmt(data.thisMonthTotal || 0)}</div>
                            </div>
                            <div className="dashboard-financial-metric expenses" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>TOTAL EXPENSES</div>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#dc2626' }}>{fmt(data.thisMonthExpenses || 0)}</div>
                            </div>
                            <div className="dashboard-financial-metric income" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>NET INCOME</div>
                                <div style={{
                                    fontWeight: 800, fontSize: '0.95rem',
                                    color: (data.thisMonthNetIncome ?? ((data.thisMonthTotal || 0) - (data.thisMonthExpenses || 0))) >= 0 ? '#16a34a' : '#dc2626'
                                }}>
                                    {fmt(data.thisMonthNetIncome ?? ((data.thisMonthTotal || 0) - (data.thisMonthExpenses || 0)))}
                                </div>
                            </div>
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <DonutChart
                                items={[
                                    { name: 'Revenue (Paid)', qty: data.thisMonthTotal || 0, color: '#16a34a' },
                                    { name: 'Expenses', qty: data.thisMonthExpenses || 0, color: '#dc2626' }
                                ]}
                                isCurrency={true}
                                unit="amount"
                                customCenterValue={data.thisMonthNetIncome ?? ((data.thisMonthTotal || 0) - (data.thisMonthExpenses || 0))}
                                customCenterLabel="Net Income"
                                totalLabel="Net Income"
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="dashboard-side-column" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Top Items */}
                    <div className="dashboard-panel dashboard-top-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', flex: 1 }}>
                        <div className="dashboard-panel-title"><span><Trophy size={17} /></span> Top Items This Month</div>
                        {data.topItems?.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No sales yet this month</div>
                        ) : (
                            <div className="top-items-chart" aria-label="Top selling menu items bar chart">
                                <div className="top-items-chart-grid" aria-hidden="true">
                                    <i /><i /><i /><i />
                                </div>
                                {(data.topItems || []).map((item, i) => (
                                    <div key={item.name} className={`top-items-chart-row rank-${i + 1}`}>
                                        <div className="top-items-chart-label">
                                            <span className="top-items-rank">{i + 1}</span>
                                            <span title={item.name}>{item.name}</span>
                                        </div>
                                        <div className="top-items-chart-value">{item.qty}<small> sold</small></div>
                                        <div className="top-items-chart-track">
                                            <div
                                                className="top-items-chart-bar"
                                                style={{ width: `${(item.qty / (data.topItems[0]?.qty || 1)) * 100}%` }}
                                                title={`${item.name}: ${item.qty} sold`}
                                            >
                                                <span />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="top-items-chart-axis" aria-hidden="true">
                                    <span>0</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Low Stock / All Good */}
                    {data.lowStockItems?.length > 0 ? (
                        <div className="dashboard-stock-card warning" style={{ background: 'linear-gradient(135deg, #fffbf0, #fff8e6)', borderTop: '1px solid #f5c842', borderRight: '1px solid #f5c842', borderBottom: '1px solid #f5c842', borderLeft: '4px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                            <div className="dashboard-panel-title warning"><span><TriangleAlert size={17} /></span> Low Stock Alerts</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {data.lowStockItems.slice(0, 5).map((i) => (
                                    <div key={i.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '4px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: 6 }}>
                                        <span style={{ fontWeight: 500 }}>{i.name}</span>
                                        <span style={{ color: i.quantity === 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 800, fontSize: '0.75rem', background: i.quantity === 0 ? 'rgba(220,38,38,0.1)' : 'rgba(245,200,66,0.2)', padding: '2px 8px', borderRadius: 20 }}>{i.quantity} {i.unit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: 'linear-gradient(135deg, #f0faf4, #e8f5ee)', border: '1px solid #a5d6b7', borderRadius: 'var(--radius-lg)', padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>✅</div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2e7d32' }}>Stock Levels OK</div>
                            <div style={{ fontSize: '0.72rem', color: '#4caf50', marginTop: 2 }}>All items are well stocked</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
