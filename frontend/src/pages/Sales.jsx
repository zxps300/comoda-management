import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { salesService } from '../services/sales.service'
import { fundRequestService } from '../services/fundRequest.service'
import { expensesService } from '../services/expenses.service'
import { menuService } from '../services/menu.service'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import Modal from '../components/ui/Modal'
import {
    TrendingUp, Banknote, Clock, AlertTriangle, CheckCircle,
    RefreshCw, Search, Calendar, ArrowUpRight, ArrowDownRight,
    Receipt, Eye, ChevronRight, Filter, Trash2, ShoppingBag,
    Hash, Users, BarChart2, Printer, ChevronLeft
} from 'lucide-react'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d) => {
    if (!d) return '—'
    const parsed = new Date(d + 'T00:00:00')
    return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
const fmtRecordDate = (d) => {
    if (!d) return '—'
    const [year, month, day] = d.split('-').map(Number)
    if (!year || !month || !day) return d
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
}
const fmtTime = (t) => t || ''

const escapePrintHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
}[character]))

const summarizeProductSales = (salesList) => {
    const groupedProducts = new Map()

    salesList.forEach(sale => {
        const items = (sale.items || []).length > 0
            ? sale.items
            : [{
                name: 'Item details unavailable',
                quantity: Number(sale.totalQty || 0),
                price: null,
                subtotal: Number(sale.total || 0),
            }]

        items.forEach(item => {
            const productName = item.name || 'Unnamed product'
            const quantitySold = Number(item.quantity || 0)
            const unitPrice = item.price == null ? null : Number(item.price)
            const productKey = productName.trim().toLocaleLowerCase()
            const priceKey = unitPrice === null ? 'unpriced' : unitPrice.toFixed(2)
            const rowKey = `${productKey}::${priceKey}`
            const totalSales = Number(item.subtotal ?? ((unitPrice || 0) * quantitySold))
            const existing = groupedProducts.get(rowKey) || {
                key: rowKey,
                productKey,
                productName,
                unitPrice,
                quantitySold: 0,
                totalSales: 0,
            }

            existing.quantitySold += quantitySold
            existing.totalSales += unitPrice === null ? totalSales : quantitySold * unitPrice
            groupedProducts.set(rowKey, existing)
        })
    })

    const rows = [...groupedProducts.values()]
    const productTotals = rows.reduce((totals, row) => {
        totals.set(row.productKey, (totals.get(row.productKey) || 0) + row.totalSales)
        return totals
    }, new Map())

    return rows.sort((a, b) =>
        (productTotals.get(b.productKey) || 0) - (productTotals.get(a.productKey) || 0)
        || a.productName.localeCompare(b.productName)
        || Number(a.unitPrice || 0) - Number(b.unitPrice || 0)
    )
}

const STATUS_CONFIG = {
    pending:        { label: 'Pending Approval', color: '#d97706', bg: '#fef3c7' },
    released:       { label: 'Cash Released',    color: '#7c3aed', bg: '#ede9fe' },
    manager_review: { label: 'Overspent - Review', color: '#dc2626', bg: '#fee2e2' },
    liquidating:    { label: 'Awaiting Return',  color: '#2563eb', bg: '#dbeafe' },
    completed:      { label: 'Completed',        color: '#16a34a', bg: '#dcfce7' },
}

const salesToISODate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const salesFromISODate = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}
const salesDisplayDate = (value) => salesFromISODate(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

function SalesDateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
    const [open, setOpen] = useState(false)
    const [selecting, setSelecting] = useState('start')
    const [viewMonth, setViewMonth] = useState(() => new Date(salesFromISODate(startDate).getFullYear(), salesFromISODate(startDate).getMonth(), 1))
    const pickerRef = useRef(null)

    useEffect(() => {
        const close = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    const start = salesFromISODate(startDate)
    const end = salesFromISODate(endDate)
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const gridStart = new Date(firstDay)
    gridStart.setDate(1 - firstDay.getDay())
    const days = Array.from({ length: 42 }, (_, index) => {
        const day = new Date(gridStart)
        day.setDate(gridStart.getDate() + index)
        return day
    })

    const chooseDate = (day) => {
        const chosen = salesToISODate(day)
        if (selecting === 'start') {
            onStartChange(chosen)
            if (day > end) onEndChange(chosen)
            setSelecting('end')
        } else {
            if (day < start) onStartChange(chosen)
            onEndChange(chosen)
            setSelecting('start')
            setOpen(false)
        }
    }

    const openFor = (field) => {
        const date = salesFromISODate(field === 'start' ? startDate : endDate)
        setSelecting(field)
        setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1))
        setOpen(true)
    }

    return (
        <div className={`expense-date-picker sales-date-picker ${open ? 'open' : ''}`} ref={pickerRef}>
            <div className="expense-date-fields">
                <button type="button" className={open && selecting === 'start' ? 'active' : ''} onClick={() => openFor('start')}>
                    <span>Start date</span><strong>{salesDisplayDate(startDate)}</strong>
                </button>
                <span className="expense-date-separator">→</span>
                <button type="button" className={open && selecting === 'end' ? 'active' : ''} onClick={() => openFor('end')}>
                    <span>End date</span><strong>{salesDisplayDate(endDate)}</strong>
                </button>
                <Calendar size={18} />
            </div>
            {open && (
                <div className="expense-calendar-popover sales-calendar-popover">
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
                            const iso = salesToISODate(day)
                            const outside = day.getMonth() !== viewMonth.getMonth()
                            const inRange = day >= start && day <= end
                            const edge = iso === startDate || iso === endDate
                            const today = iso === salesToISODate(new Date())
                            return <button type="button" key={iso} className={`${outside ? 'outside' : ''} ${inRange ? 'in-range' : ''} ${edge ? 'range-edge' : ''} ${today ? 'today' : ''}`} onClick={() => chooseDate(day)}>{day.getDate()}</button>
                        })}
                    </div>
                    <div className="expense-calendar-footer">
                        <span>{salesDisplayDate(startDate)} — {salesDisplayDate(endDate)}</span>
                        <button type="button" onClick={() => { const today = new Date(); setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); chooseDate(today) }}>Today</button>
                    </div>
                </div>
            )}
        </div>
    )
}

// Mini donut chart — centre shows Net Profit Margin = (Revenue − Expenses) / Revenue × 100
const Donut = ({ income, expenses }) => {
    const total = income + expenses
    const revenuePct = total > 0 ? (income / total) * 100 : 0
    // Net Profit Margin: only meaningful when there is revenue
    const netMargin = income > 0 ? ((income - expenses) / income) * 100 : null
    const isProfit = netMargin === null ? true : netMargin >= 0
    return (
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: total === 0
                    ? 'var(--cream-200)'
                    : `conic-gradient(var(--success) 0% ${revenuePct.toFixed(1)}%, var(--danger) ${revenuePct.toFixed(1)}% 100%)`,
                boxShadow: total > 0 ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
            }} />
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                gap: 1,
            }}>
                {netMargin !== null
                    ? <>
                        <span style={{ fontSize: '0.5rem', fontWeight: 800, color: isProfit ? 'var(--success)' : 'var(--danger)', lineHeight: 1 }}>
                            {isProfit ? '+' : ''}{netMargin.toFixed(0)}%
                        </span>
                        <span style={{ fontSize: '0.42rem', color: 'var(--text-muted)', lineHeight: 1, textAlign: 'center', fontWeight: 600 }}>
                            Net Margin
                        </span>
                      </>
                    : <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>—</span>
                }
            </div>
        </div>
    )
}

const SALES_CHART_COLORS = ['#8b542c', '#d7a64a', '#5f321a', '#c98245', '#e9c98e']

function SalesTrendChart({ points }) {
    const width = 620
    const height = 218
    const left = 54
    const right = 18
    const top = 20
    const bottom = 42
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const maxValue = Math.max(...points.map(point => point.value), 1)
    const step = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth
    const plotted = points.map((point, index) => ({
        ...point,
        x: left + (points.length > 1 ? index * step : chartWidth / 2),
        y: top + chartHeight - (point.value / maxValue) * chartHeight,
    }))
    const line = plotted.map(point => `${point.x},${point.y}`).join(' ')
    const area = plotted.length > 0
        ? `M ${plotted[0].x} ${top + chartHeight} L ${plotted.map(point => `${point.x} ${point.y}`).join(' L ')} L ${plotted[plotted.length - 1].x} ${top + chartHeight} Z`
        : ''
    const moneyTick = value => value >= 1000 ? `₱${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `₱${Math.round(value)}`

    if (points.length === 0) {
        return <div className="sales-chart-empty"><TrendingUp size={28} /><span>No paid sales in this period</span></div>
    }

    return (
        <div className="sales-trend-chart" aria-label="Sales trend chart">
            <svg viewBox={`0 0 ${width} ${height}`} role="img">
                <defs>
                    <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b8783d" stopOpacity="0.34" />
                        <stop offset="100%" stopColor="#b8783d" stopOpacity="0.03" />
                    </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                    const y = top + chartHeight - ratio * chartHeight
                    return (
                        <g key={ratio}>
                            <line x1={left} x2={width - right} y1={y} y2={y} className="sales-chart-gridline" />
                            <text x={left - 10} y={y + 4} textAnchor="end" className="sales-chart-axis">{moneyTick(maxValue * ratio)}</text>
                        </g>
                    )
                })}
                <path d={area} fill="url(#salesTrendFill)" />
                {plotted.length > 1 && <polyline points={line} className="sales-chart-line" />}
                {plotted.map((point, index) => (
                    <g key={`${point.label}-${index}`}>
                        <circle cx={point.x} cy={point.y} r="5" className="sales-chart-dot" />
                        <title>{point.fullLabel}: {fmt(point.value)}</title>
                        <text x={point.x} y={height - 14} textAnchor="middle" className="sales-chart-axis sales-chart-date-label">{point.label}</text>
                    </g>
                ))}
            </svg>
        </div>
    )
}

function SalesHorizontalBars({ items, valueFormatter = fmt }) {
    const max = Math.max(...items.map(item => item.value), 1)
    if (items.length === 0) return <div className="sales-chart-empty"><BarChart2 size={28} /><span>No data in this period</span></div>

    return (
        <div className="sales-horizontal-bars">
            {items.map((item, index) => (
                <div className="sales-horizontal-bar" key={item.label}>
                    <div className="sales-horizontal-bar-label">
                        <span title={item.label}>{item.label}</span>
                        <strong>{valueFormatter(item.value)}</strong>
                    </div>
                    <div className="sales-horizontal-bar-track">
                        <span style={{ width: `${Math.max((item.value / max) * 100, 3)}%`, background: SALES_CHART_COLORS[index % SALES_CHART_COLORS.length] }} />
                    </div>
                    {item.meta && <small>{item.meta}</small>}
                </div>
            ))}
        </div>
    )
}

function SalesBreakdownDonut({ items, centerLabel, centerValue }) {
    const total = items.reduce((sum, item) => sum + item.value, 0)
    let offset = 0
    const gradient = items.map((item, index) => {
        const start = total > 0 ? (offset / total) * 100 : 0
        offset += item.value
        const end = total > 0 ? (offset / total) * 100 : 0
        return `${SALES_CHART_COLORS[index % SALES_CHART_COLORS.length]} ${start}% ${end}%`
    }).join(', ')

    return (
        <div className="sales-breakdown-layout">
            <div className="sales-breakdown-donut" style={{ background: total > 0 ? `conic-gradient(${gradient})` : 'var(--cream-200)' }}>
                <div>
                    <strong>{centerValue ?? total}</strong>
                    <span>{centerLabel}</span>
                </div>
            </div>
            <div className="sales-breakdown-legend">
                {items.length === 0 ? <span className="sales-breakdown-empty">No data in this period</span> : items.map((item, index) => (
                    <div key={item.label}>
                        <i style={{ background: SALES_CHART_COLORS[index % SALES_CHART_COLORS.length] }} />
                        <span title={item.label}>{item.label}</span>
                        <strong>{total > 0 ? `${Math.round((item.value / total) * 100)}%` : '0%'}</strong>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function Sales() {
    const toast = useToastContext()
    const { user } = useAuth()
    const { settings } = useSettings()
    const [sales, setSales]               = useState([])
    const [fundRequests, setFundRequests] = useState([])
    const [expenses, setExpenses]         = useState([])
    const [priceChanges, setPriceChanges] = useState([])
    const [loading, setLoading]           = useState(true)
    const [detail, setDetail]             = useState(null)
    const [receiptModal, setReceiptModal] = useState(false)
    const [receiptSale, setReceiptSale]   = useState(null)
    const [activeTab, setActiveTab]       = useState('sales')
    const [period, setPeriod]             = useState('today')
    const [startDate, setStartDate]       = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate]           = useState(new Date().toISOString().split('T')[0])
    const [search, setSearch]             = useState('')
    const [fundSearch, setFundSearch]     = useState('')
    const [fundStatus, setFundStatus]     = useState('all')
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all') // 'all', 'paid', 'pending'

    const [releaseModal, setReleaseModal]   = useState(false)
    const [confirmModal, setConfirmModal]   = useState(false)
    const [selectedFR, setSelectedFR]       = useState(null)
    const [releaseForm, setReleaseForm]     = useState({ released_amount: '' })
    const [saving, setSaving]               = useState(false)

    const loadData = useCallback(() => {
        setLoading(true)
        Promise.all([
            salesService.getAll().then(setSales).catch(() => toast('Failed to load sales', 'error')),
            fundRequestService.getAll().then(setFundRequests).catch(() => toast('Failed to load fund requests', 'error')),
            expensesService.getAll().then(setExpenses).catch(() => toast('Failed to load expenses', 'error')),
            user?.role === 'Admin'
                ? menuService.getPriceHistory().then(setPriceChanges).catch(() => toast('Failed to load price history', 'error'))
                : Promise.resolve(setPriceChanges([])),
        ]).finally(() => setLoading(false))
    }, [toast, user?.role])
    useEffect(loadData, [loadData])

    const getLocalDateStr = (d = new Date()) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const inPeriod = (dateStr) => {
        if (period === 'all') return true
        if (!dateStr) return false

        // Extract YYYY-MM-DD
        const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]

        const now = new Date()
        const todayStr = getLocalDateStr(now)

        if (period === 'today') {
            return cleanDateStr === todayStr
        }

        if (period === 'week') {
            const currentDayOfWeek = now.getDay() // 0 (Sun) to 6 (Sat)
            const weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayOfWeek, 0, 0, 0, 0)
            const weekEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - currentDayOfWeek), 23, 59, 59, 999)
            const weekStartStr = getLocalDateStr(weekStartDate)
            const weekEndStr = getLocalDateStr(weekEndDate)
            return cleanDateStr >= weekStartStr && cleanDateStr <= weekEndStr
        }

        if (period === 'month') {
            const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            return cleanDateStr.startsWith(currentMonthPrefix)
        }

        if (period === 'custom') {
            return cleanDateStr >= startDate && cleanDateStr <= endDate
        }

        return true
    }

    const periodSales        = sales.filter(s => inPeriod(s.date))
    const periodPaidSales    = periodSales.filter(s => s.isPaid)
    const periodPendingSales = periodSales.filter(s => !s.isPaid)
    const periodRevenue      = periodPaidSales.reduce((s, r) => s + Number(r.total), 0)
    const periodFundExpenses = fundRequests
        .filter(r => r.status === 'completed' && inPeriod(new Date(r.updated_at).toISOString().split('T')[0]))
        .reduce((s, r) => s + Number(r.spent_amount), 0)
    const periodDirectExpenses = expenses
        .filter(e => inPeriod(e.date))
        .reduce((s, e) => s + Number(e.amount), 0)
    const periodExpenses = periodFundExpenses + periodDirectExpenses
    const periodNet      = periodRevenue - periodExpenses

    // Dashboard KPIs
    const totalItemsSold    = periodSales.reduce((sum, sale) => {
        const itemQuantity = (sale.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0)
        return sum + (itemQuantity || Number(sale.totalQty || sale.itemCount || 0))
    }, 0)
    const avgTransaction    = periodPaidSales.length > 0 ? periodRevenue / periodPaidSales.length : 0

    // Filtered sales list (search by any visible text column and payment status)
    // NOTE: all period/date dependencies are listed explicitly so React keeps this memo in sync.
    const filteredSales = useMemo(() => {
        const q = search.toLowerCase()
        // Recompute period filtering inside the memo so every dep is explicit
        const inPeriodLocal = (dateStr) => {
            if (period === 'all') return true
            if (!dateStr) return false
            const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]
            const now = new Date()
            const pad = (n) => String(n).padStart(2, '0')
            const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
            if (period === 'today') return clean === todayStr
            if (period === 'week') {
                const dow = now.getDay()
                const ws = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
                const we = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dow))
                const wsStr = `${ws.getFullYear()}-${pad(ws.getMonth()+1)}-${pad(ws.getDate())}`
                const weStr = `${we.getFullYear()}-${pad(we.getMonth()+1)}-${pad(we.getDate())}`
                return clean >= wsStr && clean <= weStr
            }
            if (period === 'month') return clean.startsWith(`${now.getFullYear()}-${pad(now.getMonth()+1)}`)
            if (period === 'custom') return clean >= startDate && clean <= endDate
            return true
        }
        return sales.filter(s => {
            if (!inPeriodLocal(s.date)) return false
            if (paymentStatusFilter === 'paid'    &&  !s.isPaid) return false
            if (paymentStatusFilter === 'pending' && s.isPaid) return false
            if (!q) return true
            return (
                String(s.id).padStart(4, '0').includes(q) ||
                String(s.transactionId || '').toLowerCase().includes(q) ||
                String(s.orderId || '').includes(q) ||
                (s.cashier || '').toLowerCase().includes(q) ||
                (s.paymentMethod || '').toLowerCase().includes(q) ||
                (s.paymentStatus || '').toLowerCase().includes(q) ||
                (s.status || '').toLowerCase().includes(q) ||
                (s.date || '').includes(q) ||
                fmtRecordDate(s.date).includes(q) ||
                (s.items || []).some(item => (
                    `${item.name || ''} ${item.quantity ?? ''} ${item.price ?? ''} ${item.subtotal ?? ''}`
                        .toLowerCase()
                        .includes(q)
                ))
            )
        }).sort((a, b) => {
            const idA = Number(a.orderId || a.id) || 0
            const idB = Number(b.orderId || b.id) || 0
            return idB - idA
        })
    }, [sales, period, search, startDate, endDate, paymentStatusFilter])

    // Product summary for the selected period: one row per product and exact
    // selling price. A price change therefore creates a separate report row.
    const salesRecordRows = useMemo(() => {
        const q = search.trim().toLowerCase()

        const itemRows = filteredSales.flatMap(sale => {
            const transactionText = [
                sale.id,
                sale.transactionId,
                sale.orderId,
                sale.cashier,
                sale.paymentMethod,
                sale.paymentStatus,
                sale.status,
                sale.date,
                fmtRecordDate(sale.date),
            ].filter(Boolean).join(' ').toLowerCase()
            const transactionMatches = !q || transactionText.includes(q)
            const items = (sale.items || []).length > 0
                ? sale.items
                : [{
                    name: 'Item details unavailable',
                    quantity: Number(sale.totalQty || 0),
                    price: null,
                    subtotal: Number(sale.total || 0),
                }]

            return items
                .map((item, itemIndex) => {
                    const quantitySold = Number(item.quantity || 0)
                    const unitPrice = item.price == null ? null : Number(item.price)
                    const totalSales = Number(item.subtotal ?? ((unitPrice || 0) * quantitySold))

                    return {
                        key: `${sale.id}-${itemIndex}`,
                        date: sale.date,
                        productName: item.name || 'Unnamed product',
                        quantitySold,
                        unitPrice,
                        totalSales,
                    }
                })
                .filter(row => {
                    if (transactionMatches) return true
                    const itemText = `${row.productName} ${row.quantitySold} ${row.unitPrice ?? ''} ${row.totalSales}`.toLowerCase()
                    return itemText.includes(q)
                })
        })

        const groupedProducts = new Map()
        itemRows.forEach(row => {
            const productKey = row.productName.trim().toLocaleLowerCase()
            const priceKey = row.unitPrice === null ? 'unpriced' : row.unitPrice.toFixed(2)
            const rowKey = `${productKey}::${priceKey}`
            const existing = groupedProducts.get(rowKey) || {
                key: rowKey,
                productKey,
                productName: row.productName,
                unitPrice: row.unitPrice,
                quantitySold: 0,
                totalSales: 0,
                firstDate: row.date,
                lastDate: row.date,
            }

            existing.quantitySold += row.quantitySold
            existing.totalSales += row.unitPrice === null ? row.totalSales : row.quantitySold * row.unitPrice
            if (row.date && (!existing.firstDate || row.date < existing.firstDate)) existing.firstDate = row.date
            if (row.date && (!existing.lastDate || row.date > existing.lastDate)) existing.lastDate = row.date
            groupedProducts.set(rowKey, existing)
        })

        const rows = [...groupedProducts.values()].map(product => ({
                ...product,
                dateLabel: product.firstDate === product.lastDate
                    ? fmtRecordDate(product.lastDate)
                    : `${fmtRecordDate(product.firstDate)} – ${fmtRecordDate(product.lastDate)}`,
            }))
        const productTotals = rows.reduce((totals, row) => {
            totals.set(row.productKey, (totals.get(row.productKey) || 0) + row.totalSales)
            return totals
        }, new Map())

        return rows.sort((a, b) =>
            (productTotals.get(b.productKey) || 0) - (productTotals.get(a.productKey) || 0)
            || a.productName.localeCompare(b.productName)
            || Number(a.unitPrice || 0) - Number(b.unitPrice || 0)
        )
    }, [filteredSales, search])

    const salesRecordTotals = useMemo(() => salesRecordRows.reduce((totals, row) => ({
        quantitySold: totals.quantitySold + Number(row.quantitySold || 0),
        totalSales: totals.totalSales + Number(row.totalSales || 0),
    }), { quantitySold: 0, totalSales: 0 }), [salesRecordRows])

    const printableTransactions = periodPaidSales.filter(sale => {
        const status = String(sale.status || '').toLowerCase()
        return !['cancelled', 'canceled'].includes(status)
    })
    const printableRows = summarizeProductSales(printableTransactions)
    const printableData = {
        transactions: printableTransactions,
        rows: printableRows,
        quantitySold: printableRows.reduce((sum, row) => sum + row.quantitySold, 0),
        totalSales: printableRows.reduce((sum, row) => sum + row.totalSales, 0),
    }
    const periodPriceChanges = priceChanges.filter(change => {
        const parsedDate = new Date(change.changedAt)
        const changedDate = Number.isNaN(parsedDate.getTime()) ? '' : salesToISODate(parsedDate)
        return changedDate && inPeriod(changedDate)
    })

    const salesAnalytics = useMemo(() => {
        const paidSales = periodSales.filter(sale => sale.isPaid)
        const trendGroups = new Map()
        const groupByMonth = period === 'all'

        paidSales.forEach(sale => {
            const cleanDate = String(sale.date || '').split('T')[0].split(' ')[0]
            if (!cleanDate) return
            const key = groupByMonth ? cleanDate.slice(0, 7) : cleanDate
            trendGroups.set(key, (trendGroups.get(key) || 0) + Number(sale.total || 0))
        })

        const trend = [...trendGroups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-8)
            .map(([key, value]) => {
                const date = salesFromISODate(groupByMonth ? `${key}-01` : key)
                return {
                    value,
                    label: date.toLocaleDateString('en-PH', groupByMonth ? { month: 'short' } : { month: 'short', day: 'numeric' }),
                    fullLabel: date.toLocaleDateString('en-PH', groupByMonth ? { month: 'long', year: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' }),
                }
            })

        const productMap = new Map()
        paidSales.forEach(sale => (sale.items || []).forEach(item => {
            const name = item.name || 'Unnamed product'
            const quantity = Number(item.quantity || 0)
            const revenue = Number(item.subtotal ?? (Number(item.price || 0) * quantity))
            const current = productMap.get(name) || { value: 0, quantity: 0 }
            productMap.set(name, { value: current.value + revenue, quantity: current.quantity + quantity })
        }))
        const topProducts = [...productMap.entries()]
            .map(([label, data]) => ({ label, value: data.value, meta: `${data.quantity} item${data.quantity !== 1 ? 's' : ''} sold` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

        const paymentMap = new Map()
        paidSales.forEach(sale => {
            const label = sale.paymentMethod || 'Unspecified'
            paymentMap.set(label, (paymentMap.get(label) || 0) + Number(sale.total || 0))
        })
        const paymentMethods = [...paymentMap.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)

        const cashierMap = new Map()
        paidSales.forEach(sale => {
            const label = sale.cashier || 'Unassigned'
            cashierMap.set(label, (cashierMap.get(label) || 0) + Number(sale.total || 0))
        })
        const cashiers = [...cashierMap.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

        return {
            trend,
            topProducts,
            paymentMethods,
            cashiers,
            uniqueProducts: productMap.size,
            orderStatuses: [
                { label: 'Paid', value: periodPaidSales.length },
                { label: 'Pending', value: periodPendingSales.length },
            ].filter(item => item.value > 0),
        }
    }, [periodSales, period, periodPaidSales.length, periodPendingSales.length])

    // Filtered fund requests
    const filteredFunds = useMemo(() => {
        return fundRequests
            .filter(r => fundStatus === 'all' || r.status === fundStatus)
            .filter(r => (r.purchaser_name || '').toLowerCase().includes(fundSearch.toLowerCase()))
    }, [fundRequests, fundStatus, fundSearch])

    const handleRelease = async (e) => {
        e.preventDefault()
        if (!releaseForm.released_amount || releaseForm.released_amount <= 0) { toast('Enter a valid amount', 'warning'); return }
        setSaving(true)
        try {
            await fundRequestService.release(selectedFR.id, { cashier_name: user?.fullName || 'Cashier', released_amount: releaseForm.released_amount })
            toast('Funds released successfully', 'success')
            setReleaseModal(false); loadData()
        } catch { toast('Failed to release funds', 'error') }
        finally { setSaving(false) }
    }

    const handleConfirm = async () => {
        setSaving(true)
        try {
            await fundRequestService.complete(selectedFR.id)
            toast('Liquidation confirmed', 'success')
            setConfirmModal(false); loadData()
        } catch { toast('Failed to confirm', 'error') }
        finally { setSaving(false) }
    }

    const handleDeleteSale = async (e, id) => {
        e.stopPropagation()
        if (!window.confirm('Are you sure you want to delete this transaction record?')) return
        setLoading(true)
        try {
            await salesService.delete(id)
            toast('Transaction deleted successfully', 'success')
            setDetail(null)
            loadData()
        } catch {
            toast('Failed to delete transaction', 'error')
            setLoading(false)
        }
    }

    const handleDeleteAllSales = async () => {
        if (sales.length === 0) return
        const isFiltered = filteredSales.length !== sales.length
        const count = isFiltered ? filteredSales.length : sales.length
        if (count === 0) return
        const msg = isFiltered
            ? `Are you sure you want to delete ${count} filtered transaction record(s)? This action cannot be undone.`
            : `Are you sure you want to delete all ${sales.length} transaction records? This action cannot be undone.`
        if (!window.confirm(msg)) return

        setLoading(true)
        try {
            if (isFiltered) {
                await Promise.all(filteredSales.map(s => salesService.delete(s.id)))
                toast(`${count} transaction record(s) deleted`, 'success')
            } else {
                await salesService.deleteAll()
                toast('All transaction records deleted', 'success')
            }
            loadData()
        } catch (err) {
            try {
                const toDelete = isFiltered ? filteredSales : sales
                await Promise.all(toDelete.map(s => salesService.delete(s.id)))
                toast('Transaction records deleted', 'success')
                loadData()
            } catch {
                toast(err.response?.data?.message || 'Failed to delete transaction records', 'error')
                setLoading(false)
            }
        }
    }

    const handlePrintSalesRecords = () => {
        if (printableData.rows.length === 0) {
            toast('No paid sales records found for the selected date range', 'warning')
            return
        }

        const now = new Date()
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
        const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()))
        const periodLabel = period === 'custom'
            ? `${fmtDate(startDate)} to ${fmtDate(endDate)}`
            : period === 'today'
                ? fmtDate(getLocalDateStr(now))
                : period === 'week'
                    ? `${fmtDate(getLocalDateStr(weekStart))} to ${fmtDate(getLocalDateStr(weekEnd))}`
                    : now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
        const storeName = settings?.store_name || 'Comoda Restaurant'
        const printedAt = new Date().toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        })
        const reportRows = printableData.rows.map(row => `
            <tr>
                <td>${escapePrintHtml(row.productName)}</td>
                <td class="number">${Number(row.quantitySold).toLocaleString('en-PH')}</td>
                <td class="money">${row.unitPrice == null ? '—' : escapePrintHtml(fmt(row.unitPrice))}</td>
                <td class="money total">${escapePrintHtml(fmt(row.totalSales))}</td>
            </tr>
        `).join('')
        const priceChangeRows = periodPriceChanges.map(change => `
            <tr>
                <td>${escapePrintHtml(change.productName)}</td>
                <td class="money">${change.oldPrice == null ? '—' : escapePrintHtml(fmt(change.oldPrice))}</td>
                <td class="money">${change.newPrice == null ? '—' : escapePrintHtml(fmt(change.newPrice))}</td>
                <td>${escapePrintHtml(new Date(change.changedAt).toLocaleString('en-PH'))}</td>
                <td>${escapePrintHtml(change.staffMember || '—')}</td>
                <td>${escapePrintHtml(change.reason || '—')}</td>
            </tr>
        `).join('')
        const printWindow = window.open('', '_blank', 'width=960,height=720')

        if (!printWindow) {
            toast('Please allow pop-ups to print the selected sales report', 'warning')
            return
        }

        printWindow.document.open()
        printWindow.document.write(`<!doctype html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>${escapePrintHtml(periodLabel)} Sales Records</title>
                    <style>
                        * { box-sizing: border-box; }
                        body { margin: 0; color: #2f2118; font-family: Arial, Helvetica, sans-serif; background: #fff; }
                        .report { width: 100%; max-width: 920px; margin: 0 auto; padding: 30px; }
                        .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; padding-bottom: 18px; border-bottom: 3px solid #7b461f; }
                        .brand { margin: 0 0 5px; color: #4a2815; font-family: Georgia, serif; font-size: 30px; }
                        h1 { margin: 0; font-size: 21px; }
                        .month { margin-top: 5px; color: #795b47; font-size: 14px; }
                        .printed { color: #795b47; font-size: 11px; text-align: right; }
                        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
                        .summary-card { padding: 12px 14px; border: 1px solid #dec7ad; border-radius: 8px; background: #fbf7f1; }
                        .summary-card span { display: block; margin-bottom: 5px; color: #795b47; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
                        .summary-card strong { color: #4a2815; font-size: 18px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 10px 12px; border: 1px solid #d8b996; font-size: 12px; }
                        th { color: #fff; background: #855026; text-align: left; }
                        tbody tr:nth-child(even) { background: #fbf7f1; }
                        tfoot td { border-top: 2px solid #855026; background: #f1e4d4; font-weight: 800; }
                        .number { text-align: center; }
                        .money { text-align: right; white-space: nowrap; }
                        .total { color: #5c3219; font-weight: 700; }
                        .section-title { margin: 24px 0 10px; color: #4a2815; font-size: 17px; }
                        .empty-row { padding: 18px; color: #795b47; text-align: center; }
                        .footer { margin-top: 16px; color: #876b58; font-size: 10px; text-align: center; }
                        @page { size: A4 portrait; margin: 12mm; }
                        @media print {
                            .report { max-width: none; padding: 0; }
                            thead { display: table-header-group; }
                            tr { break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <main class="report">
                        <header class="header">
                            <div>
                                <h2 class="brand">${escapePrintHtml(storeName)}</h2>
                                <h1>Sales Records</h1>
                                <div class="month">${escapePrintHtml(periodLabel)}</div>
                            </div>
                            <div class="printed">Printed ${escapePrintHtml(printedAt)}</div>
                        </header>
                        <section class="summary">
                            <div class="summary-card"><span>Paid transactions</span><strong>${printableData.transactions.length.toLocaleString('en-PH')}</strong></div>
                            <div class="summary-card"><span>Quantity sold</span><strong>${printableData.quantitySold.toLocaleString('en-PH')}</strong></div>
                            <div class="summary-card"><span>Total product sales</span><strong>${escapePrintHtml(fmt(printableData.totalSales))}</strong></div>
                        </section>
                        <table>
                            <thead><tr><th>Product Name</th><th class="number">Quantity Sold</th><th class="money">Unit Price (₱)</th><th class="money">Total Sales (₱)</th></tr></thead>
                            <tbody>${reportRows}</tbody>
                            <tfoot><tr><td>Grand Total</td><td class="number">${printableData.quantitySold.toLocaleString('en-PH')}</td><td></td><td class="money total">${escapePrintHtml(fmt(printableData.totalSales))}</td></tr></tfoot>
                        </table>
                        <h2 class="section-title">Price Change Log</h2>
                        <table>
                            <thead><tr><th>Product Name</th><th class="money">Old Price</th><th class="money">New Price</th><th>Date Changed</th><th>Changed By</th><th>Reason</th></tr></thead>
                            <tbody>${priceChangeRows || '<tr><td colspan="6" class="empty-row">No price changes in this reporting period.</td></tr>'}</tbody>
                        </table>
                        <div class="footer">Generated from paid sales records in Comoda.</div>
                    </main>
                </body>
            </html>`)
        printWindow.document.close()
        printWindow.focus()
        window.setTimeout(() => printWindow.print(), 250)
    }

    const PERIODS = [
        { key: 'today',  label: 'Today' },
        { key: 'week',   label: 'This Week' },
        { key: 'month',  label: 'This Month' },
        { key: 'custom', label: 'Custom Range' },
    ]

    return (
        <div style={{ paddingTop: 8 }}>
            {/* ── Dashboard KPI Stats ── */}
            <div className="sales-summary-kpi-grid" style={{ marginBottom: 18, padding: '0 24px' }}>
                {[
                    { label: 'Total Sales (Paid)', value: fmt(periodRevenue), icon: <TrendingUp size={18}/>, color: 'var(--success)', bg: 'var(--success-bg)', sub: `${periodPaidSales.length} paid transaction${periodPaidSales.length !== 1 ? 's' : ''}` },
                    { label: 'Total Transactions', value: periodSales.length, icon: <Hash size={18}/>, color: 'var(--brown-700)', bg: 'var(--brown-50)', sub: `${periodPaidSales.length} Paid · ${periodPendingSales.length} Pending` },
                    { label: 'Products Sold', value: salesAnalytics.uniqueProducts, icon: <Receipt size={18}/>, color: '#a35f21', bg: '#fff3df', sub: 'Unique menu products' },
                    { label: 'Items Sold', value: totalItemsSold, icon: <ShoppingBag size={18}/>, color: '#7c3aed', bg: '#ede9fe', sub: 'Total qty across orders' },
                    { label: 'Avg Transaction', value: fmt(avgTransaction), icon: <BarChart2 size={18}/>, color: '#2563eb', bg: '#dbeafe', sub: 'Revenue ÷ Paid Transactions' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>{s.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Unified Summary Bar ── */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch', padding: '0 24px' }}>
                {/* Financial stat cards */}
                {[
                    { label: 'Revenue', value: periodRevenue, icon: <ArrowUpRight size={18}/>, color: 'var(--success)', bg: 'var(--success-bg)', sub: `${periodPaidSales.length} paid transaction${periodPaidSales.length !== 1 ? 's' : ''}` },
                    { label: 'Expenses', value: periodExpenses, icon: <ArrowDownRight size={18}/>, color: 'var(--danger)', bg: 'var(--danger-bg)', sub: `Funds ${fmt(periodFundExpenses)} · Direct ${fmt(periodDirectExpenses)}` },
                    { label: 'Net Profit', value: periodNet, icon: <TrendingUp size={18}/>, color: periodNet >= 0 ? 'var(--success)' : 'var(--danger)', bg: periodNet >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', sub: 'Revenue − Expenses' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 140
                    }}>
                        <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{fmt(s.value)}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>{s.sub}</div>
                        </div>
                    </div>
                ))}

                {/* Breakdown & Toggles */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flex: '1.5', minWidth: 370, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <Donut income={periodRevenue} expenses={periodExpenses} />
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>BREAKDOWN</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', marginBottom: 3 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)', display: 'inline-block' }}/>
                                <span style={{ color: 'var(--text-muted)' }}>Revenue</span>
                                <span style={{ fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{fmt(periodRevenue)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', marginBottom: 2 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#dc2626', display: 'inline-block' }}/>
                                <span style={{ color: 'var(--text-muted)' }}>Fund Exp.</span>
                                <span style={{ fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{fmt(periodFundExpenses)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316', display: 'inline-block' }}/>
                                <span style={{ color: 'var(--text-muted)' }}>Direct Exp.</span>
                                <span style={{ fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{fmt(periodDirectExpenses)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--cream-100)', borderRadius: 10, padding: 4 }}>
                        <button className={`btn btn-sm ${activeTab === 'sales' ? 'btn-primary' : ''}`}
                            style={{ background: activeTab === 'sales' ? undefined : 'transparent', boxShadow: 'none', border: 'none', justifyContent: 'flex-start' }}
                            onClick={() => setActiveTab('sales')}>
                            <TrendingUp size={15}/> Sales
                        </button>
                        <button className={`btn btn-sm ${activeTab === 'funds' ? 'btn-primary' : ''}`}
                            style={{ background: activeTab === 'funds' ? undefined : 'transparent', boxShadow: 'none', border: 'none', justifyContent: 'flex-start' }}
                            onClick={() => setActiveTab('funds')}>
                            <Banknote size={15}/> Cash Funds
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Period Filter Tabs ── */}
            <div className="sales-period-row" style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', padding: '0 24px' }}>
                <div className="sales-period-tabs" style={{ display: 'flex', gap: 4, background: 'var(--cream-100)', borderRadius: 10, padding: 4 }}>
                    {PERIODS.map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            style={{
                                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                                background: period === p.key ? 'var(--brown-600)' : 'transparent',
                                color: period === p.key ? '#fff' : 'var(--text-muted)',
                            }}>{p.label}</button>
                    ))}
                </div>

                {period === 'custom' && (
                    <SalesDateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onStartChange={setStartDate}
                        onEndChange={setEndDate}
                    />
                )}

                <button className="btn btn-secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '6px 14px', fontSize: '0.8rem' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {loading ? <div className="loading"><div className="spinner"/></div> : (

            /* ══════════════ SALES TAB ══════════════ */
            activeTab === 'sales' ? (
                <div style={{ background: 'var(--cream-50)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', margin: '0 24px' }}>
                    <div className="sales-analysis-heading">
                        <div>
                            <span>PERFORMANCE OVERVIEW</span>
                            <h2>Sales Analysis Dashboard</h2>
                            <p>Track revenue, best sellers, payment channels, and order activity for the selected period.</p>
                        </div>
                        <div className="sales-analysis-period-badge"><Calendar size={15} /> {PERIODS.find(item => item.key === period)?.label}</div>
                    </div>

                    <div className="sales-analytics-grid">
                        <section className="sales-analytics-card sales-analytics-card-wide">
                            <div className="sales-analytics-card-heading">
                                <div><span className="sales-analytics-icon"><TrendingUp size={17} /></span><div><h3>Sales Trend</h3><p>Paid revenue over time</p></div></div>
                                <strong>{fmt(periodRevenue)}</strong>
                            </div>
                            <SalesTrendChart points={salesAnalytics.trend} />
                        </section>

                        <section className="sales-analytics-card">
                            <div className="sales-analytics-card-heading">
                                <div><span className="sales-analytics-icon"><ShoppingBag size={17} /></span><div><h3>Top 5 Products</h3><p>Ranked by paid sales</p></div></div>
                            </div>
                            <SalesHorizontalBars items={salesAnalytics.topProducts} />
                        </section>

                        <section className="sales-analytics-card">
                            <div className="sales-analytics-card-heading">
                                <div><span className="sales-analytics-icon"><Banknote size={17} /></span><div><h3>Payment Methods</h3><p>Share of paid revenue</p></div></div>
                            </div>
                            <SalesBreakdownDonut items={salesAnalytics.paymentMethods} centerLabel="Paid sales" centerValue={fmt(periodRevenue)} />
                        </section>

                        <section className="sales-analytics-card">
                            <div className="sales-analytics-card-heading">
                                <div><span className="sales-analytics-icon"><CheckCircle size={17} /></span><div><h3>Order Status</h3><p>Paid and pending transactions</p></div></div>
                            </div>
                            <SalesBreakdownDonut items={salesAnalytics.orderStatuses} centerLabel="Orders" centerValue={periodSales.length} />
                        </section>

                        <section className="sales-analytics-card">
                            <div className="sales-analytics-card-heading">
                                <div><span className="sales-analytics-icon"><Users size={17} /></span><div><h3>Sales by Cashier</h3><p>Paid revenue handled</p></div></div>
                            </div>
                            <SalesHorizontalBars items={salesAnalytics.cashiers} />
                        </section>
                    </div>

                    <div className="sales-records-section-heading">
                        <div>
                            <span>DETAILED LEDGER</span>
                            <h2>Sales Records</h2>
                        </div>
                    </div>

                    {/* Table toolbar */}
                    <div style={{ padding: '0 0 14px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600 }}>
                            Showing {salesRecordRows.length} sales row{salesRecordRows.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 4, background: 'var(--cream-100)', borderRadius: 8, padding: 3 }}>
                            {[
                                { k: 'all', l: `All (${periodSales.length})` },
                                { k: 'paid', l: `Paid (${periodPaidSales.length})` },
                                { k: 'pending', l: `Pending (${periodPendingSales.length})` }
                            ].map(tab => (
                                <button key={tab.k} onClick={() => setPaymentStatusFilter(tab.k)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                        background: paymentStatusFilter === tab.k ? 'var(--brown-600)' : 'transparent',
                                        color: paymentStatusFilter === tab.k ? '#fff' : 'var(--text-muted)',
                                        transition: 'all 0.15s ease'
                                    }}>
                                    {tab.l}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px' }}>
                            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                            <input
                                id="sales-search"
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '100%' }}
                                placeholder="Search by product, date, transaction…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}/>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handlePrintSalesRecords}
                                disabled={loading}
                                style={{ minHeight: 36, padding: '7px 12px', gap: 6, whiteSpace: 'nowrap' }}
                                title="Print grouped sales records for the selected date range"
                            >
                                <Printer size={15} /> {period === 'custom' ? 'Print Custom Range' : 'Print Records'}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteAllSales}
                            disabled={loading || filteredSales.length === 0}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(220, 38, 38, 0.3)',
                                background: 'rgba(220, 38, 38, 0.08)',
                                color: 'var(--danger)',
                                cursor: (loading || filteredSales.length === 0) ? 'not-allowed' : 'pointer',
                                opacity: (loading || filteredSales.length === 0) ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap'
                            }}
                            title="Delete all transaction records"
                        >
                            <Trash2 size={14} />
                            Delete All
                        </button>
                    </div>

                    {salesRecordRows.length === 0 ? (
                        <div className="empty-state" style={{ padding: '80px 20px' }}>
                            <Receipt size={48} style={{ opacity: 0.5, marginBottom: 16 }}/>
                            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text)' }}>No sales found</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No product records match your current filter</p>
                        </div>
                    ) : (
                        <div className="sales-records-table-wrap">
                            <table className="sales-records-table">
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th className="sales-records-number">Quantity Sold</th>
                                        <th className="sales-records-money">Unit Price (₱)</th>
                                        <th className="sales-records-money">Total Sales (₱)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesRecordRows.map((record) => (
                                            <tr key={record.key}>
                                                <td className="sales-records-product">{record.productName}</td>
                                                <td className="sales-records-number">{record.quantitySold || '—'}</td>
                                                <td className="sales-records-money">{record.unitPrice == null ? '—' : fmt(record.unitPrice)}</td>
                                                <td className="sales-records-money sales-records-total">{fmt(record.totalSales)}</td>
                                            </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>Grand Total</td>
                                        <td className="sales-records-number">{salesRecordTotals.quantitySold.toLocaleString('en-PH')}</td>
                                        <td></td>
                                        <td className="sales-records-money sales-records-total">{fmt(salesRecordTotals.totalSales)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {user?.role === 'Admin' && (
                        <>
                            <div className="sales-records-section-heading sales-price-log-heading">
                                <div>
                                    <span>AUDIT TRAIL</span>
                                    <h2>Price Change Log</h2>
                                </div>
                            </div>
                            <div className="sales-records-table-wrap">
                                <table className="sales-price-history-table">
                                    <thead>
                                        <tr>
                                            <th>Product Name</th>
                                            <th>Old Price</th>
                                            <th>New Price</th>
                                            <th>Date Changed</th>
                                            <th>Changed By</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {periodPriceChanges.length === 0 ? (
                                            <tr><td colSpan={6} className="sales-price-history-empty">No price changes in this reporting period.</td></tr>
                                        ) : periodPriceChanges.map(change => (
                                            <tr key={change.id}>
                                                <td><strong>{change.productName}</strong></td>
                                                <td>{change.oldPrice == null ? '—' : fmt(change.oldPrice)}</td>
                                                <td><strong>{change.newPrice == null ? '—' : fmt(change.newPrice)}</strong></td>
                                                <td>{new Date(change.changedAt).toLocaleString('en-PH')}</td>
                                                <td>{change.staffMember || '—'}</td>
                                                <td>{change.reason || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

            /* ══════════════ FUNDS TAB ══════════════ */
            ) : (
                <div style={{ background: 'var(--cream-50)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', margin: '0 24px' }}>
                    {/* Fund toolbar */}
                    <div style={{ padding: '0 0 14px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600 }}>
                            Showing {filteredFunds.length} record{filteredFunds.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', minWidth: 200 }}>
                            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '100%' }}
                                placeholder="Search by purchaser..." value={fundSearch}
                                onChange={e => setFundSearch(e.target.value)}/>
                        </div>
                        <div style={{ display: 'flex', gap: 4, background: 'var(--cream-100)', borderRadius: 8, padding: 3 }}>
                            {[{k:'all',l:'All'},{k:'pending',l:'Pending'},{k:'released',l:'Released'},{k:'liquidating',l:'Awaiting'},{k:'completed',l:'Done'}].map(f => (
                                <button key={f.k} onClick={() => setFundStatus(f.k)}
                                    style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                        background: fundStatus === f.k ? 'var(--brown-600)' : 'transparent',
                                        color: fundStatus === f.k ? '#fff' : 'var(--text-muted)' }}>
                                    {f.l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredFunds.length === 0 ? (
                        <div className="empty-state" style={{ padding: '80px 20px' }}>
                            <Banknote size={48} style={{ opacity: 0.5, marginBottom: 16 }}/>
                            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text)' }}>No fund requests found</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No records match your current filter</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filteredFunds.map(req => {
                                const cfg = STATUS_CONFIG[req.status] || {}
                                const needsAction = req.status === 'pending' || req.status === 'liquidating'
                                return (
                                    <div key={req.id} style={{
                                        background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                                        border: `1.5px solid ${needsAction ? cfg.color+'60' : 'var(--border)'}`,
                                        padding: '16px 20px',
                                        boxShadow: needsAction ? `0 2px 12px ${cfg.color}20` : 'var(--shadow-sm)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                                            {/* Left info */}
                                            <div style={{ flex: 1, minWidth: 180 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{req.purchaser_name}</span>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: cfg.bg, color: cfg.color }}>
                                                        {cfg.label}
                                                    </span>
                                                    {needsAction && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'var(--danger)', color: '#fff', animation: 'pulse 1.5s infinite' }}>
                                                            ACTION NEEDED
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                    📅 {fmtDate(req.created_at)}
                                                </div>
                                                {req.items_list?.length > 0 && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        🛒 {req.items_list.slice(0, 3).join(', ')}{req.items_list.length > 3 ? ` +${req.items_list.length - 3} more` : ''}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Amount columns */}
                                            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div style={{ textAlign: 'center', minWidth: 80 }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>REQUESTED</div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{fmt(req.requested_amount)}</div>
                                                </div>
                                                {req.released_amount > 0 && (
                                                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>RELEASED</div>
                                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#7c3aed' }}>{fmt(req.released_amount)}</div>
                                                    </div>
                                                )}
                                                {req.spent_amount > 0 && (
                                                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>SPENT</div>
                                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--danger)' }}>{fmt(req.spent_amount)}</div>
                                                    </div>
                                                )}
                                                {req.returned_change > 0 && (
                                                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>RETURNED</div>
                                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--success)' }}>{fmt(req.returned_change)}</div>
                                                    </div>
                                                )}

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {req.status === 'pending' && (
                                                        <button className="btn btn-primary btn-sm"
                                                            onClick={() => { setSelectedFR(req); setReleaseForm({ released_amount: req.requested_amount }); setReleaseModal(true) }}>
                                                            <Banknote size={13}/> Release Funds
                                                        </button>
                                                    )}
                                                    {req.status === 'liquidating' && (
                                                        <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}
                                                            onClick={() => { setSelectedFR(req); setConfirmModal(true) }}>
                                                            <CheckCircle size={13}/> Confirm Return
                                                        </button>
                                                    )}
                                                    {req.status === 'completed' && req.receipt_url && (
                                                        <a href={req.receipt_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                                                            <Receipt size={13}/> Receipt
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )
            )}

            {/* ── Release Funds Modal ── */}
            <Modal isOpen={releaseModal} onClose={() => setReleaseModal(false)} title="Approve & Release Funds"
                footer={<div style={{ display: 'flex', gap: 8, width: '100%' }}><button className="btn btn-secondary btn-block" onClick={() => setReleaseModal(false)}>Cancel</button><button className="btn btn-primary btn-block" onClick={handleRelease} disabled={saving}>{saving ? 'Processing...' : 'Release Cash'}</button></div>}>
                {selectedFR && (<>
                    <div style={{ background: 'var(--cream-100)', padding: 14, borderRadius: 8, marginBottom: 14 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>Items to purchase:</div>
                        <ul style={{ margin: '0 0 0 16px', fontSize: '0.88rem', fontWeight: 600 }}>
                            {selectedFR.items_list?.map((it, i) => <li key={i}>{it}</li>)}
                        </ul>
                    </div>
                    <div className="form-group">
                        <label>Amount to Hand to Purchaser (₱)</label>
                        <input className="input" type="number" min="0.01" step="0.01"
                            value={releaseForm.released_amount}
                            onChange={e => setReleaseForm({ released_amount: e.target.value })} autoFocus/>
                    </div>
                </>)}
            </Modal>

            {/* ── Confirm Return Modal ── */}
            <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Purchaser Liquidation"
                footer={<div style={{ display: 'flex', gap: 8, width: '100%' }}><button className="btn btn-secondary btn-block" onClick={() => setConfirmModal(false)}>Cancel</button><button className="btn btn-success btn-block" onClick={handleConfirm} disabled={saving}>{saving ? 'Processing...' : 'Confirm Return'}</button></div>}>
                {selectedFR && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--cream-100)', padding: 16, borderRadius: 8, marginBottom: 14 }}>
                            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Released</div><div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{fmt(selectedFR.released_amount)}</div></div>
                            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spent</div><div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--danger)' }}>{fmt(selectedFR.spent_amount)}</div></div>
                        </div>
                        <div style={{ border: '2px solid var(--success)', padding: 16, borderRadius: 8, marginBottom: 14 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Change Returned to Drawer</div>
                            <div style={{ fontWeight: 800, fontSize: '1.8rem', color: 'var(--success)' }}>{fmt(selectedFR.returned_change)}</div>
                        </div>
                        {selectedFR.receipt_url && (
                            <a href={selectedFR.receipt_url} target="_blank" rel="noreferrer" style={{ color: 'var(--brown-600)', fontSize: '0.85rem', textDecoration: 'underline' }}>View Upload Receipt</a>
                        )}
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>Confirm that you have received the exact change back into the cash drawer.</p>
                    </div>
                )}
            </Modal>

            {/* ── Sale Detail Modal ── */}
            <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? (detail.transactionId || `Transaction #${String(detail.id||'').padStart(4,'0')}`) : 'Transaction Details'} narrow
                footer={
                    <div className="sales-detail-actions">
                        <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
                        <button
                            className="btn btn-secondary"
                            style={{ color: 'var(--danger)', borderColor: 'rgba(220, 38, 38, 0.3)' }}
                            onClick={(event) => handleDeleteSale(event, detail.id)}
                        >
                            <Trash2 size={15} /> Delete
                        </button>
                        <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => {
                            const current = detail
                            setDetail(null)
                            setReceiptSale(current)
                            setReceiptModal(true)
                        }}>
                            <Printer size={15} /> View Sales Invoice
                        </button>
                    </div>
                }>
                {detail && (() => {
                    const isPaid = detail.isPaid
                    return (
                    <div>
                        {/* Header info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                            <div style={{ background: 'var(--cream-50)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ORDER #</div>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: 2, color: 'var(--brown-800)' }}>Order #{detail.orderId}</div>
                            </div>
                            <div style={{ background: 'var(--cream-50)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PAYMENT STATUS</div>
                                <div style={{ marginTop: 4 }}>
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                        background: isPaid ? '#dcfce7' : '#fef3c7',
                                        color: isPaid ? '#16a34a' : '#d97706',
                                        border: isPaid ? '1px solid rgba(22, 163, 74, 0.3)' : '1px solid rgba(217, 119, 6, 0.35)',
                                        display: 'inline-flex', alignItems: 'center', gap: 4
                                    }}>
                                        {isPaid ? '● PAID' : '○ PENDING / UNPAID'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ background: 'var(--cream-50)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATE & TIME</div>
                                <div style={{ fontWeight: 700, marginTop: 2, fontSize: '0.85rem' }}>{fmtDate(detail.date)} · {fmtTime(detail.time)}</div>
                            </div>
                            <div style={{ background: 'var(--cream-50)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>CASHIER</div>
                                <div style={{ fontWeight: 700, marginTop: 2, fontSize: '0.85rem' }}>{detail.cashier || '—'}</div>
                            </div>
                            <div style={{ background: 'var(--cream-50)', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PAYMENT METHOD</div>
                                <div style={{ fontWeight: 700, marginTop: 2, fontSize: '0.88rem' }}>{detail.paymentMethod || 'Cash'}</div>
                            </div>
                        </div>

                        {/* Items list */}
                        {detail.items && detail.items.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Items Ordered</div>
                                <div style={{ background: 'var(--cream-50)', borderRadius: 8, overflow: 'hidden' }}>
                                    {detail.items.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: i < detail.items.length - 1 ? '1px solid var(--cream-200)' : 'none' }}>
                                            <div>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>×{item.quantity}</span>
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{fmt(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Totals */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                            {[
                                { label: 'Subtotal', value: fmt(detail.subtotal || detail.total) },
                                ...(detail.discount > 0 ? [{ label: 'Discount', value: `-${fmt(detail.discount)}`, color: 'var(--danger)' }] : []),
                                { label: 'Total Billed', value: fmt(detail.total), color: 'var(--brown-700)', bold: true },
                                { label: 'Amount Received', value: fmt(detail.amountReceived || detail.amount_received || 0) },
                                { label: 'Change Given', value: fmt(detail.change || detail.change_amount || 0), color: 'var(--success)', bold: true },
                            ].map(r => (
                                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream-200)' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.label}</span>
                                    <strong style={{ color: r.color || 'var(--text-primary)', fontSize: r.bold ? '1rem' : '0.9rem' }}>{r.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                    )
                })()}
            </Modal>

            {/* ── Sales Invoice Modal ── */}
            <Modal isOpen={receiptModal} onClose={() => setReceiptModal(false)} title={receiptSale?.isPaid ? "Sales Invoice" : "Order Slip (Pending)"} narrow
                footer={
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReceiptModal(false)}>Close</button>
                        <button className="btn btn-primary" style={{ flex: 1, gap: 6 }} onClick={() => window.print()}>
                            <Printer size={15} /> Print Invoice
                        </button>
                    </div>
                }>
                {receiptSale && (
                    <div className="receipt" style={{ padding: '8px 4px', fontSize: '0.85rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: 12 }}>
                            <strong style={{ fontSize: '1.25rem', letterSpacing: '0.05em', color: '#000', display: 'block', textTransform: 'uppercase' }}>
                                {settings?.store_name || 'COMODA RESTAURANT'}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                                {receiptSale.isPaid ? 'SALES INVOICE' : 'ORDER SLIP (UNPAID)'}
                            </div>
                        </div>

                        <hr className="receipt-divider" />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                            <span style={{ fontWeight: 700 }}>Txn ID:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--brown-800)' }}>
                                {receiptSale.transactionId || receiptSale.transaction_id || ('#' + String(receiptSale.id).padStart(4, '0'))}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                            <span>Order ID: #{receiptSale.orderId || receiptSale.order_id}</span>
                            <span>Date: {fmtDate(receiptSale.date)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                            <span>Cashier: {receiptSale.cashier || '—'}</span>
                            <span>Time: {fmtTime(receiptSale.time)}</span>
                        </div>
                        {receiptSale.tableNumber && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                                <span>Table #: {receiptSale.tableNumber}</span>
                                <span>Type: {receiptSale.orderType || 'Dine In'}</span>
                            </div>
                        )}

                        <hr className="receipt-divider" />

                        <div style={{ margin: '8px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.78rem', color: '#555', marginBottom: 6, textTransform: 'uppercase' }}>
                                <span>Item &amp; Qty</span>
                                <span>Amount</span>
                            </div>
                            {(receiptSale.items || []).map((i, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                    <span style={{ wordBreak: 'break-word', paddingRight: 8 }}>
                                        {i.name} <span style={{ color: '#666', fontWeight: 600 }}>×{i.quantity}</span>
                                    </span>
                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {fmt(i.price * i.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {Number(receiptSale.discount || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 3, color: 'var(--danger)' }}>
                                <span>Discount</span>
                                <span>-{fmt(receiptSale.discount)}</span>
                            </div>
                        )}

                        <hr className="receipt-divider" />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, margin: '6px 0' }}>
                            <span>TOTAL</span>
                            <strong style={{ color: '#000' }}>{fmt(receiptSale.total)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: 4 }}>
                            <span style={{ color: '#555' }}>Payment Method</span>
                            <strong style={{ textTransform: 'uppercase' }}>{receiptSale.paymentMethod || 'Cash'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: 2 }}>
                            <span style={{ color: '#555' }}>Payment Status</span>
                            <strong style={{ color: receiptSale.isPaid ? '#16a34a' : '#d97706' }}>
                                {receiptSale.isPaid ? 'PAID' : 'PENDING'}
                            </strong>
                        </div>

                        {(receiptSale.paymentMethod === 'Online Payment' || receiptSale.paymentMethod === 'Card') ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 4 }}>
                                <span>Amount Paid</span>
                                <strong>{fmt(receiptSale.amountReceived ?? receiptSale.amount_received ?? receiptSale.total)}</strong>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 4 }}>
                                    <span>Amount Received</span>
                                    <span>{fmt(receiptSale.amountReceived ?? receiptSale.amount_received ?? 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 2 }}>
                                    <span>Change Given</span>
                                    <span style={{ fontWeight: 700 }}>{fmt(receiptSale.change ?? receiptSale.change_amount ?? 0)}</span>
                                </div>
                            </>
                        )}

                        <hr className="receipt-divider" />

                        <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.8rem', marginTop: 10, color: '#666', lineHeight: 1.4 }}>
                            {settings?.receipt_footer || 'Thank you for dining with us! Please come again.'}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
