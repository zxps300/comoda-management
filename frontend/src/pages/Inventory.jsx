import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import { inventoryService } from '../services/inventory.service'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/ui/Modal'
import {
    Plus, Search, Package, AlertTriangle,
    Pencil, Trash2, ArrowUp, ArrowDown,
    History, ImageIcon, X, Upload, ExternalLink, FileText,
    ChevronDown, ChevronRight, Clock, Layers, Banknote,
    RefreshCw, CheckCircle, List, Calculator,
    Utensils, Bell
} from 'lucide-react'
import { fundRequestService } from '../services/fundRequest.service'

const UNITS = ['kg', 'liters', 'pcs', 'packs', 'boxes', 'bottles']
const CATEGORIES = ['Meats', 'Vegetables&Fruits', 'Drinks&Wine', 'For Baking', 'Grains', 'Condiments', 'Others']
const BLANK = { name: '', category: 'Meats', unit: 'kg', quantity: 0, min_stock: 5, expires_at: '' }
const SHOW_INTERNAL_STOCK_ENTRIES = false

const formatStockTimestamp = (value) => {
    if (!value) return 'Timestamp unavailable'
    const timestamp = new Date(value)
    if (Number.isNaN(timestamp.getTime())) return value

    return timestamp.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

function NumericKeypad({
    onAppend,
    onBackspace,
    onClear,
    allowDecimal = true,
    label,
    value,
    unit,
    onDone,
    id,
}) {
    const keypadRef = useRef(null)
    const keys = allowDecimal
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0]

    useEffect(() => {
        if (!label) return undefined

        const frame = requestAnimationFrame(() => {
            keypadRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })

        return () => cancelAnimationFrame(frame)
    }, [label])

    return (
        <div
            id={id}
            ref={keypadRef}
            className={`inventory-number-keypad ${label ? 'inventory-number-keypad-popup' : ''}`}
            role="group"
            aria-label={label ? `Numeric keypad for ${label}` : 'Numeric keypad'}
            onPointerDown={(event) => event.preventDefault()}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && onDone) {
                    event.preventDefault()
                    event.stopPropagation()
                    onDone()
                }
            }}
        >
            {label && (
                <div className="inventory-number-keypad-header">
                    <div>
                        <span>Entering</span>
                        <strong>{label}</strong>
                    </div>
                    <output aria-live="polite">
                        {value ?? 0} <small>{unit}</small>
                    </output>
                </div>
            )}

            <div className="inventory-number-keypad-grid">
                {keys.map(key => key === 'clear' ? (
                    <button
                        key="clear"
                        type="button"
                        className="inventory-number-key inventory-number-key-clear"
                        onClick={onClear}
                        aria-label="Clear value"
                    >
                        Clear
                    </button>
                ) : (
                    <button
                        key={key}
                        type="button"
                        className="inventory-number-key"
                        onClick={() => onAppend(String(key))}
                        aria-label={key === '.' ? 'Decimal point' : `Number ${key}`}
                    >
                        {key}
                    </button>
                ))}
                <button
                    type="button"
                    className="inventory-number-key inventory-number-key-backspace"
                    onClick={onBackspace}
                    aria-label="Backspace"
                >
                    ⌫
                </button>
            </div>

            {allowDecimal && (
                <button type="button" className="inventory-number-keypad-clear" onClick={onClear}>
                    Clear Input
                </button>
            )}

            {onDone && (
                <button type="button" className="inventory-number-keypad-done" onClick={onDone}>
                    Done
                </button>
            )}
        </div>
    )
}

export default function Inventory() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [activeTab, setActiveTab] = useState(user?.role === 'Kitchen Staff' ? 'usage' : 'all')
    const [catFilter, setCatFilter] = useState('All')
    const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
    const categoryMenuRef = useRef(null)

    // Modal states
    const [modal, setModal] = useState(false)
    const [stockModal, setStockModal] = useState(false)
    const [editing, setEditing] = useState(null)

    // Form states
    const [form, setForm] = useState(BLANK)
    const [itemKeypadField, setItemKeypadField] = useState(null)
    const itemKeypadReplaceRef = useRef(true)
    const [stockForm, setStockForm] = useState({ itemId: '', type: 'in', quantity: '', reason: '', expiresAt: '' })

    // Internal restock records remain available for expiry/audit processing,
    // but their queue is intentionally hidden from the simplified UI.
    const [expandedItem, setExpandedItem] = useState(null)
    const [batches, setBatches] = useState({})
    const [loadingBatches, setLoadingBatches] = useState({})

    // Receipt upload state
    const [receipt, setReceipt] = useState(null)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef(null)

    // Item name dropdown state
    const [nameDropdownOpen, setNameDropdownOpen] = useState(false)
    const [nameSearch, setNameSearch] = useState('')

    // Fund Request states
    const [fundRequests, setFundRequests] = useState([])
    const [fundModal, setFundModal] = useState(false)
    const [fundForm, setFundForm] = useState({ requested_amount: '', items_list: [], items_data: {}, notes: '' })
    const [liquidateModal, setLiquidateModal] = useState(false)
    const [liquidateForm, setLiquidateForm] = useState({ spent_amount: '', receipt: null, purchased_items: {} })
    const [selectedFundReq, setSelectedFundReq] = useState(null)
    const liquidateFileRef = useRef(null)

    const load = () => {
        setLoading(true)
        Promise.all([
            inventoryService.getAll().then(setItems).catch(() => toast('Failed to load inventory', 'error')),
            fundRequestService.getAll().then(setFundRequests).catch(() => toast('Failed to load fund requests', 'error'))
        ]).finally(() => setLoading(false))
    }

    useEffect(load, [toast])

    // Keep the stock cards current while Cashier orders and other kitchen stations
    // consume ingredients. This is a silent data sync; the page and open filters
    // stay in place instead of forcing the user to reload the browser.
    useEffect(() => {
        let active = true

        const refreshStock = () => {
            if (document.hidden) return
            inventoryService.getAll()
                .then((data) => {
                    if (active) setItems(data)
                })
                .catch(() => { })
        }

        const handleVisibilityChange = () => {
            if (!document.hidden) refreshStock()
        }
        const handleStockChanged = (event) => {
            if (!event || !('key' in event) || event.key === 'comoda_inventory_changed_at') refreshStock()
        }

        const interval = window.setInterval(refreshStock, 2000)
        window.addEventListener('focus', refreshStock)
        window.addEventListener('storage', handleStockChanged)
        window.addEventListener('comoda:inventory-changed', handleStockChanged)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            active = false
            window.clearInterval(interval)
            window.removeEventListener('focus', refreshStock)
            window.removeEventListener('storage', handleStockChanged)
            window.removeEventListener('comoda:inventory-changed', handleStockChanged)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    useEffect(() => {
        if (user?.role && user.role !== 'Kitchen Staff' && activeTab === 'usage') {
            setActiveTab('all')
        }
    }, [user?.role, activeTab])

    useEffect(() => {
        if (!categoryMenuOpen) return undefined

        const closeCategoryMenu = (event) => {
            if (!categoryMenuRef.current?.contains(event.target)) setCategoryMenuOpen(false)
        }
        const closeCategoryMenuOnEscape = (event) => {
            if (event.key === 'Escape') setCategoryMenuOpen(false)
        }

        document.addEventListener('pointerdown', closeCategoryMenu)
        document.addEventListener('keydown', closeCategoryMenuOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeCategoryMenu)
            document.removeEventListener('keydown', closeCategoryMenuOnEscape)
        }
    }, [categoryMenuOpen])

    const getStatus = (item) => {
        if (item.quantity <= 0) return 'Out'
        if (item.quantity <= item.min_stock) return 'Low'
        return 'OK'
    }

    const isExpiringSoon = (item) => {
        return item.next_expiration_days !== null
            && item.next_expiration_days !== undefined
            && item.next_expiration_days <= 3
    }

    const filtered = useMemo(() => {
        return items
            .filter((i) => [i.name, i.category, i.unit].join(' ').toLowerCase().includes(search.toLowerCase()))
            .filter((i) => {
                if (statusFilter === 'all') return true
                if (statusFilter === 'expired') return Number(i.expired_stock_quantity) > 0
                if (statusFilter === 'expiring') return isExpiringSoon(i)
                return getStatus(i).toLowerCase() === statusFilter
            })
            .filter((i) => catFilter === 'All' || i.category === catFilter)
    }, [items, search, statusFilter, catFilter])

    const openAdd = () => {
        setEditing(null)
        setForm(BLANK)
        setItemKeypadField(null)
        itemKeypadReplaceRef.current = true
        setModal(true)
    }
    const openEdit = (item) => {
        setEditing(item)
        setForm({ ...item })
        setItemKeypadField(null)
        itemKeypadReplaceRef.current = true
        setModal(true)
    }

    const openStock = (item, type) => {
        setStockForm({ itemId: item.id, type, quantity: '', reason: '', expiresAt: '' })
        setReceipt(null)
        setStockModal(true)
    }

    const toggleBatches = async (item) => {
        if (expandedItem === item.id) {
            setExpandedItem(null)
            return
        }
        setExpandedItem(item.id)
        if (!batches[item.id]) {
            setLoadingBatches(prev => ({ ...prev, [item.id]: true }))
            try {
                const data = await inventoryService.getBatches(item.id)
                setBatches(prev => ({ ...prev, [item.id]: data }))
            } catch {
                toast('Failed to load stock history', 'error')
            } finally {
                setLoadingBatches(prev => ({ ...prev, [item.id]: false }))
            }
        }
    }

    const save = async (e) => {
        e.preventDefault()
        if (!form.name || !form.category || !form.unit) {
            toast('Name, category, and unit are required', 'warning'); return
        }
        setSaving(true)
        try {
            if (editing) {
                await inventoryService.update(editing.id, form)
                toast('Item updated', 'success')
            } else {
                await inventoryService.create(form)
                toast(form.quantity > 0 ? 'Item created with timestamped stock' : 'Item created', 'success')
            }
            setModal(false)
            load()
        } catch (err) {
            toast(err.response?.data?.message || 'Error saving item', 'error')
        } finally {
            setSaving(false)
        }
    }

    const saveStock = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const qty = parseFloat(stockForm.quantity)
            if (!qty || qty <= 0) {
                toast('Please enter a valid quantity', 'warning')
                setSaving(false)
                return
            }
            const formData = new FormData()
            formData.append('item_id', stockForm.itemId)
            formData.append('type', stockForm.type)
            formData.append('quantity', qty)
            formData.append('reason', stockForm.reason)
            if (stockForm.type === 'in' && stockForm.expiresAt) {
                formData.append('expires_at', stockForm.expiresAt)
            }
            formData.append('performed_by', user?.fullName || 'System')
            if (stockForm.type === 'in' && receipt) {
                formData.append('receipt', receipt)
            }
            await inventoryService.stockAdjust(formData)
            localStorage.setItem('comoda_inventory_changed_at', String(Date.now()))
            window.dispatchEvent(new Event('comoda:inventory-changed'))
            toast(`Stock ${stockForm.type === 'in' ? 'added' : 'removed'} successfully`, 'success')
            setStockModal(false)
            load()
        } catch (err) {
            toast(err.response?.data?.message || 'Error adjusting stock', 'error')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (item) => {
        if (!window.confirm(`Delete ${item.name}?`)) return
        try {
            await inventoryService.delete(item.id)
            toast('Item deleted', 'success')
            load()
        } catch {
            toast('Error deleting item', 'error')
        }
    }

    const appendToQty = (char) => {
        setStockForm(prev => {
            const current = String(prev.quantity || '');
            if (char === '.' && current.includes('.')) return prev;
            return { ...prev, quantity: current + char };
        });
    };

    const backspaceQty = () => {
        setStockForm(prev => ({ ...prev, quantity: String(prev.quantity || '').slice(0, -1) }));
    };

    const clearQty = () => {
        setStockForm(prev => ({ ...prev, quantity: '' }));
    };

    const expireBatch = async (batchId, itemId) => {
        if (!window.confirm('Move this stock entry to Expired Stock? It will no longer be usable for orders.')) return
        await inventoryService.expireBatch(batchId, 'Marked expired during stock inspection')
        setBatches(prev => { const next = { ...prev }; delete next[itemId]; return next })
        load()
    }

    const disposeBatch = async (batchId, itemId) => {
        const reason = window.prompt('Reason for disposal:', 'Expired stock discarded')
        if (!reason?.trim()) return
        await inventoryService.disposeBatch(batchId, reason.trim())
        const data = await inventoryService.getBatches(itemId)
        setBatches(prev => ({ ...prev, [itemId]: data }))
        load()
    }

    const openItemKeypad = (field) => {
        setItemKeypadField(current => {
            if (current !== field) itemKeypadReplaceRef.current = true
            return field
        })
    }

    const appendToItemNumber = (digit) => {
        if (!itemKeypadField) return

        setForm(prev => {
            const current = String(prev[itemKeypadField] ?? 0)
            const next = itemKeypadReplaceRef.current || current === '0'
                ? digit
                : `${current}${digit}`

            itemKeypadReplaceRef.current = false
            return {
                ...prev,
                [itemKeypadField]: Number(next.slice(0, 9)),
            }
        })
    }

    const backspaceItemNumber = () => {
        if (!itemKeypadField) return

        setForm(prev => {
            const current = String(prev[itemKeypadField] ?? 0)
            const next = current.length > 1 ? current.slice(0, -1) : '0'
            itemKeypadReplaceRef.current = false
            return { ...prev, [itemKeypadField]: Number(next) }
        })
    }

    const clearItemNumber = () => {
        if (!itemKeypadField) return
        setForm(prev => ({ ...prev, [itemKeypadField]: 0 }))
        itemKeypadReplaceRef.current = true
    }

    const handleItemNumberKeyDown = (event, field) => {
        if (/^\d$/.test(event.key)) {
            event.preventDefault()
            openItemKeypad(field)
            appendToItemNumber(event.key)
            return
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault()
            openItemKeypad(field)
            event.key === 'Delete' ? clearItemNumber() : backspaceItemNumber()
            return
        }

        if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setItemKeypadField(null)
        }
    }

    const handleCreateFundRequest = async (e) => {
        e.preventDefault()
        if (!fundForm.requested_amount || !fundForm.items_list || fundForm.items_list.length === 0) {
            toast('Amount and Items are required', 'warning'); return
        }
        setSaving(true)
        try {
            // Updated to send structured list
            const structuredItems = fundForm.items_list.map(name => {
                const data = fundForm.items_data[name] || {};
                const itemObj = items.find(i => i.name === name);
                return {
                    inventory_item_id: itemObj?.id,
                    name: name,
                    qty: data.qty || 1,
                    unit: itemObj?.unit || '',
                    supplier: data.supplier || '',
                    est_cost: data.est_cost || 0
                };
            });

            // For backward compatibility and display, we still combine into strings
            const combinedItems = structuredItems.map(si => `${si.qty} ${si.unit} ${si.name} (from ${si.supplier || 'any'})`);

            await fundRequestService.create({
                purchaser_name: user?.fullName || 'Purchaser',
                requested_amount: fundForm.requested_amount,
                items_list: combinedItems, // Still sending for general logs
                items_structured: structuredItems, // The new detailed list
                notes: fundForm.notes
            })
            toast('Fund request submitted', 'success')
            setFundModal(false)
            setFundForm({ requested_amount: '', items_list: [], items_data: {}, notes: '' })
            load()
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to submit request', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleLiquidate = async (e) => {
        e.preventDefault()
        if (!liquidateForm.spent_amount) {
            toast('Actual spent amount is required', 'warning'); return
        }
        setSaving(true)
        try {
            const formData = new FormData()
            formData.append('spent_amount', liquidateForm.spent_amount)
            if (liquidateForm.receipt) formData.append('receipt', liquidateForm.receipt)

            // Prepare purchased_items array for the backend
            const purchasedItems = Object.keys(liquidateForm.purchased_items).map(itemId => ({
                inventory_item_id: itemId,
                qty: liquidateForm.purchased_items[itemId].qty,
                cost: liquidateForm.purchased_items[itemId].cost,
                supplier: liquidateForm.purchased_items[itemId].supplier
            }));
            formData.append('purchased_items', JSON.stringify(purchasedItems))

            await fundRequestService.liquidate(selectedFundReq.id, formData)
            localStorage.setItem('comoda_inventory_changed_at', String(Date.now()))
            window.dispatchEvent(new Event('comoda:inventory-changed'))
            toast('Restock saved and menu availability updated.', 'success')
            setLiquidateModal(false)
            load()
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to submit liquidation', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleManagerReview = async (id, action) => {
        setSaving(true)
        try {
            await fundRequestService.managerApprove(id, action)
            toast(`Overspend ${action === 'approve' ? 'approved' : 'rejected'}`, 'success')
            load()
        } catch {
            toast('Action failed', 'error')
        } finally {
            setSaving(false)
        }
    }

    const expiringSoonCount = items.filter(i => isExpiringSoon(i)).length
    const expiredStockCount = items.filter(i => Number(i.expired_stock_quantity) > 0).length
    const restockItems = items.filter(item => ['Low', 'Out'].includes(getStatus(item)))

    // Timer for the header
    const [currentTime, setCurrentTime] = useState(new Date())
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className={`inventory-page ${user?.role === 'Purchaser' ? 'purchaser-workspace' : ''} ${user?.role === 'Kitchen Staff' ? 'kitchen-inventory-workspace' : ''}`}>
            {/* Stitch Global Header */}
            <header className="stitch-header">
                <div className="stitch-header-left">
                    <div className="stitch-header-icon">
                        <Utensils size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="stitch-header-title">
                            Inventory Management
                            <span className="stitch-live-sync">
                                <span className="stitch-live-dot"></span> Live Sync
                            </span>
                        </h1>
                        <p className="stitch-header-subtitle">Track ingredients, stock alerts, and kitchen replenishment</p>
                    </div>
                </div>
                <div className="stitch-header-right">
                    <div className="stitch-header-date">
                        <strong>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <button className="stitch-btn-icon" aria-label="Notifications">
                        <Bell size={18} strokeWidth={2.5} />
                    </button>
                    {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                        <button className="stitch-btn-primary" onClick={openAdd}>
                            <Plus size={18} strokeWidth={2.5} /> Add Item
                        </button>
                    )}
                    <div className="stitch-avatar">
                        {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD'}
                    </div>
                </div>
            </header>

            {/* Summary strip */}
            <div className="inventory-summary-grid">
                {(() => {
                    const totalCount = items.length
                    const healthyCount = items.filter((i) => getStatus(i) === 'OK').length
                    const lowCount = items.filter((i) => getStatus(i) === 'Low').length
                    const outCount = items.filter((i) => getStatus(i) === 'Out').length
                    const categoryCount = new Set(items.map(i => i.category)).size
                    const healthyPct = totalCount > 0 ? ((healthyCount / totalCount) * 100).toFixed(1) : '0.0'
                    const firstLowItem = items.find(i => getStatus(i) === 'Low')

                    const cards = [
                        { label: 'Total Items', value: totalCount, theme: 'card-theme-blue', filter: 'all', icon: Package, footer: <><span className="summary-footer-highlight">{categoryCount} Categories</span> tracked</> },
                        { label: 'Healthy Stock', value: healthyCount, theme: 'card-theme-emerald', filter: 'ok', icon: CheckCircle, footer: <><span>{healthyPct}%</span> of full inventory</> },
                        { label: 'Low Stock', value: lowCount, theme: 'card-theme-amber', filter: 'low', icon: AlertTriangle, footer: firstLowItem ? <><span>Action required: {firstLowItem.name}</span></> : 'All items stocked' },
                        { label: 'Out of Stock', value: outCount, theme: 'card-theme-rose', filter: 'out', icon: X, footer: outCount === 0 ? 'No critical outages' : `${outCount} item${outCount !== 1 ? 's' : ''} need restocking` },
                        { label: 'Expiring Soon', value: expiringSoonCount, theme: 'card-theme-orange', filter: 'expiring', icon: Clock, footer: 'Within next 48 hrs' },
                        { label: 'Expired Stock', value: expiredStockCount, theme: 'card-theme-gray', filter: 'expired', icon: AlertTriangle, footer: expiredStockCount === 0 ? 'Zero waste recorded' : `${expiredStockCount} batch${expiredStockCount !== 1 ? 'es' : ''} expired` },
                    ]

                    return cards.map((s) => (
                        <button
                            key={s.label}
                            className={`inventory-summary-card ${s.theme} ${statusFilter === s.filter ? 'active' : ''}`}
                            onClick={() => setStatusFilter(prev => prev === s.filter ? 'all' : s.filter)}
                        >
                            <div className="summary-top" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className="inventory-summary-icon"><s.icon size={20} strokeWidth={2} /></span>
                                <span className="inventory-summary-copy">
                                    <strong className="summary-val">{s.value}</strong>
                                    <small className="summary-label">{s.label}</small>
                                </span>
                            </div>
                            <div className="summary-footer inventory-summary-footer" style={{ marginTop: 12, fontSize: '0.68rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {s.footer}
                            </div>
                        </button>
                    ))
                })()}
            </div>

            <div className="card inventory-workspace-card">
                <div className="stitch-controls-wrapper">
                    {/* Top Row: Tabs and Actions */}
                    <div className="stitch-controls-top">
                        <div className="stitch-tabs-container">
                            <button
                                className={`stitch-tab ${activeTab === 'all' && catFilter === 'All' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('all'); setCatFilter('All'); }}
                            >
                                <Package size={16} /> All Items <span className="stitch-tab-badge">{items.length}</span>
                            </button>
                            {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                                <button
                                    className={`stitch-tab ${activeTab === 'requests' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('requests')}
                                >
                                    <Banknote size={16} /> Fund Requests
                                </button>
                            )}
                            <button
                                className={`stitch-tab alert-tab ${statusFilter === 'low' ? 'active' : ''}`}
                                onClick={() => setStatusFilter(prev => prev === 'low' ? 'all' : 'low')}
                            >
                                <AlertTriangle size={16} /> Low Stock Alert
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', marginLeft: 4 }}></span>
                            </button>
                        </div>
                        <div className="stitch-controls-actions">
                            <button className="stitch-btn-outline"><Upload size={16} style={{ transform: 'rotate(180deg)' }} /> Export CSV</button>
                            <button className="stitch-btn-outline"><FileText size={16} /> Print Sheet</button>
                        </div>
                    </div>

                    {/* Bottom Row: Search and Dropdowns */}
                    {activeTab !== 'requests' && (
                        <div className="stitch-controls-bottom">
                            <div className="stitch-search">
                                <Search size={16} className="stitch-search-icon" />
                                <input
                                    className="stitch-search-input"
                                    placeholder="Search item name, SKU, or category..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, color: '#9ca3af' }}>⌘K</div>
                            </div>
                            <div className="stitch-select-wrapper">
                                <select className="stitch-select" value={catFilter} onChange={(e) => { setActiveTab('all'); setCatFilter(e.target.value); }}>
                                    <option value="All">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown size={14} className="stitch-select-chevron" />
                            </div>
                            <div className="stitch-select-wrapper">
                                <select className="stitch-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="all">All Statuses</option>
                                    <option value="ok">Healthy</option>
                                    <option value="low">Low Stock</option>
                                    <option value="out">Out of Stock</option>
                                </select>
                                <ChevronDown size={14} className="stitch-select-chevron" />
                            </div>
                        </div>
                    )}
                </div>

                {loading ? <div className="loading"><div className="spinner" /></div> : (
                    activeTab === 'requests' ? (
                        <div className="table-wrapper inventory-table-wrapper">
                            <table className="inventory-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Requested Amt.</th>
                                        <th>Released Amt.</th>
                                        <th>Status</th>
                                        <th>Items to Buy</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fundRequests.length === 0 ? (
                                        <tr><td colSpan="6"><div className="empty-state">No fund requests found</div></td></tr>
                                    ) : fundRequests.filter(req => user?.role === 'Purchaser' ? req.purchaser_name === user?.fullName : true).map((req) => (
                                        <tr key={req.id}>
                                            <td data-label="Date">{new Date(req.created_at).toLocaleDateString()}</td>
                                            <td data-label="Requested">₱{parseFloat(req.requested_amount).toFixed(2)}</td>
                                            <td data-label="Released">{req.released_amount ? `₱${parseFloat(req.released_amount).toFixed(2)}` : '-'}</td>
                                            <td data-label="Status">
                                                {req.status === 'pending' && <span className="badge badge-warning"><Clock size={12} /> Pending</span>}
                                                {req.status === 'manager_review' && <span className="badge badge-error" style={{ background: '#fef3c7', color: '#92400e' }}><AlertTriangle size={12} /> Overspent - Needs Review</span>}
                                                {req.status === 'released' && <span className="badge badge-error"><AlertTriangle size={12} /> Needs Liquidation</span>}
                                                {req.status === 'liquidating' && <span className="badge badge-info"><RefreshCw size={12} /> Awaiting confirmation</span>}
                                                {req.status === 'completed' && <span className="badge badge-success"><CheckCircle size={12} /> Completed</span>}
                                            </td>
                                            <td data-label="Items">
                                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.85rem' }}>
                                                    {req.items_list.map((it, i) => <li key={i}>{it}</li>)}
                                                </ul>
                                            </td>
                                            <td data-label="Actions">
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {req.status === 'manager_review' && (user?.role === 'Admin') && (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn btn-primary btn-sm" onClick={() => handleManagerReview(req.id, 'approve')}>Approve</button>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => handleManagerReview(req.id, 'reject')}>Reject</button>
                                                        </div>
                                                    )}
                                                    {req.status === 'released' && (
                                                        <button className="btn btn-warning btn-sm" onClick={() => {
                                                            setSelectedFundReq(req)
                                                            setLiquidateForm({ spent_amount: '', receipt: null, purchased_items: {} })
                                                            setLiquidateModal(true)
                                                        }}>
                                                            Submit Report
                                                        </button>
                                                    )}
                                                    {req.status === 'completed' && req.receipt_url && (
                                                        <a href={req.receipt_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                                                            <FileText size={14} /> Receipt
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'all' ? (
                        <div className="stitch-table-wrapper">
                            <table className="stitch-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Stock</th>
                                        <th>Unit</th>
                                        <th>Min. Level</th>
                                        <th>Last Updated</th>
                                        <th style={{ textAlign: 'center' }}>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={7}><div className="empty-state"><Package size={36} /><h3>No items found</h3></div></td></tr>
                                    ) : (() => {
                                        // Group filtered items by category, preserving CATEGORIES order
                                        const grouped = CATEGORIES.reduce((acc, cat) => {
                                            const catItems = filtered.filter(i => i.category === cat)
                                            if (catItems.length > 0) acc.push({ cat, items: catItems })
                                            return acc
                                        }, [])
                                        // Add any items whose category doesn't match the predefined list
                                        const knownCats = new Set(CATEGORIES)
                                        const otherItems = filtered.filter(i => !knownCats.has(i.category))
                                        if (otherItems.length > 0) grouped.push({ cat: 'Others', items: otherItems })

                                        return grouped.map(({ cat, items: catItems }) => (
                                            <Fragment key={`group-${cat}`}>
                                                {/* ── Category header row ── */}
                                                <tr>
                                                    <td colSpan={7} style={{ padding: '16px 24px 8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <span className="stitch-cat-banner">
                                                                <Package size={14} style={{ color: '#d97706' }} />
                                                                {cat}
                                                            </span>
                                                            <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 500 }}>
                                                                {catItems.length} items tracked
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* ── Items in this category ── */}
                                                {catItems.map((item) => {
                                                    const status = getStatus(item)
                                                    const isExpanded = expandedItem === item.id
                                                    const itemBatchData = batches[item.id] || { active: [], expired: [] }
                                                    const itemBatches = Array.isArray(itemBatchData) ? itemBatchData : (itemBatchData.active || [])
                                                    const expiredBatches = Array.isArray(itemBatchData) ? [] : (itemBatchData.expired || [])

                                                    return (
                                                        <Fragment key={item.id}>
                                                            <tr className={`stitch-row ${status === 'Low' ? 'stitch-row-low' : ''}`}>
                                                                {/* Expand toggle */}
                                                                <td style={{ display: 'none' }} aria-hidden="true">
                                                                    <button
                                                                        onClick={() => toggleBatches(item)}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                                                                        title="View FIFO batches"
                                                                    >
                                                                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                                    </button>
                                                                </td>
                                                                <td data-label="Item" style={{ paddingLeft: 24 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        {status === 'Low' && <span className="stitch-pill-dot stitch-pill-dot-low" style={{ animation: 'pulse 2s infinite' }}></span>}
                                                                        <div>
                                                                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.875rem' }}>{item.name}</div>
                                                                            <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#6b7280', fontWeight: 500, marginTop: 2 }}>{item.category}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td data-label="Stock">
                                                                    <strong style={{ fontSize: '1rem', fontWeight: 700, color: status === 'Out' ? '#e11d48' : status === 'Low' ? '#d97706' : '#059669' }}>
                                                                        {item.quantity}
                                                                    </strong>
                                                                </td>
                                                                <td data-label="Unit" style={{ fontWeight: 500, color: '#4b5563', fontSize: '0.875rem' }}>{item.unit}</td>
                                                                <td data-label="Min. Level" style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{item.min_stock}</td>

                                                                <td data-label="Last Updated">
                                                                    {item.last_stock_movement_at ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                                                <Clock size={13} /> {formatStockTimestamp(item.last_stock_movement_at)}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', textTransform: 'capitalize' }}>
                                                                                {item.last_stock_movement_type === 'in' ? 'Stock added' : item.last_stock_movement_type === 'out' ? 'Stock deducted' : 'Item updated'}
                                                                            </span>
                                                                        </div>
                                                                    ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>No activity yet</span>}
                                                                </td>

                                                                <td data-label="Status" style={{ textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                                                        <div className={`stitch-pill-${status.toLowerCase()}`}>
                                                                            <div className={`stitch-pill-dot stitch-pill-dot-${status.toLowerCase()}`} />
                                                                            {status}
                                                                        </div>
                                                                        {SHOW_INTERNAL_STOCK_ENTRIES && item.fifo_alert && (
                                                                            <span style={{
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: 700,
                                                                                background: '#ede9fe',
                                                                                color: '#7c3aed',
                                                                                padding: '2px 6px',
                                                                                borderRadius: 10,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: 3,
                                                                                width: 'fit-content'
                                                                            }}>
                                                                                <AlertTriangle size={9} /> FIFO Alert
                                                                            </span>
                                                                        )}
                                                                        {isExpiringSoon(item) && (
                                                                            <span style={{
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: 700,
                                                                                background: '#fff7ed',
                                                                                color: '#ea580c',
                                                                                padding: '2px 6px',
                                                                                borderRadius: 10,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: 3,
                                                                                width: 'fit-content'
                                                                            }}>
                                                                                <Clock size={9} /> Expiring Soon
                                                                            </span>
                                                                        )}
                                                                        {item.expired_stock_entry_count > 0 && (
                                                                            <span style={{
                                                                                fontSize: '0.65rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c',
                                                                                padding: '2px 6px', borderRadius: 10, width: 'fit-content'
                                                                            }}>
                                                                                {item.expired_stock_quantity} {item.unit} expired stock separated
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td data-label="Actions" style={{ paddingRight: 24 }}>
                                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                                                        {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                                                                            <button
                                                                                onClick={() => openStock(item, 'in')}
                                                                                title="Add Stock"
                                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#059669', color: '#fff', border: 'none', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', transition: 'background .15s' }}
                                                                                onMouseEnter={e => e.currentTarget.style.background = '#047857'}
                                                                                onMouseLeave={e => e.currentTarget.style.background = '#059669'}
                                                                            >
                                                                                <ArrowUp size={12} strokeWidth={2.5} /> In
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => openStock(item, 'out')}
                                                                            title="Deduct Stock"
                                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', transition: 'background .15s' }}
                                                                            onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
                                                                            onMouseLeave={e => e.currentTarget.style.background = '#fffbeb'}
                                                                        >
                                                                            <ArrowDown size={12} strokeWidth={2.5} /> Out
                                                                        </button>
                                                                        {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                                                                            <button
                                                                                onClick={() => openEdit(item)}
                                                                                title="Edit Item"
                                                                                style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', transition: 'all .15s' }}
                                                                                onMouseEnter={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#f3f4f6' }}
                                                                                onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none' }}
                                                                            >
                                                                                <Pencil size={14} />
                                                                            </button>
                                                                        )}
                                                                        {user?.role === 'Admin' && (
                                                                            <button
                                                                                onClick={() => remove(item)}
                                                                                title="Remove Item"
                                                                                style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', transition: 'all .15s' }}
                                                                                onMouseEnter={e => { e.currentTarget.style.color = '#e11d48'; e.currentTarget.style.background = '#fff1f2' }}
                                                                                onMouseLeave={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'none' }}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {/* FIFO Batch Expansion Row */}
                                                            {SHOW_INTERNAL_STOCK_ENTRIES && isExpanded && (
                                                                <tr key={`${item.id}-batches`}>
                                                                    <td colSpan={8} style={{ padding: 0, borderBottom: '2px solid #a78bfa' }}>
                                                                        <div style={{
                                                                            background: 'linear-gradient(to right, #faf5ff, #f5f3ff)',
                                                                            padding: '14px 24px 14px 48px',
                                                                            borderTop: '1px solid #ddd6fe'
                                                                        }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                                                                <Layers size={15} color="#7c3aed" />
                                                                                <strong style={{ fontSize: '0.85rem', color: '#5b21b6' }}>
                                                                                    FIFO Batch Queue — {item.name} (oldest → newest)
                                                                                </strong>
                                                                            </div>

                                                                            {loadingBatches[item.id] ? (
                                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading batches...</div>
                                                                            ) : itemBatches.length === 0 ? (
                                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                                    No active batches. Add stock (Stock In) to create FIFO batches.
                                                                                </div>
                                                                            ) : (
                                                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                                                    {itemBatches.map((batch, idx) => (
                                                                                        <div key={batch.id} style={{
                                                                                            background: '#fff',
                                                                                            border: `1.5px solid ${batch.fifo_alert ? '#a78bfa' : '#ddd6fe'}`,
                                                                                            borderRadius: 8,
                                                                                            padding: '10px 14px',
                                                                                            minWidth: 160,
                                                                                            position: 'relative'
                                                                                        }}>
                                                                                            {/* FIFO order badge */}
                                                                                            <div style={{
                                                                                                position: 'absolute',
                                                                                                top: -8,
                                                                                                left: 10,
                                                                                                background: idx === 0 ? '#7c3aed' : '#c4b5fd',
                                                                                                color: '#fff',
                                                                                                fontSize: '0.6rem',
                                                                                                fontWeight: 700,
                                                                                                padding: '1px 6px',
                                                                                                borderRadius: 8
                                                                                            }}>
                                                                                                {idx === 0
                                                                                                    ? `▶ CONSUMING NOW · Batch #${batch.id}`
                                                                                                    : `FIFO #${idx + 1} · Batch #${batch.id}`}
                                                                                            </div>

                                                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                                                                <Clock size={11} style={{ marginRight: 4 }} />
                                                                                                {formatStockTimestamp(batch.received_at || batch.purchased_at)}
                                                                                            </div>
                                                                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#5b21b6', margin: '4px 0' }}>
                                                                                                {batch.quantity_remaining} {item.unit}
                                                                                            </div>
                                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                                                of {batch.quantity_received} {item.unit} received
                                                                                            </div>
                                                                                            <div style={{
                                                                                                marginTop: 6,
                                                                                                fontSize: '0.7rem',
                                                                                                fontWeight: 600,
                                                                                                color: batch.fifo_alert ? '#7c3aed' : 'var(--text-muted)'
                                                                                            }}>
                                                                                                {batch.days_old === 0 ? 'Today' : `${batch.days_old} day${batch.days_old > 1 ? 's' : ''} old`}
                                                                                                {batch.fifo_alert && ' ⚠️'}
                                                                                            </div>
                                                                                            <div style={{ fontSize: '0.66rem', color: batch.fifo_alert ? '#7c3aed' : '#8a6f5a', marginTop: 2, fontWeight: 650 }}>
                                                                                                {batch.fifo_alert
                                                                                                    ? 'FIFO priority — use this batch first'
                                                                                                    : `${batch.days_until_alert} day${batch.days_until_alert === 1 ? '' : 's'} before FIFO alert`}
                                                                                            </div>
                                                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                                                                By: {batch.purchased_by}
                                                                                            </div>
                                                                                            <div style={{ fontSize: '0.68rem', color: batch.expires_at ? '#b45309' : 'var(--text-muted)', marginTop: 2 }}>
                                                                                                Expires: {batch.expires_at ? formatStockTimestamp(batch.expires_at) : 'Not recorded'}
                                                                                            </div>
                                                                                            {batch.receipt_url && (
                                                                                                <a href={batch.receipt_url} target="_blank" rel="noreferrer"
                                                                                                    style={{ fontSize: '0.65rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                                                                                                    <FileText size={10} /> Receipt
                                                                                                </a>
                                                                                            )}
                                                                                            {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                                                                                                <button
                                                                                                    onClick={() => expireBatch(batch.id, item.id)}
                                                                                                    style={{
                                                                                                        position: 'absolute',
                                                                                                        top: 6,
                                                                                                        right: 6,
                                                                                                        background: 'none',
                                                                                                        border: 'none',
                                                                                                        cursor: 'pointer',
                                                                                                        color: 'var(--danger)',
                                                                                                        padding: 4,
                                                                                                        display: 'flex',
                                                                                                        alignItems: 'center',
                                                                                                        justifyContent: 'center',
                                                                                                        borderRadius: '50%'
                                                                                                    }}
                                                                                                    title="Move to Expired Stock"
                                                                                                >
                                                                                                    <AlertTriangle size={12} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}

                                                                            {!loadingBatches[item.id] && expiredBatches.length > 0 && (
                                                                                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #fecaca' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                                                                        <AlertTriangle size={15} color="#b91c1c" />
                                                                                        <strong style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                                                                                            Expired Stock — separated from usable FIFO
                                                                                        </strong>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                                                        {expiredBatches.map((batch) => (
                                                                                            <div key={`expired-${batch.id}`} style={{
                                                                                                background: batch.disposed_at ? '#f8fafc' : '#fff7f7',
                                                                                                border: '1.5px solid #fca5a5', borderRadius: 8,
                                                                                                padding: '10px 14px', minWidth: 190, position: 'relative', opacity: batch.disposed_at ? 0.75 : 1
                                                                                            }}>
                                                                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: batch.disposed_at ? '#64748b' : '#dc2626', display: 'inline-block', padding: '2px 7px', borderRadius: 8 }}>
                                                                                                    {batch.disposed_at ? 'DISPOSED · HISTORY' : 'EXPIRED · NOT USABLE'}
                                                                                                </div>
                                                                                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#991b1b', margin: '7px 0 2px' }}>
                                                                                                    {batch.quantity_remaining} {item.unit}
                                                                                                </div>
                                                                                                <div style={{ fontSize: '0.7rem', color: '#7f1d1d' }}>Batch #{batch.id}</div>
                                                                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                                                                                    Expiration: {batch.expires_at ? formatStockTimestamp(batch.expires_at) : 'Manually marked'}
                                                                                                </div>
                                                                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                                                                    Moved by: {batch.expired_by || 'System'}
                                                                                                </div>
                                                                                                {batch.disposed_at ? (
                                                                                                    <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 5 }}>
                                                                                                        Disposed by {batch.disposed_by}: {batch.disposal_reason}
                                                                                                    </div>
                                                                                                ) : user?.role === 'Admin' ? (
                                                                                                    <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => disposeBatch(batch.id, item.id)}>
                                                                                                        Record Disposal
                                                                                                    </button>
                                                                                                ) : null}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    )
                                                })}
                                            </Fragment>
                                        ))
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 15, padding: '5px 0' }}>
                            {filtered.length === 0 ? (
                                <div className="empty-state" style={{ gridColumn: '1/-1' }}><Package size={48} /><h3>No items matching filters</h3></div>
                            ) : filtered.map(item => {
                                const status = getStatus(item)
                                return (
                                    <div key={item.id} className="card" style={{ padding: 15, background: 'var(--bg-app)', border: `1px solid ${isExpiringSoon(item) ? '#fb923c' : 'var(--border)'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.category}</div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                                <div className={`inv-status ${status.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>{status}</div>
                                                {SHOW_INTERNAL_STOCK_ENTRIES && item.fifo_alert && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed', padding: '2px 6px', borderRadius: 10 }}>
                                                        ⚠️ FIFO Alert
                                                    </span>
                                                )}
                                                {isExpiringSoon(item) && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fff7ed', color: '#ea580c', padding: '2px 6px', borderRadius: 10 }}>
                                                        🕐 Expiring Soon
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                                            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: status === 'Out' ? 'var(--danger)' : 'var(--success)' }}>
                                                {item.quantity}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.unit} available</span>
                                        </div>
                                        {item.last_stock_movement_at && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Clock size={12} />
                                                Updated: {formatStockTimestamp(item.last_stock_movement_at)}
                                            </div>
                                        )}
                                        <button
                                            className="btn btn-warning btn-block"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700 }}
                                            onClick={() => openStock(item, 'out')}
                                            disabled={item.quantity <= 0}
                                        >
                                            <ArrowDown size={16} /> Record Ingredient Used
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </div>

            {/* Item Add/Edit Modal */}
            <Modal
                isOpen={modal}
                onClose={() => setModal(false)}
                title={editing ? 'Edit Item' : 'Add New Item'}
                footer={
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setModal(false)}>Cancel</button>
                        {editing && user?.role === 'Admin' && (
                            <button className="btn btn-danger btn-block" type="button" onClick={() => { remove(editing); setModal(false); }}>
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                        <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
                    </div>
                }
            >
                <form
                    onSubmit={save}
                    onPointerDown={(event) => {
                        if (
                            itemKeypadField
                            && !event.target.closest?.('.inventory-number-field, .inventory-number-keypad')
                        ) {
                            setItemKeypadField(null)
                        }
                    }}
                >
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>Item Name</label>

                        {/* Input + dropdown toggle */}
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                required
                                placeholder="Type to search or add new item..."
                                value={form.name}
                                autoComplete="off"
                                onFocus={() => { setNameSearch(''); setNameDropdownOpen(true) }}
                                onChange={(e) => {
                                    const typed = e.target.value
                                    setForm({ ...form, name: typed })
                                    setNameSearch(typed)
                                    setNameDropdownOpen(true)
                                    const match = items.find(i => i.name.toLowerCase() === typed.toLowerCase())
                                    if (match) setForm(prev => ({ ...prev, name: typed, category: match.category, unit: match.unit }))
                                }}
                                onBlur={() => setTimeout(() => setNameDropdownOpen(false), 150)}
                                style={{ paddingRight: 36 }}
                            />
                            {/* Chevron toggle */}
                            <button
                                type="button"
                                onClick={() => { setNameSearch(''); setNameDropdownOpen(o => !o) }}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted)', padding: 4, display: 'flex'
                                }}
                            >
                                <ChevronDown size={16} style={{ transform: nameDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                        </div>

                        {/* Custom dropdown panel */}
                        {nameDropdownOpen && (() => {
                            const q = nameSearch.toLowerCase()
                            const suggestions = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items
                            if (suggestions.length === 0) return null
                            return (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                                    background: '#fff',
                                    border: '1px solid var(--cream-400)',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    maxHeight: 220,
                                    overflowY: 'auto',
                                    marginTop: 4,
                                }}>
                                    <div style={{ padding: '6px 12px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--cream-200)' }}>
                                        Existing Items
                                    </div>
                                    {suggestions.map(i => (
                                        <div
                                            key={i.id}
                                            onMouseDown={() => {
                                                setForm(prev => ({ ...prev, name: i.name, category: i.category, unit: i.unit }))
                                                setNameSearch('')
                                                setNameDropdownOpen(false)
                                            }}
                                            style={{
                                                padding: '10px 14px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 10,
                                                borderBottom: '1px solid var(--cream-100)',
                                                transition: 'background 0.12s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--cream-50)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{i.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{i.category} · {i.unit}</div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>{i.quantity} {i.unit}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>in stock</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}

                        {/* Existing item detected — offer to restock instead */}
                        {(() => {
                            const match = items.find(i => i.name.toLowerCase() === form.name.toLowerCase())
                            if (!match) return null
                            return (
                                <div style={{
                                    marginTop: 10,
                                    background: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    fontSize: '0.82rem',
                                    color: '#166534',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    flexWrap: 'wrap'
                                }}>
                                    <span>✅ <strong>{match.name}</strong> already exists ({match.quantity} {match.unit}). Add stock to it instead?</span>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        style={{ padding: '5px 14px', fontSize: '0.8rem', flexShrink: 0 }}
                                        onClick={() => {
                                            setModal(false)
                                            setForm(BLANK)
                                            openStock(match, 'in')
                                        }}
                                    >
                                        ↑ Restock this item
                                    </button>
                                </div>
                            )
                        })()}
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Category</label>
                            <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Unit</label>
                            <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        {!editing && (
                            <div className="form-group inventory-number-form-group">
                                <label htmlFor="inventory-initial-quantity">Initial Quantity</label>
                                <div className={`inventory-number-field ${itemKeypadField === 'quantity' ? 'is-active' : ''}`}>
                                    <input
                                        id="inventory-initial-quantity"
                                        className="input"
                                        type="text"
                                        inputMode="none"
                                        pattern="[0-9]*"
                                        autoComplete="off"
                                        readOnly
                                        value={form.quantity}
                                        onFocus={() => openItemKeypad('quantity')}
                                        onClick={() => openItemKeypad('quantity')}
                                        onKeyDown={(event) => handleItemNumberKeyDown(event, 'quantity')}
                                        aria-expanded={itemKeypadField === 'quantity'}
                                        aria-controls="inventory-item-keypad"
                                        aria-haspopup="true"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openItemKeypad('quantity')}
                                        aria-label="Open keypad for Initial Quantity"
                                    >
                                        <Calculator size={17} />
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="form-group inventory-number-form-group">
                            <label htmlFor="inventory-min-stock">Min. Stock Level</label>
                            <div className={`inventory-number-field ${itemKeypadField === 'min_stock' ? 'is-active' : ''}`}>
                                <input
                                    id="inventory-min-stock"
                                    className="input"
                                    type="text"
                                    inputMode="none"
                                    pattern="[0-9]*"
                                    autoComplete="off"
                                    readOnly
                                    required
                                    value={form.min_stock}
                                    onFocus={() => openItemKeypad('min_stock')}
                                    onClick={() => openItemKeypad('min_stock')}
                                    onKeyDown={(event) => handleItemNumberKeyDown(event, 'min_stock')}
                                    aria-expanded={itemKeypadField === 'min_stock'}
                                    aria-controls="inventory-item-keypad"
                                    aria-haspopup="true"
                                />
                                <button
                                    type="button"
                                    onClick={() => openItemKeypad('min_stock')}
                                    aria-label="Open keypad for Minimum Stock Level"
                                >
                                    <Calculator size={17} />
                                </button>
                            </div>
                        </div>
                    </div>
                    {!editing && Number(form.quantity) > 0 && (
                        <div className="form-group">
                            <label htmlFor="inventory-initial-expiration">Expiration Date <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(recommended)</span></label>
                            <input
                                id="inventory-initial-expiration"
                                className="input"
                                type="date"
                                min={new Date().toISOString().slice(0, 10)}
                                value={form.expires_at || ''}
                                onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
                            />
                            <small style={{ color: 'var(--text-muted)' }}>When this date passes, this stock automatically moves out of the available total.</small>
                        </div>
                    )}
                    {!editing && (
                        <div className="inventory-fifo-auto-note">
                            <Clock size={15} />
                            <span>
                                The initial quantity receives an <strong>automatic date and time record</strong>.
                            </span>
                        </div>
                    )}
                    {itemKeypadField && (
                        <NumericKeypad
                            id="inventory-item-keypad"
                            label={itemKeypadField === 'quantity' ? 'Initial Quantity' : 'Min. Stock Level'}
                            value={form[itemKeypadField]}
                            unit={form.unit}
                            allowDecimal={false}
                            onAppend={appendToItemNumber}
                            onBackspace={backspaceItemNumber}
                            onClear={clearItemNumber}
                            onDone={() => setItemKeypadField(null)}
                        />
                    )}
                </form>
            </Modal>

            {/* Stock Adjustment Modal */}
            <Modal
                isOpen={stockModal}
                onClose={() => setStockModal(false)}
                title={stockForm.type === 'in' ? '↑ Add Stock' : '↓ Use Stock'}
                footer={
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setStockModal(false)}>Cancel</button>
                        <button className={`btn btn-${stockForm.type === 'in' ? 'success' : 'warning'} btn-block`} onClick={saveStock} disabled={saving}>
                            {saving ? 'Saving...' : `Confirm ${stockForm.type === 'in' ? 'Stock In' : 'Stock Out'}`}
                        </button>
                    </div>
                }
            >
                <form onSubmit={saveStock}>
                    {stockForm.type === 'out' && (
                        <div style={{
                            background: '#f3e8ff',
                            border: '1px solid #a78bfa',
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginBottom: 14,
                            fontSize: '0.82rem',
                            color: '#5b21b6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <Layers size={14} />
                            The entered amount will be deducted from the <strong>available stock total</strong>.
                        </div>
                    )}
                    {stockForm.type === 'in' && (
                        <div style={{
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginBottom: 14,
                            fontSize: '0.82rem',
                            color: '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <Layers size={14} />
                            This stock addition will be timestamped automatically with the exact date and time.
                        </div>
                    )}
                    <div className="form-group">
                        <label>Quantity to {stockForm.type === 'in' ? 'Add' : 'Deduct'}</label>
                        <input
                            className="input"
                            type="number"
                            required
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={stockForm.quantity}
                            onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                            style={{ fontSize: '1.5rem', textAlign: 'center', fontWeight: 800, height: 50, color: 'var(--brown-700)' }}
                        />
                        {stockForm.type === 'out' && (
                            <NumericKeypad
                                onAppend={appendToQty}
                                onBackspace={backspaceQty}
                                onClear={clearQty}
                            />
                        )}
                    </div>
                    {stockForm.type === 'in' && (
                        <div className="form-group">
                            <label htmlFor="stock-expiration-date">Expiration Date <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(recommended)</span></label>
                            <input
                                id="stock-expiration-date"
                                className="input"
                                type="date"
                                min={new Date().toISOString().slice(0, 10)}
                                value={stockForm.expiresAt}
                                onChange={(event) => setStockForm({ ...stockForm, expiresAt: event.target.value })}
                            />
                            <small style={{ color: 'var(--text-muted)' }}>Expired stock will be quarantined automatically and kept in a separate audit section.</small>
                        </div>
                    )}
                    {stockForm.type === 'in' && (
                        <div className="form-group">
                            <label>Receipt Upload</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={(e) => setReceipt(e.target.files[0])}
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '20px',
                                    cursor: 'pointer',
                                    background: receipt ? 'var(--success-bg)' : 'var(--bg-card)',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                            >
                                {receipt ? (
                                    <>
                                        <FileText color="var(--success)" size={32} />
                                        <span style={{ fontSize: '0.85rem' }}>{receipt.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload color="var(--text-muted)" size={32} />
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click to upload receipt</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </form>
            </Modal>

            {/* Fund Request Modal */}
            <Modal isOpen={fundModal} onClose={() => setFundModal(false)} title="Request Funds" footer={<div style={{ display: 'flex', gap: 8, width: '100%' }}><button className="btn btn-secondary btn-block" onClick={() => setFundModal(false)}>Cancel</button><button className="btn btn-primary btn-block" onClick={handleCreateFundRequest} disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button></div>}>
                <div className="form-group">
                    <label>Estimated Amount Required (₱)</label>
                    <input className="input" type="number" min="0" step="0.01" value={fundForm.requested_amount} onChange={(e) => setFundForm({ ...fundForm, requested_amount: e.target.value })} placeholder="e.g. 2500" />
                </div>
                <div className="form-group">
                    <label>Items Needing Restock</label>
                    <small className="fund-restock-hint">Only low-stock and out-of-stock items are shown.</small>
                    <div className="fund-restock-list">
                        {restockItems.length === 0 ? (
                            <div className="fund-restock-empty">
                                <CheckCircle size={24} />
                                <strong>All stock levels are healthy</strong>
                                <span>No items currently require funding.</span>
                            </div>
                        ) : restockItems.map(item => {
                            const itemStatus = getStatus(item)
                            return (
                                <div key={item.id} className={`fund-restock-item ${itemStatus.toLowerCase()}`}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                                        <input
                                            type="checkbox"
                                            checked={fundForm.items_list.includes(item.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFundForm({
                                                        ...fundForm,
                                                        items_list: [...fundForm.items_list, item.name],
                                                        items_data: { ...fundForm.items_data, [item.name]: { qty: 1, supplier: '', est_cost: '' } }
                                                    })
                                                } else {
                                                    const newData = { ...fundForm.items_data }
                                                    delete newData[item.name]
                                                    setFundForm({
                                                        ...fundForm,
                                                        items_list: fundForm.items_list.filter(i => i !== item.name),
                                                        items_data: newData
                                                    })
                                                }
                                            }}
                                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                                        />
                                        <div className="fund-restock-name">
                                            <strong>{item.name}</strong>
                                            <span>{item.quantity} {item.unit} available · Minimum {item.min_stock} {item.unit}</span>
                                        </div>
                                        <span className={`fund-restock-status ${itemStatus.toLowerCase()}`}>{itemStatus}</span>
                                    </label>
                                    {fundForm.items_list.includes(item.name) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '10px 0 10px 26px', borderTop: '1px solid var(--cream-200)' }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: 2 }}>Qty to Buy ({item.unit})</label>
                                                    <input
                                                        type="number"
                                                        className="input"
                                                        min="0.1"
                                                        step="any"
                                                        style={{ width: '100%', padding: '4px 8px' }}
                                                        value={fundForm.items_data[item.name]?.qty || 1}
                                                        onChange={(e) => setFundForm({
                                                            ...fundForm,
                                                            items_data: { ...fundForm.items_data, [item.name]: { ...fundForm.items_data[item.name], qty: e.target.value } }
                                                        })}
                                                    />
                                                </div>
                                                <div style={{ flex: 2 }}>
                                                    <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: 2 }}>Supplier</label>
                                                    <input
                                                        className="input"
                                                        style={{ width: '100%', padding: '4px 8px' }}
                                                        placeholder="Supplier Name"
                                                        value={fundForm.items_data[item.name]?.supplier || ''}
                                                        onChange={(e) => setFundForm({
                                                            ...fundForm,
                                                            items_data: { ...fundForm.items_data, [item.name]: { ...fundForm.items_data[item.name], supplier: e.target.value } }
                                                        })}
                                                    />
                                                </div>
                                                <div style={{ flex: 1.5 }}>
                                                    <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: 2 }}>Est. Cost (₱)</label>
                                                    <input
                                                        type="number"
                                                        className="input"
                                                        style={{ width: '100%', padding: '4px 8px' }}
                                                        placeholder="₱"
                                                        value={fundForm.items_data[item.name]?.est_cost || ''}
                                                        onChange={(e) => {
                                                            const newEstCost = e.target.value;
                                                            const newData = { ...fundForm.items_data, [item.name]: { ...fundForm.items_data[item.name], est_cost: newEstCost } };
                                                            // Auto-sum total amount
                                                            const total = Object.values(newData).reduce((sum, d) => sum + (parseFloat(d.est_cost) || 0), 0);
                                                            setFundForm({
                                                                ...fundForm,
                                                                items_data: newData,
                                                                requested_amount: total > 0 ? total : fundForm.requested_amount
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="form-group">
                    <label>Notes (Optional)</label>
                    <input className="input" type="text" value={fundForm.notes} onChange={(e) => setFundForm({ ...fundForm, notes: e.target.value })} placeholder="Any additional instructions..." />
                </div>
            </Modal>

            {/* Liquidate / Submit Report Modal */}
            <Modal isOpen={liquidateModal} onClose={() => setLiquidateModal(false)} title="Submit Purchase Report" footer={<div style={{ display: 'flex', gap: 8, width: '100%' }}><button className="btn btn-secondary btn-block" onClick={() => setLiquidateModal(false)}>Cancel</button><button className="btn btn-primary btn-block" onClick={handleLiquidate} disabled={saving}>{saving ? 'Submitting...' : 'Submit Report'}</button></div>}>
                {selectedFundReq && (
                    <div style={{ marginBottom: 16, background: 'var(--cream-100)', padding: 12, borderRadius: 8, fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span><strong>Released Amount:</strong> ₱{selectedFundReq.released_amount}</span>
                            <span><strong>PR ID:</strong> #{selectedFundReq.id}</span>
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label>Inventory Restock (Enter Actual Data)</label>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-app)', marginBottom: 16 }}>
                        {items.filter(item => {
                            // Very basic filter: if we have combined strings like "5 kg itemname (from supplier)"
                            // We check if the item name is in the list
                            return selectedFundReq?.items_list.some(il => il.toLowerCase().includes(item.name.toLowerCase()));
                        }).map(item => (
                            <div key={item.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600, color: 'var(--brown-600)', marginBottom: 8 }}>{item.name}</div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.7rem' }}>Actual Qty ({item.unit})</label>
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="0.0"
                                            value={liquidateForm.purchased_items[item.id]?.qty || ''}
                                            onChange={(e) => {
                                                const newPurchased = {
                                                    ...liquidateForm.purchased_items,
                                                    [item.id]: {
                                                        ...liquidateForm.purchased_items[item.id],
                                                        qty: e.target.value,
                                                        inventory_item_id: item.id
                                                    }
                                                };
                                                setLiquidateForm({ ...liquidateForm, purchased_items: newPurchased });
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1.5 }}>
                                        <label style={{ fontSize: '0.7rem' }}>Actual Cost (₱)</label>
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="₱"
                                            value={liquidateForm.purchased_items[item.id]?.cost || ''}
                                            onChange={(e) => {
                                                const newPurchased = {
                                                    ...liquidateForm.purchased_items,
                                                    [item.id]: {
                                                        ...liquidateForm.purchased_items[item.id],
                                                        cost: e.target.value,
                                                        inventory_item_id: item.id
                                                    }
                                                };
                                                const totalSpent = Object.values(newPurchased).reduce((sum, p) => sum + (parseFloat(p.cost) || 0), 0);
                                                setLiquidateForm({ ...liquidateForm, purchased_items: newPurchased, spent_amount: totalSpent });
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1.5 }}>
                                        <label style={{ fontSize: '0.7rem' }}>Actual Supplier</label>
                                        <input
                                            className="input"
                                            placeholder="Supplier"
                                            value={liquidateForm.purchased_items[item.id]?.supplier || ''}
                                            onChange={(e) => {
                                                const newPurchased = {
                                                    ...liquidateForm.purchased_items,
                                                    [item.id]: {
                                                        ...liquidateForm.purchased_items[item.id],
                                                        supplier: e.target.value,
                                                        inventory_item_id: item.id
                                                    }
                                                };
                                                setLiquidateForm({ ...liquidateForm, purchased_items: newPurchased });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label>Actual Total Amount Spent (₱)</label>
                    <input className="input" type="number" min="0" step="0.01" value={liquidateForm.spent_amount} onChange={(e) => setLiquidateForm({ ...liquidateForm, spent_amount: e.target.value })} placeholder="Calculated automatically" />
                </div>
                {selectedFundReq && liquidateForm.spent_amount && (
                    <div style={{ marginBottom: 16, fontSize: '0.9rem', color: parseFloat(liquidateForm.spent_amount) > selectedFundReq.released_amount ? 'var(--danger)' : 'var(--success)' }}>
                        {parseFloat(liquidateForm.spent_amount) > selectedFundReq.released_amount ?
                            `⚠️ Overspent by: ₱${(parseFloat(liquidateForm.spent_amount) - selectedFundReq.released_amount).toFixed(2)}` :
                            `Change to Return: ₱${(selectedFundReq.released_amount - parseFloat(liquidateForm.spent_amount)).toFixed(2)}`
                        }
                    </div>
                )}
                <div className="form-group" style={{ marginTop: 24 }}>
                    <label>Upload Receipt (Required)</label>
                    <input type="file" ref={liquidateFileRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => setLiquidateForm({ ...liquidateForm, receipt: e.target.files[0] })} />
                    <div onClick={() => liquidateFileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', cursor: 'pointer', background: liquidateForm.receipt ? 'var(--success-bg)' : 'var(--cream-50)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        {liquidateForm.receipt ? <><FileText color="var(--success)" size={32} /><div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>{liquidateForm.receipt.name}</div></> : <><Upload color="var(--text-muted)" size={32} /><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Click to upload receipt</div></>}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
