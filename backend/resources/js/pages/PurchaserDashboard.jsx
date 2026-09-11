import { useEffect, useState, useMemo, useRef } from 'react'
import { Package, AlertTriangle, List, Plus, ShoppingCart, RefreshCw, Upload, FileText } from 'lucide-react'
import { inventoryService } from '../services/inventory.service'
import Modal from '../components/ui/Modal'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

export default function PurchaserDashboard() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [stockModal, setStockModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [addQuantity, setAddQuantity] = useState(1)
    const [receipt, setReceipt] = useState(null)
    const [addItemModal, setAddItemModal] = useState(false)
    const [newItemForm, setNewItemForm] = useState({ name: '', category: 'Meats', unit: 'kg', quantity: 0, min_stock: 5 })
    const [newItemReceipt, setNewItemReceipt] = useState(null)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef(null)
    const newItemFileRef = useRef(null)

    const UNITS = ['kg', 'liters', 'pcs', 'packs', 'boxes', 'bottles']
    const CATEGORIES = ['Meats', 'Venges&Fruits', 'Drinks&Wine', 'For Baking', 'Grains', 'Condiments', 'Others']

    const loadData = () => {
        setLoading(true)
        inventoryService.getAll()
            .then(setItems)
            .catch(() => toast('Failed to load inventory', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(loadData, [])

    // Summary Statistics
    const stats = useMemo(() => {
        const total = items.length
        const low = items.filter(i => i.quantity > 0 && i.quantity <= i.min_stock).length
        const out = items.filter(i => i.quantity === 0).length
        return { total, low, out }
    }, [items])

    // Low Stock Items (High Priority)
    const lowStockItems = useMemo(() => {
        return items.filter(i => i.quantity <= i.min_stock).sort((a, b) => a.quantity - b.quantity)
    }, [items])

    const getStatusInfo = (item) => {
        if (item.quantity === 0) return { label: 'Out of Stock', color: 'var(--danger)', bg: 'var(--danger-bg)' }
        if (item.quantity <= item.min_stock) return { label: 'Low Stock', color: 'var(--warning)', bg: 'var(--warning-bg)' }
        return { label: 'Available', color: 'var(--success)', bg: 'var(--success-bg)' }
    }

    const openAddStock = (item) => {
        setSelectedItem(item)
        setAddQuantity(1)
        setReceipt(null)
        setStockModal(true)
    }

    const handleAddStock = async (e) => {
        e.preventDefault()
        if (!selectedItem || addQuantity <= 0) return

        setSaving(true)
        try {
            const formData = new FormData()
            formData.append('item_id', selectedItem.id)
            formData.append('type', 'in')
            formData.append('quantity', addQuantity)
            formData.append('reason', 'Purchaser update')
            formData.append('performed_by', user?.fullName || 'Purchaser')
            if (receipt) {
                formData.append('receipt', receipt)
            }

            await inventoryService.stockAdjust(formData)
            
            toast('Stock updated successfully', 'success')
            setStockModal(false)
            loadData()
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to update stock', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleAddNewItem = async (e) => {
        e.preventDefault()
        if (!newItemForm.name || !newItemForm.category) {
            toast('Name and category are required', 'warning'); return
        }
        setSaving(true)
        try {
            const formData = new FormData()
            formData.append('name', newItemForm.name)
            formData.append('category', newItemForm.category)
            formData.append('unit', newItemForm.unit)
            formData.append('quantity', newItemForm.quantity)
            formData.append('min_stock', newItemForm.min_stock)
            if (newItemReceipt) {
                formData.append('receipt', newItemReceipt)
            }

            await inventoryService.create(formData)
            toast('New item added to inventory', 'success')
            setAddItemModal(false)
            setNewItemForm({ name: '', category: 'Meats', unit: 'kg', quantity: 0, min_stock: 5 })
            setNewItemReceipt(null)
            loadData()
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to add item', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading && items.length === 0) {
        return <div className="loading"><div className="spinner" /></div>
    }

    return (
        <div className="purchaser-dashboard">
            <div className="page-header" style={{ marginBottom: 24, padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <div><h2>Purchaser Dashboard</h2><p>Restock low items and manage inventory</p></div>
                <button className="btn btn-primary" onClick={() => setAddItemModal(true)}>
                    <Plus size={16} /> New Stock Item
                </button>
            </div>

            {/* 1. Summary Section */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon brown"><Package size={24} /></div>
                    <div className="stat-info">
                        <div className="stat-label">Total Products</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange"><AlertTriangle size={24} /></div>
                    <div className="stat-info">
                        <div className="stat-label">Low Stock</div>
                        <div className="stat-value">{stats.low}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon red" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                        <ShoppingCart size={24} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Out of Stock</div>
                        <div className="stat-value">{stats.out}</div>
                    </div>
                </div>
            </div>

            {/* 2. Low Stock Alert Section (High Priority) */}
            {lowStockItems.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <AlertTriangle color="var(--warning)" size={20} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Priority Restock Needed</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {lowStockItems.map(item => {
                            const suggested = Math.max(0, item.min_stock - item.quantity)
                            return (
                                <div key={item.id} className="card" style={{ padding: 16, borderLeft: '4px solid var(--warning)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{item.name}</h4>
                                            <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <span>Stock: <strong style={{ color: item.quantity === 0 ? 'var(--danger)' : 'var(--warning)' }}>{item.quantity} {item.unit}</strong></span>
                                                <span>Goal: {item.min_stock} {item.unit}</span>
                                            </div>
                                        </div>
                                        <div className="badge badge-warning">Low Stock</div>
                                    </div>
                                    {suggested > 0 && (
                                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--cream-100)', borderRadius: 8 }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                Suggested: <strong>+{suggested} {item.unit}</strong>
                                            </div>
                                            <button className="btn btn-primary btn-sm" onClick={() => openAddStock(item)}>
                                                <Plus size={14} /> Add
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* 3. Inventory List */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <List color="var(--brown-600)" size={20} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Inventory List</h3>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                No items in inventory
                            </div>
                        ) : (
                            items.map((item, idx) => {
                                const status = getStatusInfo(item)
                                return (
                                    <div key={item.id} style={{ 
                                        padding: '16px 20px', 
                                        borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--border)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.quantity} {item.unit}</span>
                                                <span className="badge" style={{ background: status.bg, color: status.color, fontSize: '0.65rem', padding: '1px 8px' }}>
                                                    {status.label}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--brown-400)', marginLeft: 8 }}>{item.category}</span>
                                            </div>
                                        </div>
                                        <button className="btn btn-secondary btn-sm" onClick={() => openAddStock(item)}>
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </section>

            {/* 4. Add Stock Modal */}
            <Modal
                isOpen={stockModal}
                onClose={() => setStockModal(false)}
                title="Add Stock (Restock)"
                footer={
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setStockModal(false)}>Cancel</button>
                        <button className="btn btn-primary btn-block" onClick={handleAddStock} disabled={saving}>
                            {saving ? 'Updating...' : 'Confirm'}
                        </button>
                    </div>
                }
            >
                {selectedItem && (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ marginBottom: 20 }}>Adding stock for <strong>{selectedItem.name}</strong></p>
                        <div className="form-group">
                            <label>Quantity to Add ({selectedItem.unit})</label>
                            <input 
                                className="input" 
                                type="number" 
                                min="1"
                                value={addQuantity}
                                onChange={(e) => setAddQuantity(parseInt(e.target.value) || 0)}
                                autoFocus
                                style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: 24 }}>
                            <label>Upload Receipt (Image)</label>
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
                                    background: receipt ? 'var(--success-bg)' : 'var(--cream-50)',
                                    transition: 'var(--transition)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                            >
                                {receipt ? (
                                    <>
                                        <FileText color="var(--success)" size={32} />
                                        <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                                            {receipt.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Click to change file
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Upload color="var(--text-muted)" size={32} />
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                            Click to upload receipt
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                            JPG, PNG, GIF up to 5MB
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 24 }}>
                            Current stock: {selectedItem.quantity} → New stock: {selectedItem.quantity + addQuantity}
                        </div>
                    </div>
                )}
            </Modal>
            {/* 5. Add New Item Modal */}
            <Modal
                isOpen={addItemModal}
                onClose={() => setAddItemModal(false)}
                title="Create New Inventory Item"
                footer={
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setAddItemModal(false)}>Cancel</button>
                        <button className="btn btn-primary btn-block" onClick={handleAddNewItem} disabled={saving}>
                            {saving ? 'Creating...' : 'Create Item'}
                        </button>
                    </div>
                }
            >
                <div className="form-group">
                    <label>Item Name *</label>
                    <input 
                        className="input" 
                        placeholder="e.g. Tomato Sauce"
                        value={newItemForm.name}
                        onChange={e => setNewItemForm({...newItemForm, name: e.target.value})}
                    />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Category *</label>
                        <select 
                            className="input"
                            value={newItemForm.category}
                            onChange={e => setNewItemForm({...newItemForm, category: e.target.value})}
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Unit *</label>
                        <select 
                            className="input"
                            value={newItemForm.unit}
                            onChange={e => setNewItemForm({...newItemForm, unit: e.target.value})}
                        >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Initial Quantity</label>
                        <input 
                            className="input" 
                            type="number"
                            min="0"
                            value={newItemForm.quantity}
                            onChange={e => setNewItemForm({...newItemForm, quantity: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <div className="form-group">
                        <label>Min. Stock Level</label>
                        <input 
                            className="input" 
                            type="number"
                            min="0"
                            value={newItemForm.min_stock}
                            onChange={e => setNewItemForm({...newItemForm, min_stock: parseInt(e.target.value) || 0})}
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginTop: 24 }}>
                    <label>Upload Receipt (Image)</label>
                    <input 
                        type="file" 
                        ref={newItemFileRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={(e) => setNewItemReceipt(e.target.files[0])}
                    />
                    <div 
                        onClick={() => newItemFileRef.current?.click()}
                        style={{
                            border: '2px dashed var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '20px',
                            cursor: 'pointer',
                            background: newItemReceipt ? 'var(--success-bg)' : 'var(--cream-50)',
                            transition: 'var(--transition)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        {newItemReceipt ? (
                            <>
                                <FileText color="var(--success)" size={32} />
                                <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                                    {newItemReceipt.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Click to change file
                                </div>
                            </>
                        ) : (
                            <>
                                <Upload color="var(--text-muted)" size={32} />
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    Click to upload receipt
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                    JPG, PNG, GIF up to 5MB
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
