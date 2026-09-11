import { useEffect, useState, useMemo } from 'react'
import { menuService } from '../services/menu.service'
import { ordersService } from '../services/orders.service'
import Modal from '../components/ui/Modal'
import { useToastContext } from '../contexts/ToastContext'
import { Plus, Minus, Trash2, Send, ShoppingCart, CreditCard, Wallet, Banknote } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })
const TAX_RATE = 0.12

// Valid Philippine peso banknote denominations
export const VALID_PESO_BANKNOTES = [20, 50, 100, 200, 500, 1000]

export function canFormBanknoteAmount(target, denoms) {
    if (target === 0) return true
    if (!denoms || denoms.length === 0 || target < 0) return false
    const dp = new Array(target + 1).fill(false)
    dp[0] = true
    for (const d of denoms) {
        for (let i = d; i <= target; i++) {
            if (dp[i - d]) dp[i] = true
        }
    }
    return dp[target]
}

export function validateCashBanknote(amountReceived, billTotal) {
    if (amountReceived === '' || amountReceived === null || amountReceived === undefined) {
        return { isValid: false, change: 0, error: 'Please enter the cash amount received.' }
    }
    const amount = Number(amountReceived)
    if (isNaN(amount) || amount <= 0) {
        return { isValid: false, change: 0, error: 'Please enter a valid cash amount.' }
    }

    const roundedAmount = Math.round(amount * 100) / 100
    const roundedTotal = Math.round(billTotal * 100) / 100

    if (roundedAmount < roundedTotal) {
        return {
            isValid: false,
            change: 0,
            insufficient: true,
            error: `Insufficient payment. Amount must be at least ${fmt(roundedTotal)}.`
        }
    }

    // Exact payment is allowed (including centavos)
    if (roundedAmount === roundedTotal) {
        return {
            isValid: true,
            change: 0,
            error: null
        }
    }

    // Banknotes are whole peso amounts (centavos are allowed only for exact payments)
    if (roundedAmount % 1 !== 0) {
        return {
            isValid: false,
            change: Math.max(0, roundedAmount - roundedTotal),
            invalidDenomination: true,
            error: 'Invalid cash amount. Please enter a valid Philippine peso banknote denomination (₱20, ₱50, ₱100, ₱200, ₱500, or ₱1,000).'
        }
    }

    const change = Math.round((roundedAmount - roundedTotal) * 100) / 100
    let isAllowed = false

    // Single valid banknote denomination is always allowed if >= billTotal
    if (VALID_PESO_BANKNOTES.includes(roundedAmount)) {
        isAllowed = true
    } else {
        // For multiple banknotes: only banknotes strictly greater than the change amount are non-redundant
        const allowedNotes = VALID_PESO_BANKNOTES.filter(b => b > change)
        isAllowed = canFormBanknoteAmount(roundedAmount, allowedNotes)
    }

    if (!isAllowed) {
        return {
            isValid: false,
            change,
            invalidDenomination: true,
            error: 'Invalid cash amount. Please enter a valid Philippine peso banknote denomination (₱20, ₱50, ₱100, ₱200, ₱500, or ₱1,000).'
        }
    }

    return {
        isValid: true,
        change,
        error: null
    }
}

export default function POS() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [menu, setMenu] = useState([])
    const [catFilter, setCatFilter] = useState('All')
    const [cart, setCart] = useState([])
    const [tableNo, setTableNo] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [successModal, setSuccessModal] = useState(false)
    const [lastOrder, setLastOrder] = useState(null)

    const [menuModalOpen, setMenuModalOpen] = useState(false)
    const [newMenu, setNewMenu] = useState({ name: '', category: '', price: '', available: true, image: '' })
    const [menuSaving, setMenuSaving] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(null)

    const isAdmin = user?.role === 'Admin'

    // Payment states
    const [paymentModal, setPaymentModal] = useState(false)
    const [amountReceived, setAmountReceived] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('Cash')

    useEffect(() => { menuService.getAll().then(setMenu).catch(() => toast('Failed to load menu', 'error')) }, [])

    const cats = useMemo(() => ['All', ...new Set(menu.map((m) => m.category))], [menu])
    const filtered = menu.filter((m) => m.available && (catFilter === 'All' || m.category === catFilter))

    const resetMenuForm = () => setNewMenu({ name: '', category: '', price: '', available: true, image: '' })

    const handleMenuSubmit = async () => {
        if (!newMenu.name.trim() || !newMenu.category.trim() || !newMenu.price) {
            toast('Name, category, and price are required', 'warning')
            return
        }

        setMenuSaving(true)
        try {
            const item = await menuService.create({
                name: newMenu.name.trim(),
                category: newMenu.category.trim(),
                price: Number(newMenu.price),
                available: newMenu.available,
                image: newMenu.image.trim() || null,
            })
            setMenu((prev) => [...prev, item])
            setMenuModalOpen(false)
            resetMenuForm()
            toast('Menu item added successfully', 'success')
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to add menu item', 'error')
        } finally {
            setMenuSaving(false)
        }
    }

    const handleDeleteMenu = async (item) => {
        if (!window.confirm(`Delete menu item "${item.name}"? This cannot be undone.`)) return
        setDeleteLoading(item.id)
        try {
            await menuService.delete(item.id)
            setMenu((prev) => prev.filter((m) => m.id !== item.id))
            toast('Menu item deleted', 'success')
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to delete menu item', 'error')
        } finally {
            setDeleteLoading(null)
        }
    }

    const addToCart = (item) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.id === item.id)
            if (existing) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
            return [...prev, { ...item, qty: 1 }]
        })
    }

    const updateQty = (id, delta) => {
        setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c).filter((c) => c.qty > 0))
    }

    const removeItem = (id) => setCart((prev) => prev.filter((c) => c.id !== id))
    const clearCart = () => { setCart([]); setTableNo(''); setNotes('') }

    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
    const tax = subtotal * TAX_RATE
    const total = subtotal + tax
    const posCashValidation = validateCashBanknote(amountReceived, total)
    const changeAmount = posCashValidation.isValid ? posCashValidation.change : 0

    const handlePlaceOrder = () => {
        if (!tableNo) { toast('Please enter a table number', 'warning'); return }
        if (cart.length === 0) { toast('Cart is empty', 'warning'); return }

        if (user?.role === 'Cashier' || user?.role === 'Admin') {
            setAmountReceived('')
            setPaymentModal(true)
        } else {
            submitOrder(false) // Waiter flow: Unpaid
        }
    }

    const submitOrder = async (isPaid = false) => {
        if (isPaid && paymentMethod === 'Cash') {
            if (!posCashValidation.isValid) {
                toast(posCashValidation.error, 'error'); return
            }
        }

        setSubmitting(true)
        try {
            const orderData = {
                tableNumber: Number(tableNo),
                customerName: `Table ${tableNo}`,
                notes,
                items: cart.map((c) => ({ menuItemId: c.id, name: c.name, price: c.price, quantity: c.qty })),
                subtotal, tax, total,
                isPaid,
                paymentMethod: isPaid ? paymentMethod : null,
                amountReceived: isPaid ? (Number(amountReceived) || total) : 0,
                changeAmount: isPaid ? changeAmount : 0
            }

            const order = await ordersService.create(orderData)
            setLastOrder(order)
            setCart([])
            setTableNo('')
            setNotes('')
            setPaymentModal(false)
            setSuccessModal(true)
            toast(isPaid ? 'Payment received & Order placed!' : 'Order submitted to kitchen', 'success')
        } catch (err) {
            toast(err.response?.data?.message || 'Error placing order', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div>
            <div className="page-header">
                <div><h2>Point of Sale</h2><p>{user?.role} Terminal</p></div>
            </div>

            <div className="pos-layout">
                {/* Menu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div className="filter-tabs">
                            {cats.map((c) => (
                                <button key={c} className={`filter-tab ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
                            ))}
                        </div>
                        {isAdmin && (
                            <button className="btn btn-primary" onClick={() => setMenuModalOpen(true)}>
                                <Plus size={16} style={{ marginRight: 6 }} /> Add Menu Item
                            </button>
                        )}
                    </div>
                    <div className="menu-grid">
                        {filtered.map((item) => (
                            <div className="menu-card" key={item.id} onClick={() => addToCart(item)} style={{ position: 'relative' }}>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteMenu(item) }}
                                        disabled={deleteLoading === item.id}
                                        title="Delete menu item"
                                        style={{
                                            position: 'absolute',
                                            top: 10,
                                            right: 10,
                                            zIndex: 2,
                                            background: 'rgba(255,255,255,0.95)',
                                            border: '1px solid rgba(0,0,0,0.12)',
                                            borderRadius: '999px',
                                            padding: 8,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                                <img className="menu-card-img" src={item.image || 'https://via.placeholder.com/200x150?text=Food'} alt={item.name} onError={(e) => { e.target.src = 'https://via.placeholder.com/200x150?text=Food' }} />
                                <div className="menu-card-body">
                                    <div className="menu-card-cat">{item.category}</div>
                                    <div className="menu-card-name">{item.name}</div>
                                    <div className="menu-card-price">{fmt(item.price)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Panel */}
                <div className="order-panel">
                    <div className="order-panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <ShoppingCart size={18} />
                            <strong>Current Order</strong>
                            {cart.length > 0 && <span className="nav-badge" style={{ background: 'var(--brown-600)' }}>{cart.reduce((s, c) => s + c.qty, 0)}</span>}
                        </div>
                        <div className="form-row" style={{ gap: 8 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <input className="input" placeholder="Table No. *" type="number" min={1} value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <input className="input" placeholder="Notes (Optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="order-items-list">
                        {cart.length === 0 ? (
                            <div className="empty-state" style={{ padding: '40px 20px' }}>
                                <ShoppingCart size={36} />
                                <h3>Cart is empty</h3>
                                <p>This terminal is currently in view-only mode</p>
                            </div>
                        ) : cart.map((item) => (
                            <div className="order-item-row" key={item.id}>
                                <div style={{ flex: 1 }}>
                                    <div className="order-item-name">{item.name}</div>
                                    <div className="order-item-price">{fmt(item.price)} × {item.qty} = {fmt(item.price * item.qty)}</div>
                                </div>
                                <div className="qty-controls">
                                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={12} /></button>
                                    <span className="qty-value">{item.qty}</span>
                                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={12} /></button>
                                    <button className="qty-btn" style={{ color: 'var(--danger)' }} onClick={() => removeItem(item.id)}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="order-panel-footer">
                        <div className="order-totals">
                            <div className="order-total-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                            <div className="order-total-row"><span>Tax (12%)</span><span>{fmt(tax)}</span></div>
                            <div className="order-total-row total"><span>Total</span><span>{fmt(total)}</span></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary" onClick={clearCart} disabled={cart.length === 0}>Clear</button>
                            <button className="btn btn-primary btn-block" onClick={handlePlaceOrder} disabled={submitting || cart.length === 0}>
                                <Send size={15} /> {submitting ? 'Processing...' : (user?.role === 'Cashier' ? 'Pay & Place' : 'Place Order')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={menuModalOpen} onClose={() => setMenuModalOpen(false)} title="➕ Add New Menu Item" narrow
                footer={
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setMenuModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary btn-block" onClick={handleMenuSubmit} disabled={menuSaving}>
                            {menuSaving ? 'Saving...' : 'Save Item'}
                        </button>
                    </div>
                }
            >
                <div style={{ display: 'grid', gap: 14 }}>
                    <div className="form-group">
                        <label>Name *</label>
                        <input className="input" value={newMenu.name} onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} placeholder="Menu item name" />
                    </div>
                    <div className="form-group">
                        <label>Category *</label>
                        <input className="input" value={newMenu.category} onChange={(e) => setNewMenu({ ...newMenu, category: e.target.value })} placeholder="Category (e.g. Drinks, Meals)" />
                    </div>
                    <div className="form-group">
                        <label>Price *</label>
                        <input className="input" type="number" min="0" step="0.01" value={newMenu.price} onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="form-group">
                        <label>Image URL</label>
                        <input className="input" value={newMenu.image} onChange={(e) => setNewMenu({ ...newMenu, image: e.target.value })} placeholder="Optional image URL" />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input id="menu-available" type="checkbox" checked={newMenu.available} onChange={(e) => setNewMenu({ ...newMenu, available: e.target.checked })} />
                        <label htmlFor="menu-available" style={{ margin: 0 }}>Available for sale</label>
                    </div>
                </div>
            </Modal>

            {/* Payment Modal for Cashiers */}
            <Modal isOpen={paymentModal} onClose={() => setPaymentModal(false)} title="💰 Process Payment" narrow
                footer={
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                        <button className="btn btn-secondary btn-block" onClick={() => setPaymentModal(false)}>Back</button>
                        <button className="btn btn-secondary btn-block" style={{ border: '1px dashed var(--brown-300)' }} onClick={() => submitOrder(false)} disabled={submitting}>
                            Pay Later
                        </button>
                        <button className="btn btn-primary btn-block" onClick={() => submitOrder(true)} disabled={submitting || (paymentMethod === 'Cash' && (!amountReceived || !posCashValidation.isValid))}>
                            {submitting ? 'Processing...' : 'Confirm & Place'}
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '5px 0' }}>
                    <div style={{ background: 'var(--bg-app)', padding: 15, borderRadius: 'var(--radius-md)', marginBottom: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Amount Due</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brown-700)' }}>{fmt(total)}</div>
                    </div>

                    <div className="form-group">
                        <label>Payment Method</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button className={`btn ${paymentMethod === 'Cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Cash')}>
                                <Banknote size={16} /> Cash
                            </button>
                            <button className={`btn ${paymentMethod === 'Card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Card')}>
                                <CreditCard size={16} /> Card / E-Wallet
                            </button>
                        </div>
                    </div>

                    {paymentMethod === 'Cash' && (
                        <>
                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Amount Received (₱)</span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Banknotes: ₱20, ₱50, ₱100, ₱200, ₱500, ₱1,000</span>
                                </label>
                                <input 
                                    className="input" 
                                    type="number" 
                                    step="0.01"
                                    autoFocus
                                    placeholder="Enter cash amount"
                                    value={amountReceived} 
                                    onChange={(e) => setAmountReceived(e.target.value)} 
                                />
                                <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                                    {[20, 50, 100, 200, 500, 1000].map(v => (
                                        <button 
                                            key={v} 
                                            type="button" 
                                            className={`btn btn-sm ${Number(amountReceived) === v ? 'btn-primary' : 'btn-secondary'}`} 
                                            onClick={() => setAmountReceived(v)}
                                        >
                                            ₱{v.toLocaleString()}
                                        </button>
                                    ))}
                                    <button 
                                        type="button" 
                                        className={`btn btn-sm ${Number(amountReceived) === total ? 'btn-primary' : 'btn-secondary'}`} 
                                        onClick={() => setAmountReceived(total)}
                                    >
                                        Exact ({fmt(total)})
                                    </button>
                                </div>
                            </div>

                            {amountReceived && !posCashValidation.isValid && (
                                <div style={{
                                    marginTop: 12,
                                    padding: '10px 14px',
                                    background: 'var(--danger-bg)',
                                    border: '1px solid rgba(220, 38, 38, 0.3)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--danger)',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.4
                                }}>
                                    {posCashValidation.error}
                                </div>
                            )}

                            {amountReceived && posCashValidation.isValid && (
                                <div style={{ 
                                    marginTop: 12, 
                                    padding: 14, 
                                    background: 'var(--success-bg)', 
                                    border: '1px solid var(--success-border)', 
                                    borderRadius: 'var(--radius-md)', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center' 
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.85rem' }}>Valid Payment Tendered</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Change due:</div>
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
                                        {fmt(posCashValidation.change)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Modal>

            <Modal isOpen={successModal} onClose={() => setSuccessModal(false)} title="✅ Order Placed!" narrow
                footer={<button className="btn btn-primary btn-block" onClick={() => setSuccessModal(false)}>New Order</button>}>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Order #{lastOrder?.id} submitted to kitchen</p>
                    {lastOrder?.isPaid && (
                        <div style={{ margin: '15px 0', padding: 12, background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--success)', fontWeight: 700 }}>Payment Received</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>{fmt(lastOrder.total)}</div>
                        </div>
                    )}
                    {!lastOrder?.isPaid && <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total: {fmt(lastOrder?.total)}</p>}
                </div>
            </Modal>
        </div>
    )
}
