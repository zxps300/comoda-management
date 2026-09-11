import { useEffect, useState, useMemo, useRef } from 'react'
import { menuService } from '../services/menu.service'
import { ordersService } from '../services/orders.service'
import { salesService, removedItemsService } from '../services/sales.service'
import { inventoryService } from '../services/inventory.service'
import Modal from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import {
    Plus, Minus, Trash2, Send, ShoppingCart, CreditCard, Banknote,
    Receipt, Printer, History, Search, Filter, X, ChevronDown, ChevronUp, Tag, AlertTriangle
} from 'lucide-react'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })

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

function CashAmountField({ id, value, onChange, validation }) {
    const showInvalid = value !== '' && value !== null && value !== undefined && !validation.isValid

    return (
        <div className={`pos-cash-amount-row ${showInvalid ? 'is-invalid' : ''}`}>
            <input
                id={id}
                className="input pos-cash-amount-input"
                type="number"
                step="0.01"
                autoFocus
                placeholder="Enter cash amount"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={showInvalid}
            />
            {showInvalid && (
                <span className="pos-cash-invalid-indicator" title={validation.error} aria-label={validation.error} role="img">
                    <AlertTriangle size={18} aria-hidden="true" />
                </span>
            )}
        </div>
    )
}

const DEFAULT_CATEGORIES = ['Main Course', 'Rice Meals', 'Noodles', 'Appetizers', 'Salads', 'Desserts', 'Beverages']

function loadCategories() {
    try {
        const stored = localStorage.getItem('menuCategories')
        return stored ? JSON.parse(stored) : DEFAULT_CATEGORIES
    } catch { return DEFAULT_CATEGORIES }
}

function saveCategories(cats) {
    localStorage.setItem('menuCategories', JSON.stringify(cats))
}

/* ── HistoryRow Component ────────────────────────────────────────── */
function HistoryRow({ sale, onDelete, onViewReceipt }) {
    const [expanded, setExpanded] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        await onDelete(sale.id)
        setDeleting(false)
        setConfirming(false)
    }

    return (
        <div style={{ borderBottom: '1px solid var(--cream-300)', transition: 'background 0.15s ease', background: expanded ? 'rgba(255,252,240,0.7)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
                <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        Order #{sale.orderId}
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 20,
                            background: (sale.isPaid || sale.paymentStatus === 'PAID') ? 'var(--success-bg)' : '#fef3c7',
                            color: (sale.isPaid || sale.paymentStatus === 'PAID') ? 'var(--success)' : '#d97706',
                            border: `1px solid ${(sale.isPaid || sale.paymentStatus === 'PAID') ? 'rgba(22, 163, 74, 0.25)' : 'rgba(217, 119, 6, 0.35)'}`
                        }}>
                            {(sale.isPaid || sale.paymentStatus === 'PAID') ? 'PAID' : 'PENDING'}
                        </span>
                    </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {sale.date} · {sale.time} · Cashier: <strong>{sale.cashier}</strong>
                    {sale.paymentMethod && (
                        <span style={{
                            marginLeft: 6,
                            fontSize: '0.65rem', fontWeight: 700,
                            padding: '1px 6px', borderRadius: 10,
                            background: sale.paymentMethod === 'Online Payment' ? '#ede9fe' : '#dcfce7',
                            color: sale.paymentMethod === 'Online Payment' ? '#7c3aed' : '#16a34a',
                        }}>{sale.paymentMethod}</span>
                    )}
                </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--success)' }}>{fmt(sale.total)}</div>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => onViewReceipt(sale)}><Printer size={12} /> Receipt</button>
                        {onDelete && (confirming ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--danger)', fontWeight: 600 }}>Delete?</span>
                                <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: '0.68rem', background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={handleDelete} disabled={deleting}>{deleting ? '…' : 'Yes'}</button>
                                <button className="btn btn-sm btn-secondary" style={{ padding: '3px 6px', fontSize: '0.68rem' }} onClick={() => setConfirming(false)}><X size={11} /></button>
                            </div>
                        ) : (
                            <button className="btn btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #ef9a9a' }} onClick={() => setConfirming(true)}><Trash2 size={12} /> Delete</button>
                        ))}
                    </div>
                </div>
            </div>
            {expanded && (
                <div style={{ padding: '0 16px 14px 44px', animation: 'fadeIn 0.15s ease' }}>
                    <div style={{ background: 'rgba(255,253,245,0.9)', border: '1px solid var(--cream-300)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items Ordered</div>
                        {sale.items?.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>×{item.quantity}</span></span>
                                <span style={{ fontWeight: 600 }}>{fmt(item.price * item.quantity)}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px dashed var(--cream-400)', marginTop: 8, paddingTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 3 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Total</span>
                                <span style={{ fontWeight: 800, color: 'var(--success)' }}>{fmt(sale.total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Payment Method</span>
                                <span style={{ fontWeight: 600 }}>{sale.paymentMethod || 'Cash'}</span>
                            </div>
                            {sale.paymentMethod === 'Online Payment' ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Amount Paid</span>
                                    <span>{fmt(sale.amountReceived)}</span>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Cash Received</span><span>{fmt(sale.amountReceived)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Change</span><span style={{ color: 'var(--text-secondary)' }}>{fmt(sale.change)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ── Main Unified POS Page ───────────────────────────────────────── */
export default function POS() {
    const toast = useToastContext()
    const { user } = useAuth()
    const { settings } = useSettings()

    // Top-level navigation state
    const [activeTab, setActiveTab] = useState('new_order') // new_order | unpaid | history

    // ==== POS STATES ====
    const [menu, setMenu] = useState([])
    const [catFilter, setCatFilter] = useState('All')
    const [orderType, setOrderType] = useState('Dine In') // 'Dine In' | 'Take Out'
    const [cart, setCart] = useState([])
    const [tableNo, setTableNo] = useState('')
    const [showTableKeypad, setShowTableKeypad] = useState(false)
    const [discountAmount, setDiscountAmount] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [successModal, setSuccessModal] = useState(false)
    const [lastOrder, setLastOrder] = useState(null)

    // Helper: get the effective price for an item given current order type
    const effectivePrice = (item) =>
        orderType === 'Take Out' && item.takeOutPrice != null
            ? item.takeOutPrice
            : item.price

    const [menuModalOpen, setMenuModalOpen] = useState(false)
    const [newMenu, setNewMenu] = useState({ name: '', description: '', category: '', price: '', takeOutPrice: '', isBestSeller: false, available: true, variants: [] })
    const [imageFile, setImageFile] = useState(null)
    const [menuSaving, setMenuSaving] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(null)

    // Variant picker state (for items with multiple sizes)
    const [variantPickerItem, setVariantPickerItem] = useState(null)

    // Recipe management state
    const [recipeModalOpen, setRecipeModalOpen] = useState(false)
    const [recipeItem, setRecipeItem] = useState(null)
    const [recipeIngredients, setRecipeIngredients] = useState([])
    const [inventoryItems, setInventoryItems] = useState([])
    const [recipeSaving, setRecipeSaving] = useState(false)
    const [recipeSearch, setRecipeSearch] = useState('')

    // Dynamic categories
    const [categories, setCategories] = useState(loadCategories)
    const [newCatInput, setNewCatInput] = useState('')
    const menuCategories = ['All', ...categories]
    const menuCategoryOptions = categories

    const handleAddCategory = () => {
        const trimmed = newCatInput.trim()
        if (!trimmed) return
        if (categories.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
            toast('Category already exists', 'warning'); return
        }
        const updated = [...categories, trimmed]
        setCategories(updated)
        saveCategories(updated)
        setNewCatInput('')
        toast(`Category "${trimmed}" added`, 'success')
    }

    const isAdmin = user?.role === 'Admin'
    const canManageRecipe = user?.role === 'Admin' || user?.role === 'Kitchen'

    const [paymentModal, setPaymentModal] = useState(false)
    const [amountReceived, setAmountReceived] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('Cash')
    const [quantityEditor, setQuantityEditor] = useState(null)
    const quantityReplaceOnNext = useRef(true)

    const [discountModal, setDiscountModal] = useState(false)
    const [discountInput, setDiscountInput] = useState('')

    // ==== BILLING STATES ====
    const [unpaidOrders, setUnpaidOrders] = useState([])
    const [sales, setSales] = useState([])
    const [loadingBilling, setLoadingBilling] = useState(false)
    const [receiptModal, setReceiptModal] = useState(false)
    const [lastSale, setLastSale] = useState(null)

    // History Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [filterDate, setFilterDate] = useState('')
    const [filterCashier, setFilterCashier] = useState('')

    // State for paying an existing unpaid order
    const [payUnpaidModal, setPayUnpaidModal] = useState(false)
    const [selectedUnpaidOrder, setSelectedUnpaidOrder] = useState(null)
    const [unpaidAmountReceived, setUnpaidAmountReceived] = useState('')
    const [unpaidPaymentMethod, setUnpaidPaymentMethod] = useState('Cash')
    const [processingUnpaid, setProcessingUnpaid] = useState(false)

    // Load POS menu
    useEffect(() => {
        menuService.getAll().then(async (data) => {
            const cachedMenu = [];
            const { cacheImage } = await import('../services/imageSync.service');
            for (const item of data) {
                if (item.image) {
                    item.originalImage = item.image;
                    item.image = await cacheImage(item.image);
                }
                cachedMenu.push(item);
            }
            setMenu(cachedMenu);
        }).catch(() => toast('Failed to load menu', 'error'))
    }, [toast])

    useEffect(() => {
        const refreshAvailability = () => {
            menuService.getAll().then((latest) => {
                setMenu((current) => latest.map((item) => {
                    const existing = current.find((entry) => entry.id === item.id)
                    return existing ? { ...item, image: existing.image, originalImage: existing.originalImage } : item
                }))
            }).catch(() => {})
        }
        const timer = window.setInterval(refreshAvailability, 5000)
        return () => window.clearInterval(timer)
    }, [])

    // Periodically poll active/unpaid orders and transactions in the background for real-time updates
    useEffect(() => {
        let isFirstLoad = true;
        const fetchUpdates = () => {
            if (isFirstLoad) setLoadingBilling(true);
            Promise.all([
                ordersService.getAll({ status: 'Completed,Ready,Preparing,Pending' }),
                salesService.getAll()
            ]).then(([orderData, saleData]) => {
                setUnpaidOrders(orderData.filter(o => !o.isPaid && o.status !== 'Cancelled'))
                setSales(saleData)
            }).catch(err => {
                console.error('Error background-syncing billing data:', err);
            }).finally(() => {
                if (isFirstLoad) {
                    setLoadingBilling(false);
                    isFirstLoad = false;
                }
            });
        };

        fetchUpdates();
        const interval = setInterval(fetchUpdates, 5000);
        return () => clearInterval(interval);
    }, []);

    // ==== POS LOGIC ====
    const filteredMenu = menu.filter((m) => catFilter === 'All' || (m.category && m.category.trim().toLowerCase() === catFilter.trim().toLowerCase()))

    const resetMenuForm = () => {
        setNewMenu({ name: '', description: '', category: '', price: '', takeOutPrice: '', isBestSeller: false, available: true, variants: [] })
        setImageFile(null)
    }

    const handleMenuSubmit = async () => {
        if (!newMenu.name.trim() || !newMenu.category.trim() || (newMenu.price === '' && newMenu.variants.length === 0)) {
            toast('Name, category, and at least a price or a variant are required', 'warning')
            return
        }

        setMenuSaving(true)
        try {
            const validVariants = newMenu.variants.filter(v => v.label.trim() && v.price !== '')
            let payload
            if (imageFile) {
                payload = new FormData()
                payload.append('name', newMenu.name.trim())
                payload.append('description', newMenu.description.trim())
                payload.append('category', newMenu.category.trim())
                payload.append('price', newMenu.price !== '' ? Number(newMenu.price) : (validVariants[0]?.price ?? 0))
                if (newMenu.takeOutPrice !== '' && newMenu.takeOutPrice != null) payload.append('take_out_price', Number(newMenu.takeOutPrice))
                payload.append('available', newMenu.available ? '1' : '0')
                payload.append('is_best_seller', newMenu.isBestSeller ? '1' : '0')
                payload.append('image', imageFile)
                if (validVariants.length > 0) payload.append('variants', JSON.stringify(validVariants))
            } else {
                payload = {
                    name: newMenu.name.trim(),
                    description: newMenu.description.trim(),
                    category: newMenu.category.trim(),
                    price: newMenu.price !== '' ? Number(newMenu.price) : (validVariants[0]?.price ?? 0),
                    available: newMenu.available,
                    is_best_seller: newMenu.isBestSeller,
                    ...(newMenu.takeOutPrice !== '' && newMenu.takeOutPrice != null && { take_out_price: Number(newMenu.takeOutPrice) }),
                    ...(validVariants.length > 0 && { variants: validVariants }),
                }
            }

            const item = await menuService.create(payload)
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

    // ==== RECIPE MANAGEMENT ====
    const openRecipeModal = async (item) => {
        setRecipeItem(item)
        setRecipeSearch('')
        setRecipeModalOpen(true)
        try {
            const [recipe, inv] = await Promise.all([
                menuService.getRecipe(item.id),
                inventoryItems.length > 0 ? Promise.resolve(inventoryItems) : inventoryService.getAll()
            ])
            if (inv !== inventoryItems) setInventoryItems(inv)
            setRecipeIngredients(recipe.map(r => ({
                inventory_item_id: r.inventoryItemId,
                quantity_needed: r.quantityNeeded,
                name: r.ingredientName,
                unit: r.unit,
                stockAvailable: r.stockAvailable,
            })))
        } catch {
            toast('Failed to load recipe', 'error')
        }
    }

    const handleAddIngredient = (invItem) => {
        if (recipeIngredients.some(r => r.inventory_item_id === invItem.id)) {
            toast('Ingredient already added', 'warning')
            return
        }
        setRecipeIngredients(prev => [...prev, {
            inventory_item_id: invItem.id,
            quantity_needed: '',
            name: invItem.name,
            unit: invItem.unit,
            stockAvailable: invItem.quantity,
        }])
        setRecipeSearch('')
    }

    const handleSaveRecipe = async () => {
        const valid = recipeIngredients.filter(r => r.quantity_needed !== '' && Number(r.quantity_needed) > 0)
        setRecipeSaving(true)
        try {
            await menuService.updateRecipe(recipeItem.id, valid.map(r => ({
                inventory_item_id: r.inventory_item_id,
                quantity_needed: Number(r.quantity_needed),
            })))
            toast('Recipe saved successfully', 'success')
            setRecipeModalOpen(false)
            // Refresh menu to update availability
            menuService.getAll().then(setMenu).catch(() => {})
        } catch (err) {
            toast(err.response?.data?.message || 'Failed to save recipe', 'error')
        } finally {
            setRecipeSaving(false)
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
        if (item.variants && item.variants.length > 0) {
            setVariantPickerItem(item)
            return
        }

        // Check stock limit across all variants/instances of this item in cart
        const currentQty = cart.filter((c) => c.id === item.id).reduce((s, c) => s + c.qty, 0)
        if (item.maxQuantity !== null && currentQty >= item.maxQuantity) {
            toast(`Stock limit reached. Only ${item.maxQuantity} available.`, 'warning')
            return
        }

        setCart((prev) => {
            const existing = prev.find((c) => c.id === item.id && !c.variantLabel)
            const price = effectivePrice(item)
            if (existing) return prev.map((c) => c.id === item.id && !c.variantLabel ? { ...c, qty: c.qty + 1, price } : c)
            return [...prev, { ...item, price, qty: 1, variantLabel: null }]
        })
    }

    const addVariantToCart = (item, variant) => {
        const currentQty = cart.filter((c) => c.id === item.id).reduce((s, c) => s + c.qty, 0)
        if (item.maxQuantity !== null && currentQty >= item.maxQuantity) {
            toast(`Stock limit reached. Only ${item.maxQuantity} available.`, 'warning')
            return
        }

        const price = orderType === 'Take Out' && variant.takeOutPrice != null ? variant.takeOutPrice : variant.price
        const cartKey = `${item.id}-${variant.label}`
        setCart((prev) => {
            const existing = prev.find((c) => c.id === item.id && c.variantLabel === variant.label)
            if (existing) return prev.map((c) => c.id === item.id && c.variantLabel === variant.label ? { ...c, qty: c.qty + 1 } : c)
            return [...prev, { ...item, price, qty: 1, variantId: variant.id, variantLabel: variant.label, cartKey }]
        })
        setVariantPickerItem(null)
    }

    const updateQty = (id, delta, variantLabel = null) => {
        if (delta > 0) {
            const item = menu.find(m => m.id === id)
            if (item && item.maxQuantity !== null) {
                const currentQty = cart.filter((c) => c.id === id).reduce((s, c) => s + c.qty, 0)
                if (currentQty >= item.maxQuantity) {
                    toast(`Stock limit reached. Only ${item.maxQuantity} available.`, 'warning')
                    return
                }
            }
        }
        setCart((prev) =>
            prev.map((c) => c.id === id && c.variantLabel === variantLabel ? { ...c, qty: Math.max(1, c.qty + delta) } : c)
                .filter((c) => c.qty > 0)
        )
    }

    const openQuantityEditor = (item) => {
        quantityReplaceOnNext.current = true
        setQuantityEditor({
            id: item.id,
            variantLabel: item.variantLabel,
            name: item.name + (item.variantLabel ? ` — ${item.variantLabel}` : ''),
            value: String(item.qty),
        })
    }

    const appendQuantityDigit = (digit) => {
        setQuantityEditor((current) => {
            if (!current) return current
            const nextValue = quantityReplaceOnNext.current || current.value === '0'
                ? digit
                : `${current.value}${digit}`
            quantityReplaceOnNext.current = false
            return { ...current, value: nextValue.slice(0, 4) }
        })
    }

    const backspaceQuantity = () => {
        quantityReplaceOnNext.current = false
        setQuantityEditor((current) => current
            ? { ...current, value: current.value.slice(0, -1) }
            : current)
    }

    const clearQuantity = () => {
        quantityReplaceOnNext.current = false
        setQuantityEditor((current) => current ? { ...current, value: '' } : current)
    }

    const saveManualQuantity = () => {
        if (!quantityEditor) return

        const requestedQuantity = Number.parseInt(quantityEditor.value, 10)
        if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
            toast('Quantity must be at least 1.', 'warning')
            return
        }

        const menuItem = menu.find((item) => item.id === quantityEditor.id)
        const otherQuantity = cart
            .filter((item) => item.id === quantityEditor.id && item.variantLabel !== quantityEditor.variantLabel)
            .reduce((sum, item) => sum + item.qty, 0)
        const maximumForThisLine = menuItem?.maxQuantity == null
            ? null
            : Math.max(0, menuItem.maxQuantity - otherQuantity)

        if (maximumForThisLine !== null && requestedQuantity > maximumForThisLine) {
            toast(`Stock limit reached. Only ${maximumForThisLine} available for this item.`, 'warning')
            return
        }

        setCart((current) => current.map((item) => (
            item.id === quantityEditor.id && item.variantLabel === quantityEditor.variantLabel
                ? { ...item, qty: requestedQuantity }
                : item
        )))
        setQuantityEditor(null)
    }
    const removeItem = (id, variantLabel = null) => {
        const item = cart.find(c => c.id === id && c.variantLabel === variantLabel)
        if (item) {
            // Log removal silently (fire-and-forget, don't block UI)
            removedItemsService.logRemoval({
                itemName: item.name + (item.variantLabel ? ` (${item.variantLabel})` : ''),
                price:    item.price,
                quantity: item.qty,
                cashier:  user?.fullName || user?.username || 'Cashier',
                reason:   'Removed from cart before order placement',
            }).catch(() => {}) // silent fail — don't disrupt cashier workflow
        }
        setCart(prev => prev.filter(c => !(c.id === id && c.variantLabel === variantLabel)))
    }
    const clearCart = () => { setCart([]); setTableNo(''); setDiscountAmount(0) }

    // When order type changes, reprice all items in the cart
    const handleOrderTypeChange = (type) => {
        setOrderType(type)
        setCart((prev) => prev.map((cartItem) => {
            const menuItem = menu.find(m => m.id === cartItem.id)
            if (!menuItem) return cartItem
            const variant = cartItem.variantId
                ? menuItem.variants?.find(v => v.id === cartItem.variantId)
                : null
            const newPrice = variant
                ? (type === 'Take Out' && variant.takeOutPrice != null ? variant.takeOutPrice : variant.price)
                : (type === 'Take Out' && menuItem.takeOutPrice != null ? menuItem.takeOutPrice : menuItem.price)
            return { ...cartItem, price: newPrice }
        }))
        if (type === 'Take Out') setTableNo('')
    }

    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
    const discountedSubtotal = Math.max(0, subtotal - discountAmount)
    const tax = 0
    const total = discountedSubtotal
    const posCashValidation = validateCashBanknote(amountReceived, total)
    const changeAmount = posCashValidation.isValid ? posCashValidation.change : 0

    const applyDiscount = () => {
        const val = Number(discountInput)
        if (isNaN(val) || val < 0) {
            toast('Invalid discount amount', 'warning')
            return
        }
        if (val > subtotal) {
            toast('Discount cannot exceed subtotal', 'warning')
            return
        }
        setDiscountAmount(val)
        setDiscountModal(false)
        setDiscountInput('')
        toast('Discount applied', 'success')
    }

    const handlePlaceOrder = () => {
        if (orderType === 'Dine In' && !tableNo) { toast('Please enter a table number', 'warning'); return }
        if (orderType === 'Dine In' && Number(tableNo) > 15) { toast('Table limit reached (maximum 15 tables only)', 'error'); return }
        if (cart.length === 0) { toast('Cart is empty', 'warning'); return }
        if (user?.role === 'Cashier' || user?.role === 'Admin') {
            setAmountReceived('')
            setPaymentModal(true)
        } else {
            submitOrder(false)
        }
    }

    const submitOrder = async (isPaid = false) => {
        if (isPaid && paymentMethod === 'Cash') {
            const validation = validateCashBanknote(amountReceived, total)
            if (!validation.isValid) {
                toast(validation.error, 'error')
                return
            }
        }
        setSubmitting(true)
        try {
            const orderData = {
                orderType,
                tableNumber: orderType === 'Dine In' ? Number(tableNo) : null,
                customerName: orderType === 'Dine In' ? `Table ${tableNo}` : null,
                items: cart.map((c) => ({ menuItemId: c.id, variantId: c.variantId || null, quantity: c.qty })),
                subtotal,
                discount: discountAmount,
                tax, total,
                isPaid,
                paymentMethod: isPaid ? paymentMethod : null,
                amountReceived: isPaid ? (Number(amountReceived) || total) : 0,
                changeAmount: isPaid ? changeAmount : 0,
                cashier: user?.fullName || user?.username || 'Cashier'
            }
            const order = await ordersService.create(orderData)
            localStorage.setItem('comoda_inventory_changed_at', String(Date.now()))
            window.dispatchEvent(new Event('comoda:inventory-changed'))
            // Pull the updated recipe availability immediately so ingredients that
            // reached zero are shown as Out of Stock without a page reload.
            try {
                const updatedMenu = await menuService.getAll()
                setMenu(updatedMenu)
            } catch {
                // The order is already saved; the regular menu refresh can recover
                // without incorrectly reporting that checkout failed.
            }
            setLastOrder(order)
            clearCart()
            setPaymentModal(false)
            setSuccessModal(true)
            toast(isPaid ? 'Payment received & Order placed!' : 'Order submitted to kitchen', 'success')
            if (order.unavailable_items?.length > 0) {
                toast(`Out of stock: ${order.unavailable_items.join(', ')}`, 'warning')
            }
        } catch (err) {
            toast(err.response?.data?.message || 'Error placing order', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const openPosReceipt = async () => {
        if (!lastOrder) return
        setSuccessModal(false)
        // Try to load the actual sale record for this order (has real sale ID / transaction ID)
        try {
            const allSales = await salesService.getAll()
            const realSale = allSales.find(s => s.orderId === lastOrder.id)
            if (realSale) {
                setLastSale(realSale)
                setReceiptModal(true)
                return
            }
        } catch { /* fall through to ephemeral data */ }
        // Fallback: construct from in-memory state if API unavailable
        setLastSale({
            orderId:        lastOrder.id,
            date:           new Date().toISOString().split('T')[0],
            time:           new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cashier:        user?.fullName || user?.username || 'Cashier',
            items:          lastOrder.items || cart,
            total:          lastOrder.total,
            isPaid:         lastOrder.isPaid,
            paymentMethod:  paymentMethod,
            amountReceived: Number(amountReceived) || lastOrder.total,
            change:         changeAmount,
        })
        setReceiptModal(true)
    }

    // ==== BILLING LOGIC ====
    const unpaidCashValidation = validateCashBanknote(unpaidAmountReceived, selectedUnpaidOrder?.total || 0)
    const unpaidChange = unpaidCashValidation.isValid ? unpaidCashValidation.change : (Number(unpaidAmountReceived) - (selectedUnpaidOrder?.total || 0))

    const processUnpaidPayment = async () => {
        if (unpaidPaymentMethod === 'Cash') {
            const validation = validateCashBanknote(unpaidAmountReceived, selectedUnpaidOrder?.total || 0)
            if (!validation.isValid) {
                toast(validation.error, 'error')
                return
            }
        }
        setProcessingUnpaid(true)
        try {
            const sale = await salesService.create({
                orderId: selectedUnpaidOrder.id,
                total: selectedUnpaidOrder.total,
                amountReceived: Number(unpaidAmountReceived),
                change: unpaidChange,
                cashier: user?.fullName || user?.username || 'Cashier',
                paymentMethod: unpaidPaymentMethod,
            })
            setLastSale({ ...sale, order: selectedUnpaidOrder })
            setPayUnpaidModal(false)
            setReceiptModal(true)
            toast('Payment processed!', 'success')
            // Refresh billing data
            setActiveTab('new_order'); setTimeout(() => setActiveTab('unpaid'), 50);
        } catch (err) {
            toast(err.response?.data?.message || 'Error processing payment', 'error')
        } finally { setProcessingUnpaid(false) }
    }

    const [deletingAll, setDeletingAll] = useState(false)

    const deleteSale = async (id) => {
        try {
            await salesService.delete(id)
            setSales(prev => prev.filter(s => s.id !== id))
            toast('Transaction record deleted', 'success')
        } catch { toast('Failed to delete transaction', 'error') }
    }

    const deleteAllSales = async () => {
        if (sales.length === 0) return
        const count = hasFilters ? filteredSales.length : sales.length
        if (count === 0) return
        const msg = hasFilters
            ? `Are you sure you want to delete all ${count} filtered transaction record(s)? This action cannot be undone.`
            : `Are you sure you want to delete all ${sales.length} transaction records? This action cannot be undone.`
        if (!window.confirm(msg)) return

        setDeletingAll(true)
        try {
            if (hasFilters && filteredSales.length < sales.length) {
                await Promise.all(filteredSales.map(s => salesService.delete(s.id)))
                setSales(prev => prev.filter(s => !filteredSales.some(f => f.id === s.id)))
                toast(`${count} transaction record(s) deleted`, 'success')
            } else {
                await salesService.deleteAll()
                setSales([])
                toast('All transaction records deleted', 'success')
            }
        } catch (err) {
            try {
                const toDelete = hasFilters ? filteredSales : sales
                await Promise.all(toDelete.map(s => salesService.delete(s.id)))
                setSales(prev => prev.filter(s => !toDelete.some(f => f.id === s.id)))
                toast('Transaction records deleted', 'success')
            } catch {
                toast(err.response?.data?.message || 'Failed to delete transaction records', 'error')
            }
        } finally {
            setDeletingAll(false)
        }
    }

    const cashiers = useMemo(() => [...new Set(sales.map(s => s.cashier).filter(Boolean))], [sales])
    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            const q = searchQuery.toLowerCase()
            const matchSearch = !q || String(s.orderId).includes(q) || s.cashier?.toLowerCase().includes(q)
            const matchDate = !filterDate || s.date === filterDate
            const matchCashier = !filterCashier || s.cashier === filterCashier
            return matchSearch && matchDate && matchCashier
        })
    }, [sales, searchQuery, filterDate, filterCashier])

    const clearFilters = () => { setSearchQuery(''); setFilterDate(''); setFilterCashier('') }
    const hasFilters = searchQuery || filterDate || filterCashier

    return (
        <div className="pos-page-wrapper">
            <div className="page-header" style={{ marginBottom: 15 }}>
                <div></div>
            </div>

            {/* TAB NAVIGATION BAR */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 15, borderBottom: '2px solid var(--cream-300)', alignItems: 'flex-end' }}>
                <button
                    className={`btn ${activeTab === 'new_order' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
                    onClick={() => setActiveTab('new_order')}
                >
                    <ShoppingCart size={16} /> New Order
                </button>
                <button
                    className={`btn ${activeTab === 'unpaid' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none', position: 'relative' }}
                    onClick={() => setActiveTab('unpaid')}
                >
                    <Receipt size={16} /> Active / Unpaid
                    {unpaidOrders.length > 0 && activeTab !== 'unpaid' && (
                        <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: 10, fontWeight: 'bold' }}>{unpaidOrders.length}</span>
                    )}
                </button>
                <button
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
                    onClick={() => setActiveTab('history')}
                >
                    <History size={16} /> Transaction History
                </button>

                {/* Spacer to push action buttons to the far right */}
                <div style={{ flex: 1 }} />

                {activeTab === 'new_order' && isAdmin && (
                    <button className="btn btn-primary" style={{ whiteSpace: 'nowrap', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setMenuModalOpen(true)}>
                        <Plus size={16} /> Add Menu Item
                    </button>
                )}
            </div>

            {/* Category horizontal scrolling bar — only when on New Order tab */}
            {activeTab === 'new_order' && (
                <div className="category-scroll-bar">
                    {menuCategories.map((c) => (
                        <button
                            key={c}
                            className={`filter-tab ${catFilter === c ? 'active' : ''}`}
                            onClick={() => setCatFilter(c)}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}

            {/* ==== TAB: NEW ORDER (POS) ==== */}
            {activeTab === 'new_order' && (
                <div className="pos-layout" style={{ flex: 1, minHeight: 0 }}>
                    {/* Menu */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', height: '100%' }}>
                        <div className="menu-grid" style={{ overflowY: 'auto', paddingBottom: 20, flex: 1 }}>
                            {filteredMenu.length === 0 ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <p style={{ fontSize: '0.9rem' }}>No menu items found.</p>
                                </div>
                            ) : filteredMenu.map((item) => (
                                <div
                                    className="menu-card"
                                    key={item.id}
                                    onClick={() => item.available && addToCart(item)}
                                    style={{
                                        position: 'relative',
                                        opacity: item.available ? 1 : 0.55,
                                        cursor: item.available ? 'pointer' : 'not-allowed',
                                        filter: item.available ? 'none' : 'grayscale(60%)'
                                    }}
                                >
                                    {/* Best Seller Ribbon */}
                                    {item.isBestSeller && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, zIndex: 3,
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            color: '#fff', fontSize: '0.6rem', fontWeight: 800,
                                            padding: '4px 10px 4px 6px',
                                            borderBottomRightRadius: 10,
                                            letterSpacing: '0.06em',
                                            textTransform: 'uppercase',
                                            boxShadow: '2px 2px 8px rgba(0,0,0,0.2)',
                                        }}>⭐ Best Seller</div>
                                    )}
                                    {/* Availability Badge */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        zIndex: 2,
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        padding: '3px 8px',
                                        borderRadius: 20,
                                        letterSpacing: '0.04em',
                                        background: item.available ? 'rgba(22,163,74,0.92)' : 'rgba(220,38,38,0.88)',
                                        color: '#fff',
                                        backdropFilter: 'blur(4px)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                    }}>
                                        {item.available
                                            ? item.category?.trim().toLowerCase() === 'beverages'
                                                ? `● ${item.availableServings || 0} pcs`
                                                : `● ${item.availableServings || 0} serving${item.availableServings === 1 ? '' : 's'}`
                                            : '✕ Out of Stock'}
                                    </div>

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
                                                border: 'none',
                                                background: 'rgba(255,255,255,0.92)',
                                                borderRadius: '999px',
                                                padding: '8px',
                                                cursor: 'pointer',
                                                boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                    {/* Recipe Button */}
                                    {canManageRecipe && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); openRecipeModal(item) }}
                                            title="Manage recipe"
                                            style={{
                                                position: 'absolute',
                                                top: isAdmin ? 46 : 10,
                                                right: 10,
                                                zIndex: 2,
                                                border: 'none',
                                                background: item.recipe && item.recipe.length > 0 ? 'rgba(34,197,94,0.92)' : 'rgba(255,255,255,0.92)',
                                                color: item.recipe && item.recipe.length > 0 ? '#fff' : 'var(--brown-700)',
                                                borderRadius: '999px',
                                                padding: '6px 8px',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 3,
                                            }}
                                        >
                                            📋{item.recipe && item.recipe.length > 0 ? item.recipe.length : ''}
                                        </button>
                                    )}
                                    {item.image ? (
                                        <img
                                            className="menu-card-img"
                                            src={item.image}
                                            alt={item.name}
                                            onError={(e) => { e.target.src = 'https://placehold.co/400x300/f5e6d3/6f4e37?text=No+Image'; e.target.onerror = null; }}
                                        />
                                    ) : (
                                        <div className="menu-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream-200)', color: 'var(--brown-400)', flexDirection: 'column', gap: 5 }}>
                                            <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>No Image</span>
                                        </div>
                                    )}
                                    <div className="menu-card-body">
                                        <div className="menu-card-cat" style={{ textTransform: 'capitalize' }}>{(item.category || '').toLowerCase()}</div>
                                        <div className="menu-card-name" style={{ textTransform: 'capitalize' }}>{(item.name || '').toLowerCase()}</div>
                                        {item.description && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {item.description}
                                            </div>
                                        )}
                                        {item.variants && item.variants.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                                {item.variants.map(v => {
                                                    const vPrice = orderType === 'Take Out' && v.takeOutPrice != null ? v.takeOutPrice : v.price
                                                    return (
                                                        <span key={v.id} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: 'var(--cream-200)', color: 'var(--brown-700)', border: '1px solid var(--cream-400)' }}>
                                                            {fmt(vPrice)} <span style={{ fontWeight: 400, opacity: 0.75 }}>({v.label})</span>
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="menu-card-price">{fmt(effectivePrice(item))}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Order Panel */}
                    <div className="order-panel" style={{ flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                        <div className="order-panel-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <ShoppingCart size={18} /><strong>Current Order</strong>
                                {cart.length > 0 && <span className="nav-badge" style={{ background: 'var(--brown-600)' }}>{cart.reduce((s, c) => s + c.qty, 0)}</span>}
                            </div>
                            {/* Dine In / Take Out Toggle */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderRadius: 8, overflow: 'hidden', border: '2px solid var(--cream-400)', marginBottom: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => handleOrderTypeChange('Dine In')}
                                    style={{
                                        padding: '8px 0',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.18s',
                                        background: orderType === 'Dine In' ? 'var(--brown-700)' : '#fff',
                                        color: orderType === 'Dine In' ? '#fff' : 'var(--text-muted)',
                                    }}
                                >🍽️ Dine In</button>
                                <button
                                    type="button"
                                    onClick={() => handleOrderTypeChange('Take Out')}
                                    style={{
                                        padding: '8px 0',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        border: 'none',
                                        borderLeft: '1px solid var(--cream-400)',
                                        cursor: 'pointer',
                                        transition: 'all 0.18s',
                                        background: orderType === 'Take Out' ? '#f97316' : '#fff',
                                        color: orderType === 'Take Out' ? '#fff' : 'var(--text-muted)',
                                    }}
                                >🛍️ Take Out</button>
                            </div>
                            {orderType === 'Dine In' && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowTableKeypad(prev => !prev)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            border: `2px solid ${tableNo ? 'var(--brown-600)' : 'var(--cream-400)'}`,
                                            borderRadius: 10,
                                            background: tableNo ? 'var(--brown-50, #faf5ef)' : '#fff',
                                            color: tableNo ? 'var(--brown-800)' : 'var(--text-muted)',
                                            fontSize: '0.88rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.18s',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <span>{tableNo ? `🍽️ Table ${tableNo}` : '🍽️ Select Table (1–15) *'}</span>
                                        <ChevronDown size={16} style={{ transform: showTableKeypad ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </button>

                                    {/* Floating Table Keypad */}
                                    {showTableKeypad && (
                                        <>
                                            <div onClick={() => setShowTableKeypad(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                                            <div style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 6px)',
                                                left: 0,
                                                right: 0,
                                                zIndex: 999,
                                                background: '#fff',
                                                border: '2px solid var(--cream-400)',
                                                borderRadius: 14,
                                                padding: 10,
                                                boxShadow: '0 12px 40px rgba(120,80,30,0.22), 0 4px 12px rgba(0,0,0,0.08)',
                                                animation: 'tableKeypadIn 0.18s ease-out',
                                            }}>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, textAlign: 'center' }}>Select Table Number</div>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                                    gap: 6,
                                                }}>
                                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                                                        <button
                                                            key={num}
                                                            type="button"
                                                            onClick={() => { setTableNo(String(num)); setShowTableKeypad(false) }}
                                                            style={{
                                                                height: 44,
                                                                border: `1.5px solid ${String(num) === tableNo ? 'var(--brown-600)' : 'var(--cream-400)'}`,
                                                                borderRadius: 10,
                                                                background: String(num) === tableNo ? 'var(--brown-700)' : '#fff',
                                                                color: String(num) === tableNo ? '#fff' : 'var(--brown-800)',
                                                                fontSize: '0.95rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s',
                                                                fontFamily: 'inherit',
                                                            }}
                                                            onMouseEnter={e => { if (String(num) !== tableNo) { e.target.style.borderColor = 'var(--brown-500)'; e.target.style.background = 'var(--brown-50, #faf5ef)' } }}
                                                            onMouseLeave={e => { if (String(num) !== tableNo) { e.target.style.borderColor = 'var(--cream-400)'; e.target.style.background = '#fff' } }}
                                                        >
                                                            {num}
                                                        </button>
                                                    ))}
                                                </div>
                                                {tableNo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setTableNo(''); setShowTableKeypad(false) }}
                                                        style={{
                                                            width: '100%',
                                                            marginTop: 8,
                                                            padding: '8px',
                                                            border: '1px solid var(--cream-400)',
                                                            borderRadius: 8,
                                                            background: 'var(--cream-100, #f5f0e8)',
                                                            color: 'var(--danger, #dc3545)',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            fontFamily: 'inherit',
                                                        }}
                                                    >
                                                        ✕ Clear Selection
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="order-items-list" style={{ overflowY: 'auto' }}>
                            {cart.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                    {/* Premium empty state image */}
                                    <div style={{
                                        width: '100%',
                                        position: 'relative',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                        margin: '12px 0 8px',
                                        boxShadow: '0 4px 20px rgba(120,80,30,0.18)',
                                    }}>
                                        <img
                                            src="/pos-empty.png"
                                            alt="Fine dining"
                                            style={{
                                                width: '100%',
                                                height: 200,
                                                objectFit: 'cover',
                                                display: 'block',
                                                filter: 'brightness(0.82)',
                                            }}
                                        />
                                        {/* Overlay text */}
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(to top, rgba(60,30,10,0.75) 0%, transparent 55%)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'flex-end',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.01em', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                                Ready to take an order?
                                            </div>
                                            <div style={{ color: 'rgba(255,220,160,0.9)', fontSize: '0.72rem', marginTop: 3, fontWeight: 500 }}>
                                                Select items from the menu to get started
                                            </div>
                                        </div>
                                    </div>
                                    {/* Decorative divider */}
                                    <div style={{ width: '80%', height: 1, background: 'linear-gradient(to right, transparent, var(--cream-300), transparent)', margin: '6px 0' }} />
                                    <div style={{ color: 'var(--text-light)', fontSize: '0.75rem', marginTop: 4 }}>🍽️ Cart is empty</div>
                                </div>
                            ) : cart.map((item) => (
                                <div className="order-item-row" key={item.variantLabel ? `${item.id}-${item.variantLabel}` : item.id}>
                                    <div style={{ flex: 1 }}>
                                        <div className="order-item-name">
                                            {item.name}{item.variantLabel && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>— {item.variantLabel}</span>}
                                        </div>
                                        <div className="order-item-price">{fmt(item.price)} × {item.qty} = {fmt(item.price * item.qty)}</div>
                                    </div>
                                    <div className="qty-controls">
                                        <button className="qty-btn" onClick={() => updateQty(item.id, -1, item.variantLabel)}><Minus size={12} /></button>
                                        <button
                                            type="button"
                                            className="qty-value qty-value-button"
                                            onClick={() => openQuantityEditor(item)}
                                            aria-label={`Enter quantity for ${item.name}${item.variantLabel ? ` ${item.variantLabel}` : ''}`}
                                            title="Enter quantity"
                                        >
                                            {item.qty}
                                        </button>
                                        <button className="qty-btn" onClick={() => updateQty(item.id, 1, item.variantLabel)}><Plus size={12} /></button>
                                        <button className="qty-btn" style={{ color: 'var(--danger)' }} onClick={() => removeItem(item.id, item.variantLabel)}><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="order-panel-footer">
                            <div className="order-totals">
                                <div className="order-total-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                                {discountAmount > 0 && (
                                    <div className="order-total-row" style={{ color: 'var(--danger)' }}><span>Discount</span><span>-{fmt(discountAmount)}</span></div>
                                )}
                                <div className="order-total-row total"><span>Total</span><span>{fmt(total)}</span></div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <button className="btn btn-secondary btn-block" style={{ fontSize: '0.8rem', padding: '6px' }} onClick={() => setDiscountModal(true)} disabled={cart.length === 0}>
                                    <Tag size={13} /> {discountAmount > 0 ? 'Edit Discount' : 'Add Discount'}
                                </button>
                                {discountAmount > 0 && (
                                    <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setDiscountAmount(0)}><Trash2 size={13} color="var(--danger)" /></button>
                                )}
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
            )}

            {/* ==== TAB: ACTIVE / UNPAID ORDERS ==== */}
            {activeTab === 'unpaid' && (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--cream-300)', background: 'linear-gradient(135deg, rgba(255,253,245,0.95), rgba(250,243,225,0.95))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="card-title">Active & Unpaid Orders</span>
                            <span className={`badge ${unpaidOrders.length > 0 ? 'badge-warning' : 'badge-muted'}`}>{unpaidOrders.length}</span>
                        </div>

                        {loadingBilling ? (
                            <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
                        ) : unpaidOrders.length === 0 ? (
                            <div className="empty-state" style={{ padding: '60px 0' }}>
                                <Receipt size={36} /><h3>No unpaid orders</h3><p>All tables are fully settled.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15, padding: 20 }}>
                                {unpaidOrders.map((o) => (
                                    <div key={o.id} style={{ background: '#fff', border: '1px solid var(--cream-300)', borderRadius: 'var(--radius-md)', padding: 15, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'var(--shadow-sm)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                                {o.orderType === 'Take Out'
                                                    ? `🛍️ Take Out #${o.takeOutNumber}`
                                                    : `🍽️ Table ${o.tableNumber}`}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: o.orderType === 'Take Out' ? 'rgba(249,115,22,0.12)' : 'rgba(20,184,166,0.12)', color: o.orderType === 'Take Out' ? '#f97316' : '#0d9488', border: o.orderType === 'Take Out' ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(20,184,166,0.3)' }}>
                                                    {o.orderType === 'Take Out' ? '🛍 Take Out' : '🍽 Dine In'}
                                                </span>
                                                <StatusBadge status={o.status} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                             <span>Order #{o.id} · {o.items?.length} items</span>
                                             <span style={{ 
                                                 fontSize: '0.72rem', 
                                                 fontWeight: 700, 
                                                 padding: '2px 8px', 
                                                 borderRadius: 12, 
                                                 background: o.paymentMethod === 'Online Payment' ? 'rgba(37,99,235,0.12)' : 'rgba(161,121,68,0.12)', 
                                                 color: o.paymentMethod === 'Online Payment' ? '#2563eb' : '#a17944',
                                                 border: o.paymentMethod === 'Online Payment' ? '1px solid rgba(37,99,235,0.2)' : '1px solid rgba(161,121,68,0.2)'
                                             }}>
                                                 {o.paymentMethod === 'Online Payment' ? '💳 Online Payment' : '💵 Cash'}
                                             </span>
                                         </div>
                                        <div style={{ background: 'var(--cream-100)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: '0.8rem', maxHeight: 80, overflowY: 'auto' }}>
                                            {o.items?.map((i, idx) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{i.name}</span><span>x{i.quantity}</span></div>)}
                                        </div>
                                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--cream-200)' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--brown-700)', fontSize: '1.2rem' }}>{fmt(o.total)}</div>
                                            <button className="btn btn-primary" onClick={() => { 
                                                 setSelectedUnpaidOrder(o); 
                                                 const method = o.paymentMethod || 'Cash';
                                                 setUnpaidPaymentMethod(method); 
                                                 setUnpaidAmountReceived(method === 'Online Payment' ? o.total : ''); 
                                                 setPayUnpaidModal(true); 
                                             }}>
                                                <Receipt size={14} /> Pay Now
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==== TAB: TRANSACTION HISTORY ==== */}
            {activeTab === 'history' && (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--cream-300)', background: 'linear-gradient(135deg, rgba(255,253,245,0.95), rgba(250,243,225,0.95))' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <History size={18} style={{ color: 'var(--brown-600)' }} />
                                <span className="card-title" style={{ flex: 1 }}>Completed Transactions</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--success-bg)', color: 'var(--success)' }}>
                                    {filteredSales.length} records
                                </span>
                                {hasFilters && <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--warning-bg)', color: 'var(--warning)', cursor: 'pointer' }} onClick={clearFilters}>Clear Filters</span>}
                                {user?.role === 'Admin' && (
                                <button
                                    type="button"
                                    onClick={deleteAllSales}
                                    disabled={deletingAll || filteredSales.length === 0}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '4px 12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        borderRadius: 6,
                                        border: '1px solid rgba(220, 38, 38, 0.3)',
                                        background: 'rgba(220, 38, 38, 0.08)',
                                        color: 'var(--danger)',
                                        cursor: (deletingAll || filteredSales.length === 0) ? 'not-allowed' : 'pointer',
                                        opacity: (deletingAll || filteredSales.length === 0) ? 0.5 : 1,
                                        transition: 'all 0.15s ease'
                                    }}
                                    title="Delete all transaction records"
                                >
                                    <Trash2 size={13} />
                                    {deletingAll ? 'Deleting...' : (hasFilters ? 'Delete Filtered' : 'Delete All')}
                                </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input className="input" style={{ paddingLeft: 30, height: 34, fontSize: '0.8rem' }} placeholder="Search order # or cashier…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                </div>
                                <input className="input" type="date" style={{ width: 150, height: 34, fontSize: '0.8rem' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                                <select className="input" style={{ width: 140, height: 34, fontSize: '0.8rem' }} value={filterCashier} onChange={e => setFilterCashier(e.target.value)}>
                                    <option value="">All Cashiers</option>
                                    {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ overflowY: 'auto' }}>
                            {loadingBilling ? (
                                <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
                            ) : filteredSales.length === 0 ? (
                                <div className="empty-state" style={{ padding: '60px 0' }}>
                                    <Receipt size={36} /><h3>No matching transactions</h3>
                                </div>
                            ) : (
                                filteredSales.map(s => <HistoryRow key={s.id} sale={s} onDelete={user?.role === 'Admin' ? deleteSale : null} onViewReceipt={(sale) => { setLastSale(sale); setReceiptModal(true) }} />)
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==== MODALS ==== */}

            <Modal
                isOpen={Boolean(quantityEditor)}
                onClose={() => setQuantityEditor(null)}
                title="Enter Item Quantity"
                narrow
                footer={<>
                    <button className="btn btn-secondary btn-block" onClick={() => setQuantityEditor(null)}>Cancel</button>
                    <button className="btn btn-primary btn-block" onClick={saveManualQuantity} disabled={!Number.parseInt(quantityEditor?.value, 10)}>Apply Quantity</button>
                </>}
            >
                {quantityEditor && (() => {
                    const menuItem = menu.find((item) => item.id === quantityEditor.id)
                    const otherQuantity = cart
                        .filter((item) => item.id === quantityEditor.id && item.variantLabel !== quantityEditor.variantLabel)
                        .reduce((sum, item) => sum + item.qty, 0)
                    const maximumForThisLine = menuItem?.maxQuantity == null
                        ? null
                        : Math.max(0, menuItem.maxQuantity - otherQuantity)

                    return (
                        <div className="pos-quantity-editor">
                            <div className="pos-quantity-item-name">{quantityEditor.name}</div>
                            <label htmlFor="pos-manual-quantity">Quantity</label>
                            <input
                                id="pos-manual-quantity"
                                className="pos-quantity-display"
                                type="text"
                                inputMode="none"
                                readOnly
                                autoFocus
                                value={quantityEditor.value || '0'}
                                onKeyDown={(event) => {
                                    if (/^[0-9]$/.test(event.key)) {
                                        event.preventDefault()
                                        appendQuantityDigit(event.key)
                                    } else if (event.key === 'Backspace') {
                                        event.preventDefault()
                                        backspaceQuantity()
                                    } else if (event.key === 'Enter') {
                                        event.preventDefault()
                                        saveManualQuantity()
                                    }
                                }}
                                aria-label="Item quantity"
                            />
                            <div className="pos-quantity-stock-note">
                                {maximumForThisLine === null
                                    ? 'Enter the quantity needed.'
                                    : `${maximumForThisLine} maximum available for this item.`}
                            </div>
                            <div className="pos-quantity-keypad" role="group" aria-label="Quantity keypad">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                                    <button type="button" key={digit} onClick={() => appendQuantityDigit(String(digit))}>{digit}</button>
                                ))}
                                <button type="button" className="clear" onClick={clearQuantity}>Clear</button>
                                <button type="button" onClick={() => appendQuantityDigit('0')}>0</button>
                                <button type="button" className="backspace" onClick={backspaceQuantity} aria-label="Backspace">⌫</button>
                            </div>
                        </div>
                    )
                })()}
            </Modal>

            {/* Admin Add Menu Item Modal */}
            <Modal isOpen={menuModalOpen} onClose={() => setMenuModalOpen(false)} title="➕ Add New Menu Item" narrow
                footer={ <>
                    <button className="btn btn-secondary btn-block" onClick={() => setMenuModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary btn-block" onClick={handleMenuSubmit} disabled={menuSaving}>{menuSaving ? 'Saving...' : 'Save Item'}</button>
                </> }
            >
                <div className="form-group">
                    <label>Name *</label>
                    <input className="input" value={newMenu.name} onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} placeholder="Menu item name" />
                </div>
                <div className="form-group">
                    <label>Description <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>— shown on menu card</span></label>
                    <textarea className="input" rows={2} style={{ resize: 'vertical', minHeight: 56 }} value={newMenu.description} onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })} placeholder="e.g. Handmade Pasta, Fresh Prawns, Homemade Tomato Sauce" />
                </div>
                <div className="form-group">
                    <label>Category *</label>
                    <select className="input" value={newMenu.category} onChange={(e) => setNewMenu({ ...newMenu, category: e.target.value })}>
                        <option value="">Select category</option>
                        {menuCategoryOptions.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                    {/* Add Category Inline */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <input
                            className="input"
                            style={{ flex: 1, height: 32, fontSize: '0.82rem' }}
                            placeholder="Add new category…"
                            value={newCatInput}
                            onChange={e => setNewCatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                        />
                        <button type="button" className="btn btn-primary" style={{ padding: '0 12px', height: 32, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleAddCategory}>
                            <Plus size={13} /> Add
                        </button>
                    </div>
                </div>
                <div className="form-group">
                    <label>Dine In Price (₱) <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>— optional if using variants</span></label>
                    <input className="input" type="number" min="0" step="0.01" value={newMenu.price} onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })} placeholder="0.00" />
                </div>
                <div className="form-group">
                    <label>Take Out Price (₱) <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>— leave empty if same as Dine In</span></label>
                    <input className="input" type="number" min="0" step="0.01" value={newMenu.takeOutPrice ?? ''} onChange={(e) => setNewMenu({ ...newMenu, takeOutPrice: e.target.value })} placeholder="Same as dine-in if empty" />
                </div>
                <div className="form-group">
                    <label>Image</label>
                    <input className="input" type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setImageFile(file)
                        if (file && !newMenu.name.trim()) {
                            const nameFromFile = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
                            setNewMenu((prev) => ({ ...prev, name: nameFromFile }))
                        }
                    }} />
                    {imageFile && <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selected file: {imageFile.name}</div>}
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input id="menu-available" type="checkbox" checked={newMenu.available} onChange={(e) => setNewMenu({ ...newMenu, available: e.target.checked })} />
                    <label htmlFor="menu-available" style={{ margin: 0 }}>Available for sale</label>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input id="menu-bestseller" type="checkbox" checked={newMenu.isBestSeller} onChange={(e) => setNewMenu({ ...newMenu, isBestSeller: e.target.checked })} />
                    <label htmlFor="menu-bestseller" style={{ margin: 0 }}>⭐ Mark as Best Seller</label>
                </div>
                {/* Variants Section */}
                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ margin: 0 }}>Price Variants <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>— optional, e.g. 2pax / 4pax</span></label>
                        <button type="button" className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.78rem', height: 28 }}
                            onClick={() => setNewMenu(prev => ({ ...prev, variants: [...prev.variants, { label: '', price: '', takeOutPrice: '' }] }))}
                        ><Plus size={12} /> Add Size</button>
                    </div>
                    {newMenu.variants.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>No variants — single price above will be used.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {newMenu.variants.map((v, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                                    <input className="input" style={{ height: 32, fontSize: '0.8rem' }} placeholder="Label (e.g. 2pax)"
                                        value={v.label} onChange={e => setNewMenu(prev => { const vs = [...prev.variants]; vs[i] = { ...vs[i], label: e.target.value }; return { ...prev, variants: vs } })} />
                                    <input className="input" style={{ height: 32, fontSize: '0.8rem' }} type="number" min="0" step="0.01" placeholder="Dine In ₱"
                                        value={v.price} onChange={e => setNewMenu(prev => { const vs = [...prev.variants]; vs[i] = { ...vs[i], price: e.target.value }; return { ...prev, variants: vs } })} />
                                    <input className="input" style={{ height: 32, fontSize: '0.8rem' }} type="number" min="0" step="0.01" placeholder="Optional"
                                        value={v.takeOutPrice} onChange={e => setNewMenu(prev => { const vs = [...prev.variants]; vs[i] = { ...vs[i], takeOutPrice: e.target.value }; return { ...prev, variants: vs } })} />
                                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, display: 'flex' }}
                                        onClick={() => setNewMenu(prev => ({ ...prev, variants: prev.variants.filter((_, j) => j !== i) }))}>
                                        <X size={15} />
                                    </button>
                                </div>
                            ))}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6 }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>Label</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>Dine In</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>Take Out <span style={{ opacity: 0.7 }}>(optional)</span></div>
                                <div />
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* ── Variant Picker Modal ── */}
            <Modal isOpen={!!variantPickerItem} onClose={() => setVariantPickerItem(null)} title={variantPickerItem ? `🍽️ ${variantPickerItem.name}` : ''} narrow
                footer={<button className="btn btn-secondary btn-block" onClick={() => setVariantPickerItem(null)}>Cancel</button>}
            >
                {variantPickerItem && (
                    <div>
                        {variantPickerItem.image && (
                            <img src={variantPickerItem.image} alt={variantPickerItem.name}
                                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 12 }}
                                onError={(e) => { e.target.style.display = 'none' }}
                            />
                        )}
                        {variantPickerItem.description && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>{variantPickerItem.description}</p>
                        )}
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Select Size</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {variantPickerItem.variants.map(v => {
                                const vPrice = orderType === 'Take Out' && v.takeOutPrice != null ? v.takeOutPrice : v.price
                                return (
                                    <button key={v.id} type="button"
                                        onClick={() => addVariantToCart(variantPickerItem, v)}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                            border: '2px solid var(--cream-400)', background: '#fff',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            fontWeight: 600, fontSize: '0.9rem',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brown-500)'; e.currentTarget.style.background = 'var(--cream-100)' }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cream-400)'; e.currentTarget.style.background = '#fff' }}
                                    >
                                        <span style={{ color: 'var(--brown-800)' }}>{v.label}</span>
                                        <span style={{ color: 'var(--brown-600)', fontSize: '1rem', fontWeight: 800 }}>{fmt(vPrice)}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Discount Modal */}
            <Modal isOpen={discountModal} onClose={() => setDiscountModal(false)} title="💸 Apply Discount" narrow
                footer={<>
                    <button className="btn btn-secondary btn-block" onClick={() => setDiscountModal(false)}>Cancel</button>
                    <button className="btn btn-primary btn-block" onClick={applyDiscount}>Apply Discount</button>
                </>}>
                <div className="form-group">
                    <label>Discount Amount (₱)</label>
                    <input className="input" type="number" autoFocus placeholder="e.g. 50.00" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>This will be deducted directly from the subtotal before tax is calculated.</div>
            </Modal>

            {/* POS Payment Modal (Immediate checkout) */}
            <Modal isOpen={paymentModal} onClose={() => setPaymentModal(false)} title="💰 Process Payment" narrow
                footer={<div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <button className="btn btn-secondary btn-block" onClick={() => setPaymentModal(false)}>Back</button>
                    <button className="btn btn-secondary btn-block" style={{ border: '1px dashed var(--brown-300)' }} onClick={() => submitOrder(false)} disabled={submitting}>Pay Later</button>
                    <button className="btn btn-primary btn-block" onClick={() => submitOrder(true)} disabled={submitting || (paymentMethod === 'Cash' && (!amountReceived || !posCashValidation.isValid))}>{submitting ? 'Processing...' : 'Confirm & Place'}</button>
                </div>}>
                <div style={{ padding: '5px 0' }}>
                    <div style={{ background: 'var(--bg-app)', padding: 15, borderRadius: 'var(--radius-md)', marginBottom: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Amount Due</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brown-700)' }}>{fmt(total)}</div>
                    </div>
                    <div className="form-group">
                        <label>Payment Method</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button className={`btn ${paymentMethod === 'Cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('Cash')}><Banknote size={16} /> Cash</button>
                            <button className={`btn ${paymentMethod === 'Online Payment' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setPaymentMethod('Online Payment'); setAmountReceived(total); }}><CreditCard size={16} /> Online Payment</button>
                        </div>
                    </div>
                    {paymentMethod === 'Cash' && (
                        <>
                            <div className="form-group">
                                <label htmlFor="pos-amount-received">Amount Received (₱)</label>
                                <CashAmountField
                                    id="pos-amount-received"
                                    value={amountReceived}
                                    onChange={setAmountReceived}
                                    validation={posCashValidation}
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

            {/* Unpaid Order Payment Modal */}
            <Modal isOpen={payUnpaidModal} onClose={() => setPayUnpaidModal(false)} title={selectedUnpaidOrder?.orderType === 'Take Out' ? `🛍️ Settle Take Out #${selectedUnpaidOrder?.takeOutNumber}` : `🍽️ Settle Table ${selectedUnpaidOrder?.tableNumber}`} narrow
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setPayUnpaidModal(false)}>Cancel</button>
                    <button className="btn btn-success" style={{ flex: 1 }} onClick={processUnpaidPayment} disabled={processingUnpaid || (unpaidPaymentMethod === 'Cash' && (!unpaidAmountReceived || !unpaidCashValidation.isValid))}>{processingUnpaid ? 'Processing...' : 'Confirm Payment'}</button>
                </>}>
                {selectedUnpaidOrder && (
                    <>
                        <div style={{ background: 'var(--cream-100)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
                            {selectedUnpaidOrder.items?.map((i, idx) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}><span>{i.name} ×{i.quantity}</span><span>{fmt(i.price * i.quantity)}</span></div>)}
                            {selectedUnpaidOrder.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--danger)' }}><span>Discount</span><span>-{fmt(selectedUnpaidOrder.discount)}</span></div>}
                            <hr className="receipt-divider" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}><span>Total</span><span style={{ color: 'var(--brown-700)' }}>{fmt(selectedUnpaidOrder.total)}</span></div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Payment Method</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <button type="button" className={`btn ${unpaidPaymentMethod === 'Cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setUnpaidPaymentMethod('Cash'); setUnpaidAmountReceived(''); }} style={{ fontSize: '0.85rem' }}><Banknote size={15} /> Cash</button>
                                <button type="button" className={`btn ${unpaidPaymentMethod === 'Online Payment' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setUnpaidPaymentMethod('Online Payment'); setUnpaidAmountReceived(selectedUnpaidOrder.total); }} style={{ fontSize: '0.85rem' }}><CreditCard size={15} /> Online Payment</button>
                            </div>
                        </div>
                        {unpaidPaymentMethod === 'Cash' ? (
                            <>
                                <div className="form-group">
                                    <label htmlFor="unpaid-amount-received">Amount Received (₱)</label>
                                    <CashAmountField
                                        id="unpaid-amount-received"
                                        value={unpaidAmountReceived}
                                        onChange={setUnpaidAmountReceived}
                                        validation={unpaidCashValidation}
                                    />
                                    <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                                        {[20, 50, 100, 200, 500, 1000].map(v => (
                                            <button 
                                                key={v} 
                                                type="button" 
                                                className={`btn btn-sm ${Number(unpaidAmountReceived) === v ? 'btn-primary' : 'btn-secondary'}`} 
                                                onClick={() => setUnpaidAmountReceived(v)}
                                            >
                                                ₱{v.toLocaleString()}
                                            </button>
                                        ))}
                                        <button 
                                            type="button" 
                                            className={`btn btn-sm ${Number(unpaidAmountReceived) === selectedUnpaidOrder.total ? 'btn-primary' : 'btn-secondary'}`} 
                                            onClick={() => setUnpaidAmountReceived(selectedUnpaidOrder.total)}
                                        >
                                            Exact ({fmt(selectedUnpaidOrder.total)})
                                        </button>
                                    </div>
                                </div>



                                {unpaidAmountReceived && unpaidCashValidation.isValid && (
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
                                            {fmt(unpaidCashValidation.change)}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', padding: 14, textAlign: 'center', border: '1px solid var(--success-border)', marginTop: 10 }}>
                                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--success)', fontWeight: 700 }}>Online Payment Pre-Authorized</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>{fmt(selectedUnpaidOrder.total)}</div>
                            </div>
                        )}
                    </>
                )}
            </Modal>

            {/* POS Success Modal */}
            <Modal isOpen={successModal} onClose={() => setSuccessModal(false)} title="✅ Order Placed!" narrow
                footer={<div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <button className="btn btn-secondary btn-block" onClick={openPosReceipt}>
                        <Printer size={15} /> Print Receipt
                    </button>
                    <button className="btn btn-primary btn-block" onClick={() => setSuccessModal(false)}>
                        New Order
                    </button>
                </div>}>
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

            {/* Sales Invoice Modal */}
            <Modal isOpen={receiptModal} onClose={() => setReceiptModal(false)} title={lastSale?.isPaid ? "Sales Invoice" : "Order Slip"} narrow
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setReceiptModal(false)}>Close</button>
                    <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Invoice</button>
                </>}>
                {lastSale && (
                    <div className="receipt">
                        <div style={{ textAlign: 'center', marginBottom: 10 }}><strong style={{ fontSize: '1.2rem' }}>COMODA RESTAURANT</strong><br /><span>SALES INVOICE</span></div>
                        <hr className="receipt-divider" />
                        {lastSale.id && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 2 }}>
                                <span style={{ fontWeight: 700 }}>Txn ID:</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--brown-700)' }}>#{String(lastSale.id).padStart(4,'0')}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Order ID: #{lastSale.orderId || lastSale.order?.id}</span><span>Date: {lastSale.date}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Cashier: {lastSale.cashier}</span><span>Time: {lastSale.time}</span></div>
                        <hr className="receipt-divider" />
                        {(lastSale.order?.items || lastSale.items)?.map((i, idx) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 2 }}><span>{i.name} ×{i.quantity}</span><span>{fmt(i.price * i.quantity)}</span></div>)}
                        {(lastSale.order?.discount > 0 || lastSale.discount > 0) && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 2, color: 'var(--danger)' }}><span>Discount</span><span>-{fmt(lastSale.order?.discount || lastSale.discount)}</span></div>}
                        <hr className="receipt-divider" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}><span>Total</span><strong>{fmt(lastSale.total)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Payment Method</span>
                            <strong style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{lastSale.paymentMethod || lastSale.order?.paymentMethod || 'Cash'}</strong>
                        </div>
                        {(lastSale.paymentMethod || lastSale.order?.paymentMethod) === 'Online Payment' ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span>Amount Paid</span>
                                <strong>{fmt(lastSale.amountReceived ?? lastSale.amount_received)}</strong>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Received</span><span>{fmt(lastSale.amountReceived ?? lastSale.amount_received)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Change</span><span>{fmt(lastSale.change ?? lastSale.change_amount)}</span></div>
                            </>
                        )}
                        <hr className="receipt-divider" />
                        <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.85rem', marginTop: 10 }}>{settings.receipt_footer || 'Thank you for dining with us!'}</div>
                    </div>
                )}
            </Modal>
            {/* Recipe Management Modal */}
            <Modal isOpen={recipeModalOpen} onClose={() => setRecipeModalOpen(false)} title={`📋 Recipe — ${recipeItem?.name || ''}`}
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setRecipeModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSaveRecipe} disabled={recipeSaving}>
                        {recipeSaving ? 'Saving...' : '💾 Save Recipe'}
                    </button>
                </>}
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>Add Ingredient from Inventory</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search inventory items..."
                            value={recipeSearch}
                            onChange={e => setRecipeSearch(e.target.value)}
                            style={{ paddingLeft: 36 }}
                        />
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    </div>
                    {recipeSearch.trim() && (
                        <div style={{ border: '1px solid var(--cream-300)', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', background: '#fff' }}>
                            {inventoryItems
                                .filter(inv => inv.name.toLowerCase().includes(recipeSearch.toLowerCase()))
                                .filter(inv => !recipeIngredients.some(r => r.inventory_item_id === inv.id))
                                .map(inv => (
                                    <div
                                        key={inv.id}
                                        onClick={() => handleAddIngredient(inv)}
                                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--cream-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--cream-100)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{inv.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{inv.category} · {inv.unit}</div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: inv.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                            {inv.quantity} {inv.unit} in stock
                                        </div>
                                    </div>
                                ))}
                            {inventoryItems.filter(inv => inv.name.toLowerCase().includes(recipeSearch.toLowerCase())).filter(inv => !recipeIngredients.some(r => r.inventory_item_id === inv.id)).length === 0 && (
                                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching items</div>
                            )}
                        </div>
                    )}
                </div>

                {recipeIngredients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', background: 'var(--cream-100)', borderRadius: 10 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                        <div style={{ fontWeight: 600 }}>No ingredients added yet</div>
                        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Search and add inventory items above to build the recipe</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 36px', gap: 8, fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span>Ingredient</span>
                            <span>Qty Needed</span>
                            <span>In Stock</span>
                            <span></span>
                        </div>
                        {recipeIngredients.map((ing, idx) => (
                            <div key={ing.inventory_item_id} style={{
                                display: 'grid', gridTemplateColumns: '1fr 120px 100px 36px', gap: 8, alignItems: 'center',
                                padding: '10px 12px', background: 'var(--cream-50)', borderRadius: 8, border: '1px solid var(--cream-300)',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{ing.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ing.unit}</div>
                                </div>
                                <input
                                    type="number"
                                    className="form-control"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0.01"
                                    value={ing.quantity_needed}
                                    onChange={e => setRecipeIngredients(prev => prev.map((r, i) => i === idx ? { ...r, quantity_needed: e.target.value } : r))}
                                    style={{ padding: '6px 10px', fontSize: '0.85rem', textAlign: 'center' }}
                                />
                                <div style={{
                                    fontSize: '0.8rem', fontWeight: 700, textAlign: 'center',
                                    color: ing.stockAvailable >= (Number(ing.quantity_needed) || 0) ? 'var(--success)' : 'var(--danger)',
                                }}>
                                    {ing.stockAvailable} {ing.unit}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRecipeIngredients(prev => prev.filter((_, i) => i !== idx))}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}
                                    title="Remove ingredient"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    )
}
