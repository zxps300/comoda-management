import { useEffect, useState, useMemo, useRef } from 'react'
import { inventoryService } from '../services/inventory.service'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/ui/Modal'
import { 
    Plus, Search, Package, AlertTriangle, 
    Pencil, Trash2, ArrowUp, ArrowDown, 
    History, ImageIcon, X, Upload, ExternalLink, FileText
} from 'lucide-react'

const UNITS = ['kg', 'liters', 'pcs', 'packs', 'boxes', 'bottles']
const CATEGORIES = ['Meats', 'Venges&Fruits', 'Drinks&Wine', 'For Baking', 'Grains', 'Condiments', 'Others']
const BLANK = { name: '', category: 'Meats', unit: 'kg', quantity: 0, min_stock: 5 }

export default function Inventory() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [activeTab, setActiveTab] = useState(user?.role === 'Admin' || user?.role === 'Purchaser' ? 'all' : 'usage')

    // Modal states
    const [modal, setModal] = useState(false)
    const [stockModal, setStockModal] = useState(false)
    const [editing, setEditing] = useState(null)
    
    // Form states
    const [form, setForm] = useState(BLANK)
    const [stockForm, setStockForm] = useState({ itemId: '', type: 'in', quantity: 1, reason: '' })
    
    // Receipt upload state
    const [receipt, setReceipt] = useState(null)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef(null)

    const load = () => {
        setLoading(true)
        inventoryService.getAll()
            .then(setItems)
            .catch(() => toast('Failed to load inventory', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(load, [])

    const getStatus = (item) => {
        if (item.quantity <= 0) return 'Out'
        if (item.quantity <= item.min_stock) return 'Low'
        return 'OK'
    }

    const filtered = useMemo(() => {
        return items
            .filter((i) => [i.name, i.category, i.unit].join(' ').toLowerCase().includes(search.toLowerCase()))
            .filter((i) => statusFilter === 'all' || getStatus(i).toLowerCase() === statusFilter)
    }, [items, search, statusFilter])

    const openAdd = () => { setEditing(null); setForm(BLANK); setModal(true) }
    const openEdit = (item) => {
        setEditing(item)
        setForm({ ...item })
        setModal(true)
    }

    const openStock = (item, type) => {
        setStockForm({ itemId: item.id, type, quantity: 1, reason: '' })
        setReceipt(null)
        setStockModal(true)
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
                toast('Item created', 'success')
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
            const formData = new FormData()
            formData.append('item_id', stockForm.itemId)
            formData.append('type', stockForm.type)
            formData.append('quantity', stockForm.quantity)
            formData.append('reason', stockForm.reason)
            formData.append('performed_by', user?.fullName || 'System')
            
            if (stockForm.type === 'in' && receipt) {
                formData.append('receipt', receipt)
            }

            await inventoryService.stockAdjust(formData)
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

    return (
        <div>
            <div className="page-header">
                <div><h2>Inventory Management</h2><p>Track stock levels and adjust quantities</p></div>
                {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                    <button className="btn btn-primary" onClick={openAdd}>
                        <Plus size={16} /> Add Item
                    </button>
                )}
            </div>

            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total Items', value: items.length, color: 'var(--info)' },
                    { label: 'OK', value: items.filter((i) => getStatus(i) === 'OK').length, color: 'var(--success)' },
                    { label: 'Low Stock', value: items.filter((i) => getStatus(i) === 'Low').length, color: 'var(--warning)' },
                    { label: 'Out of Stock', value: items.filter((i) => getStatus(i) === 'Out').length, color: 'var(--danger)' },
                ].map((s) => (
                    <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 20px', minWidth: 120, borderLeft: `4px solid ${s.color}` }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="card">
                <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                    <div className="filter-tabs" style={{ margin: 0, padding: '0 5px' }}>
                        <button className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                            <Package size={16} /> All Items
                        </button>
                        <button className={`filter-tab ${activeTab === 'usage' ? 'active' : ''}`} onClick={() => setActiveTab('usage')}>
                            <ArrowDown size={16} /> Kitchen Usage (Report Portions)
                        </button>
                    </div>
                </div>

                <div className="search-bar">
                    <div className="search-input-wrapper">
                        <Search size={16} />
                        <input className="input" placeholder="Search item name or category..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="filter-tabs" style={{ marginBottom: 0 }}>
                        {['all', 'ok', 'low', 'out'].map((f) => (
                            <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatusFilter(f)}>
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? <div className="loading"><div className="spinner" /></div> : (
                    activeTab === 'all' ? (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Item</th><th>Category</th><th>Stock</th><th>Unit</th><th>Min. Level</th><th>Status</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={7}><div className="empty-state"><Package size={36} /><h3>No items found</h3></div></td></tr>
                                    ) : filtered.map((item) => {
                                        const status = getStatus(item)
                                        return (
                                            <tr key={item.id}>
                                                <td><strong>{item.name}</strong></td>
                                                <td><span style={{ fontSize: '0.85rem', color: 'var(--brown-600)', background: 'var(--cream-100)', padding: '2px 8px', borderRadius: 4 }}>{item.category}</span></td>
                                                <td>
                                                    <strong style={{ color: status === 'Out' ? 'var(--danger)' : status === 'Low' ? 'var(--warning)' : 'var(--success)' }}>
                                                        {item.quantity}
                                                    </strong>
                                                </td>
                                                <td>{item.unit}</td>
                                                <td>{item.min_stock}</td>
                                                <td>
                                                    <div className="inv-status">
                                                        <div className={`inv-dot ${status.toLowerCase()}`} />
                                                        {status}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                                                            <button className="btn btn-success btn-sm" onClick={() => openStock(item, 'in')}><ArrowUp size={13} /> In</button>
                                                        )}
                                                        <button className="btn btn-warning btn-sm" onClick={() => openStock(item, 'out')}>
                                                            <ArrowDown size={13} /> {user?.role === 'Admin' ? 'Out' : 'Use Stock'}
                                                        </button>
                                                        {(user?.role === 'Admin' || user?.role === 'Purchaser') && (
                                                            <>
                                                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}><Pencil size={13} /></button>
                                                            </>
                                                        )}
                                                        {user?.role === 'Admin' && (
                                                            <button className="btn btn-danger btn-sm" onClick={() => remove(item)}><Trash2 size={13} /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
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
                                    <div key={item.id} className="card" style={{ padding: 15, background: 'var(--bg-app)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.category}</div>
                                            </div>
                                            <div className={`inv-status ${status.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>{status}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 15 }}>
                                            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: status === 'Out' ? 'var(--danger)' : 'var(--success)' }}>
                                                {item.quantity}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.unit} available</span>
                                        </div>
                                        <button 
                                            className="btn btn-warning btn-block" 
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700 }}
                                            onClick={() => openStock(item, 'out')}
                                            disabled={item.quantity <= 0}
                                        >
                                            <ArrowDown size={16} /> Report Usage
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
                        <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
                    </div>
                }
            >
                <form onSubmit={save}>
                    <div className="form-group">
                        <label>Item Name</label>
                        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                            <div className="form-group">
                                <label>Initial Quantity</label>
                                <input className="input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} />
                            </div>
                        )}
                        <div className="form-group">
                            <label>Min. Stock Level</label>
                            <input className="input" type="number" required value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: +e.target.value })} />
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Stock Adjustment Modal */}
            <Modal
                isOpen={stockModal}
                onClose={() => setStockModal(false)}
                title={stockForm.type === 'in' ? 'Restock Item ↑' : 'Report Portion Used ↓'}
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
                    <div className="form-group">
                        <label>Quantity to {stockForm.type === 'in' ? 'Add' : 'Deduct'}</label>
                        <input className="input" type="number" required min="0.1" step="0.1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: +e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Reason / Note</label>
                        <input className="input" placeholder={stockForm.type === 'in' ? 'e.g. Delivery from supplier' : 'e.g. For dinner service'} value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} />
                    </div>

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
        </div>
    )
}
