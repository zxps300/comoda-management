import { useEffect, useState, useRef } from 'react'
import api from '../services/api'
import { cacheMenuImages } from '../services/menu.service'
import { useToastContext } from '../contexts/ToastContext'
import Modal from '../components/ui/Modal'
import { Plus, Search, Trash2, Check, ChefHat, Pencil, Eye, EyeOff, X, ImagePlus, Save, Tag, PhilippinePeso, ChevronDown, BookOpen, PackageOpen, Scale, GripVertical, History } from 'lucide-react'

// Emoji icons mapped to common menu categories
const CATEGORY_ICONS = {
    'All':                      '🍽️',
    'Main Course':              '🥩',
    'Rice Meals':               '🍚',
    'Noodles':                  '🍜',
    'Appetizers':               '🥟',
    'Salads':                   '🥗',
    'Desserts':                 '🍰',
    'ICED TEAS':                '🧊',
    'PARADISE SHAKE COLLECTION':'🥤',
    'COCKTAILS':                '🍹',
    'SIGNATURE MENU':           '⭐',
    'CAKES':                    '🎂',
    'Beverages':                '☕',
    'SMOOTHIE BAR':             '🫐',
    'PASTA & SPAG':             '🍝',
    'PIZZA STEAK':              '🍕',
    "CHEF'S SPECIAL PICKS":     '👨‍🍳',
    'RICE BOWL':                '🍲',
    'DESSERT PARADISE':         '🍨',
    'BREAKFAST':                '🥞',
    'MUST TRY FAVORITES':       '🔥',
    'Chicken':                  '🍗',
    'Burger':                   '🍔',
    'Fries':                    '🍟',
    'Drink':                    '🥤',
    'Pizza':                    '🍕',
    'Seafood':                  '🦐',
    'Soup':                     '🍲',
    'Sides':                    '🥗',
    'Combo':                    '🍱',
    'Coffee':                   '☕',
    'Milk Tea':                 '🧋',
    'Snacks':                   '🥨',
}

const DEFAULT_CATEGORIES = ['Main Course', 'Rice Meals', 'Noodles', 'Appetizers', 'Salads', 'Desserts', 'Beverages']

const resolveMenuImageUrl = (image) => {
    if (!image) return ''
    if (image.startsWith('http') || image.startsWith('/')) return image
    const apiRoot = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000'
    return `${apiRoot}/storage/${image}`
}

const servingUnitsFor = (baseUnit) => {
    if (baseUnit === 'kg') return ['g', 'kg']
    if (baseUnit === 'L') return ['tsp', 'ml', 'L']
    return [baseUnit || '-']
}

const fromBaseUnit = (quantity, baseUnit, servingUnit) => {
    const value = Number(quantity || 0)
    if (baseUnit === 'kg' && servingUnit === 'g') return value * 1000
    if (baseUnit === 'L' && servingUnit === 'ml') return value * 1000
    if (baseUnit === 'L' && servingUnit === 'tsp') return value * 200
    return value
}

const toBaseUnit = (quantity, baseUnit, servingUnit) => {
    const value = Number(quantity || 0)
    if (baseUnit === 'kg' && servingUnit === 'g') return value / 1000
    if (baseUnit === 'L' && servingUnit === 'ml') return value / 1000
    if (baseUnit === 'L' && servingUnit === 'tsp') return value / 200
    return value
}

export default function MenuManagement() {
    const toast = useToastContext()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
    const [activeCategory, setActiveCategory] = useState('All')

    // Drag-to-scroll refs
    const scrollContainerRef = useRef(null)
    const isDown = useRef(false)
    const hasMoved = useRef(false)
    const startX = useRef(0)
    const scrollLeft = useRef(0)

    const handleMouseDown = (e) => {
        isDown.current = true
        hasMoved.current = false
        startX.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0)
        scrollLeft.current = scrollContainerRef.current?.scrollLeft || 0
    }

    const handleMouseLeave = () => {
        isDown.current = false
        hasMoved.current = false
        scrollContainerRef.current?.classList.remove('dragging')
    }

    const handleMouseUp = () => {
        isDown.current = false
        setTimeout(() => {
            hasMoved.current = false
            scrollContainerRef.current?.classList.remove('dragging')
        }, 40)
    }

    const handleMouseMove = (e) => {
        if (!isDown.current || !scrollContainerRef.current) return
        const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0)
        const walk = (x - startX.current) * 1.5
        if (Math.abs(walk) > 4) {
            hasMoved.current = true
            scrollContainerRef.current.classList.add('dragging')
            scrollContainerRef.current.scrollLeft = scrollLeft.current - walk
        }
    }

    // Recipe Modal States
    const [recipeModal, setRecipeModal] = useState(false)
    const [activeItem, setActiveItem] = useState(null)
    const [inventoryItems, setInventoryItems] = useState([])
    const [recipe, setRecipe] = useState([])
    const [recipeLoading, setRecipeLoading] = useState(false)
    const [recipeSaving, setRecipeSaving] = useState(false)
    const [priceHistoryModal, setPriceHistoryModal] = useState(false)
    const [priceHistory, setPriceHistory] = useState([])
    const [priceHistoryLoading, setPriceHistoryLoading] = useState(false)
    const [originalPrice, setOriginalPrice] = useState(null)
    const [priceChangeReason, setPriceChangeReason] = useState('')

    // Menu Item CRUD States
    const [menuModal, setMenuModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [menuImage, setMenuImage] = useState(null)
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
    const categoryDropdownRef = useRef(null)
    const [menuForm, setMenuForm] = useState({
        id: null,
        name: '',
        category: '',
        price: '',
        description: '',
        available: 1
    })

    useEffect(() => {
        fetchMenuItems()
        fetchInventory()
        const refreshTimer = window.setInterval(() => fetchMenuItems(true), 5000)
        return () => window.clearInterval(refreshTimer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const closeCategoryDropdown = (event) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setCategoryDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', closeCategoryDropdown)
        return () => document.removeEventListener('mousedown', closeCategoryDropdown)
    }, [])

    const fetchMenuItems = async (silent = false) => {
        try {
            const { data } = await api.get('/menu-items')
            setItems(data)
            cacheMenuImages(data)
            const dynamicCats = data.map((i) => i.category).filter(Boolean)
            const cats = Array.from(new Set([...DEFAULT_CATEGORIES, ...dynamicCats]))
            setCategories(cats)
        } catch (error) {
            if (!silent) toast('Failed to load menu items', 'error')
        } finally {
            setLoading(false)
        }
    }

    const openPriceHistory = async (item) => {
        setActiveItem(item)
        setPriceHistory([])
        setPriceHistoryModal(true)
        setPriceHistoryLoading(true)
        try {
            const { data } = await api.get(`/menu-items/${item.id}/price-history`)
            setPriceHistory(data)
        } catch {
            toast('Failed to load price history', 'error')
        } finally {
            setPriceHistoryLoading(false)
        }
    }

    const fetchInventory = async () => {
        try {
            const { data } = await api.get('/inventory')
            setInventoryItems(data)
        } catch (error) {
            console.error('Failed to load inventory')
        }
    }

    const filteredItems = items.filter(
        (item) =>
            (activeCategory === 'All' || (item.category && item.category.trim().toLowerCase() === activeCategory.trim().toLowerCase())) &&
            (!search ||
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.description?.toLowerCase().includes(search.toLowerCase()))
    )

    // --- Menu Item CRUD ---

    const openMenuModal = (item = null) => {
        setMenuImage(null)
        setCategoryDropdownOpen(false)
        setOriginalPrice(item ? Number(item.price) : null)
        setPriceChangeReason('')
        if (item) {
            setMenuForm({
                id: item.id,
                name: item.name,
                category: item.category,
                price: item.price,
                description: item.description || '',
                available: item.available ? 1 : 0
            })
        } else {
            setMenuForm({
                id: null,
                name: '',
                category: categories[0] || '',
                price: '',
                description: '',
                available: 1
            })
        }
        setMenuModal(true)
    }

    const handleMenuSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('name', menuForm.name)
            formData.append('category', menuForm.category)
            formData.append('price', menuForm.price)
            formData.append('description', menuForm.description)
            formData.append('available', menuForm.available)
            if (menuForm.id && originalPrice !== null && Number(menuForm.price) !== originalPrice) {
                formData.append('price_change_reason', priceChangeReason.trim())
            }
            if (menuImage) {
                formData.append('image', menuImage)
            }

            if (menuForm.id) {
                formData.append('_method', 'PUT')
                await api.post(`/menu-items/${menuForm.id}`, formData)
                toast('Menu item updated successfully', 'success')
            } else {
                await api.post('/menu-items', formData)
                toast('Menu item created successfully', 'success')
            }
            setMenuModal(false)
            fetchMenuItems()
        } catch (error) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            toast(`Failed to save: ${errorMsg}`, 'error')
            alert(`Save Failed: ${errorMsg}`)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteMenu = async (id) => {
        if (!window.confirm('Are you sure you want to delete this menu item?')) return
        try {
            await api.delete(`/menu-items/${id}`)
            toast('Menu item deleted', 'success')
            fetchMenuItems()
        } catch (error) {
            toast('Failed to delete menu item', 'error')
        }
    }

    const toggleAvailability = async (item) => {
        const previousItems = [...items];
        // Optimistic UI update
        setItems(items.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
        try {
            await api.put(`/menu-items/${item.id}`, { available: !item.available })
            toast(`Marked as ${!item.available ? 'Available' : 'Unavailable'}`, 'success')
        } catch (error) {
            // Revert on failure
            setItems(previousItems);
            toast('Failed to update availability', 'error')
        }
    }

    // --- Recipe CRUD ---

    const openRecipeModal = async (item) => {
        setActiveItem(item)
        setRecipe([])
        setRecipeModal(true)
        setRecipeLoading(true)
        try {
            const { data } = await api.get(`/menu-items/${item.id}/recipe`)
            setRecipe(
                data.map(r => ({
                    inventory_item_id: r.inventoryItemId,
                    quantity_needed: fromBaseUnit(r.quantityNeeded, r.unit, servingUnitsFor(r.unit)[0]),
                    unit: r.unit,
                    serving_unit: servingUnitsFor(r.unit)[0]
                }))
            )
        } catch (error) {
            toast('Failed to load recipe', 'error')
        } finally {
            setRecipeLoading(false)
        }
    }

    const addRecipeIngredient = () => {
        if (inventoryItems.length === 0) return
        const unit = inventoryItems[0].unit
        const servingUnit = servingUnitsFor(unit)[0]
        setRecipe([...recipe, {
            inventory_item_id: inventoryItems[0].id,
            quantity_needed: unit === 'kg' ? 100 : 1,
            unit,
            serving_unit: servingUnit
        }])
    }

    const updateRecipeIngredient = (index, field, value) => {
        const newRecipe = [...recipe]
        if (field === 'serving_unit') {
            const ingredient = newRecipe[index]
            const baseQuantity = toBaseUnit(ingredient.quantity_needed, ingredient.unit, ingredient.serving_unit)
            ingredient.serving_unit = value
            ingredient.quantity_needed = Number(fromBaseUnit(baseQuantity, ingredient.unit, value).toFixed(2))
        } else {
            newRecipe[index][field] = value
        }
        
        if (field === 'inventory_item_id') {
            const invItem = inventoryItems.find(i => i.id === parseInt(value))
            if (invItem) {
                newRecipe[index].unit = invItem.unit
                newRecipe[index].serving_unit = servingUnitsFor(invItem.unit)[0]
                newRecipe[index].quantity_needed = invItem.unit === 'kg' ? 100 : 1
            }
        }
        
        setRecipe(newRecipe)
    }

    const removeRecipeIngredient = (index) => {
        setRecipe(recipe.filter((_, i) => i !== index))
    }

    const saveRecipe = async () => {
        if (recipe.some(r => !r.inventory_item_id || !Number(r.quantity_needed) || Number(r.quantity_needed) <= 0)) {
            toast('Every ingredient needs a valid quantity', 'warning')
            return
        }
        if (new Set(recipe.map(r => String(r.inventory_item_id))).size !== recipe.length) {
            toast('Remove duplicate ingredients before saving', 'warning')
            return
        }
        setRecipeSaving(true)
        try {
            const payload = {
                ingredients: recipe.map(r => ({
                    inventory_item_id: parseInt(r.inventory_item_id),
                    quantity_needed: toBaseUnit(r.quantity_needed, r.unit, r.serving_unit)
                }))
            }
            await api.put(`/menu-items/${activeItem.id}/recipe`, payload)
            toast('Recipe updated successfully', 'success')
            setRecipeModal(false)
            fetchMenuItems()
        } catch (error) {
            toast('Failed to save recipe', 'error')
        } finally {
            setRecipeSaving(false)
        }
    }

    if (loading) {
        return <div className="loading-state">Loading menu items...</div>
    }

    const priceIsChanging = menuForm.id
        && originalPrice !== null
        && Number(menuForm.price) !== originalPrice

    return (
        <div className="page-container menu-management-page">
            <div className="menu-top-controls">
                <div className="menu-header-action-row">
                    <div className="menu-header-title-group">
                        <div className="menu-header-icon-badge">
                            🍽️
                        </div>
                        <div className="menu-header-title-text">
                            <h2>Menu Catalog</h2>
                            <p>{items.length} items total · {items.filter(i => i.available).length} available</p>
                        </div>
                    </div>

                    <div className="menu-header-actions">
                        {/* Unique & Sleek Search Bar */}
                        <div className={`menu-search-container ${searchFocused ? 'focused' : ''}`}>
                            <div className="menu-search-icon-wrap">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                className="menu-search-input"
                                placeholder="Search dishes, drinks, ingredients..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                            />
                            <div className="menu-search-badges">
                                {search.trim() && (
                                    <>
                                        <span className="menu-search-count-pill">
                                            {filteredItems.length} found
                                        </span>
                                        <button 
                                            type="button"
                                            className="menu-search-clear-btn" 
                                            onClick={() => setSearch('')}
                                            title="Clear search"
                                        >
                                            <X size={12} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Unique & Eye-Catching Add Menu Item Button */}
                        <button 
                            type="button" 
                            className="btn-add-menu-unique" 
                            onClick={() => openMenuModal()}
                        >
                            <span className="btn-add-menu-icon-box">
                                <Plus size={16} />
                            </span>
                            <span>Add Menu Item</span>
                        </button>
                    </div>
                </div>

                {/* Category icon cards */}
                <div 
                    className="menu-category-cards"
                    ref={scrollContainerRef}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    {['All', ...categories].map((cat) => {
                        const isActive = activeCategory.trim().toLowerCase() === cat.trim().toLowerCase()
                        const categoryItem = cat === 'All' ? null : items.find(item =>
                            item.image && item.category?.trim().toLowerCase() === cat.trim().toLowerCase()
                        )
                        return (
                            <button
                                key={cat}
                                type="button"
                                className={`menu-cat-card ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                    if (hasMoved.current) return
                                    setActiveCategory(cat)
                                }}
                            >
                                {categoryItem ? (
                                    <span className="menu-cat-photo-wrap">
                                        <img
                                            className="menu-cat-photo"
                                            src={resolveMenuImageUrl(categoryItem.image)}
                                            alt={`${cat} representative dish`}
                                            title={categoryItem.name}
                                            onError={(event) => {
                                                event.currentTarget.style.display = 'none'
                                                event.currentTarget.nextElementSibling.style.display = 'grid'
                                            }}
                                        />
                                        <span className="menu-cat-photo-fallback">{CATEGORY_ICONS[cat] || '🍴'}</span>
                                    </span>
                                ) : (
                                    <span className="menu-cat-icon">{CATEGORY_ICONS[cat] || '🍴'}</span>
                                )}
                                <span className="menu-cat-label">{cat}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="menu-list">
                {filteredItems.length === 0 ? (
                    <div className="empty-state">No products found.</div>
                ) : (
                    filteredItems.map((item) => {
                        return (
                        <div key={item.id} className={`menu-list-row ${!item.available ? 'unavailable' : ''}`} style={!item.available ? { opacity: 0.6 } : {}}>
                            <div className="menu-list-image" style={{ position: 'relative' }}>
                                {item.image ? (
                                    <>
                                        <img 
                                            src={resolveMenuImageUrl(item.image)} 
                                            alt={item.name} 
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div className="image-placeholder" style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                            <ChefHat size={32} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="image-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChefHat size={32} /></div>
                                )}
                                {!item.available && (
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', textAlign: 'center', padding: '2px 0' }}>OUT</div>
                                )}
                            </div>
                            
                            <div className="menu-list-details">
                                <h3 className="menu-list-title" style={!item.available ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : {}}>{item.name}</h3>
                                <div className="menu-list-category">{item.category}</div>
                                <div className="menu-list-price-row">
                                    <div className="menu-list-price">₱{Number(item.price).toFixed(2)}</div>
                                    <span className={`menu-serving-count ${(item.availableServings || 0) <= 0 ? 'is-empty' : ''}`}>
                                        {item.availableServings || 0} serving{item.availableServings === 1 ? '' : 's'} today
                                    </span>
                                </div>
                                {item.description && <p className="menu-list-desc">{item.description}</p>}
                            </div>

                            <div className="menu-list-actions" aria-label={`Actions for ${item.name}`}>
                                <button 
                                    type="button"
                                    className={`menu-action-status ${item.available ? 'is-active' : 'is-hidden'}`}
                                    onClick={() => toggleAvailability(item)}
                                    title={item.available ? "Mark as Unavailable" : "Mark as Available"}
                                    aria-label={item.available ? `Hide ${item.name}` : `Show ${item.name}`}
                                >
                                    {item.available ? <Eye size={15} /> : <EyeOff size={15} />}
                                    <span className="menu-action-label">{item.available ? 'Active' : 'Hidden'}</span>
                                </button>

                                <span className="menu-action-divider" aria-hidden="true" />

                                <button 
                                    type="button"
                                    className="menu-action-icon edit" 
                                    onClick={() => openMenuModal(item)}
                                    title="Edit Item"
                                    aria-label={`Edit ${item.name}`}
                                >
                                    <Pencil size={15} />
                                </button>

                                <button
                                    type="button"
                                    className="menu-action-icon edit"
                                    onClick={() => openPriceHistory(item)}
                                    title="View Price History"
                                    aria-label={`View price history for ${item.name}`}
                                >
                                    <History size={15} />
                                </button>

                                <button 
                                    type="button"
                                    className="menu-action-icon delete" 
                                    onClick={() => handleDeleteMenu(item.id)}
                                    title="Delete Item"
                                    aria-label={`Delete ${item.name}`}
                                >
                                    <Trash2 size={15} />
                                </button>

                                <button 
                                    type="button"
                                    className="menu-action-recipe"
                                    onClick={() => openRecipeModal(item)}
                                    title="Manage Recipe"
                                    aria-label={`Manage recipe for ${item.name}`}
                                >
                                    <BookOpen size={15} />
                                    <span className="menu-action-label">Recipe</span>
                                </button>
                            </div>
                        </div>
                    )})
                )}
            </div>

            {/* Add/Edit Menu Item Modal */}
            <Modal isOpen={menuModal} onClose={() => setMenuModal(false)} title={menuForm.id ? "Edit Menu Item" : "Add Menu Item"} className="menu-item-modal">
                <form onSubmit={handleMenuSubmit} className="menu-item-form">
                    <p className="menu-form-intro">Add the details customers will see on your menu.</p>
                    <div className="form-group">
                        <label htmlFor="menu-item-name">Item name <span aria-hidden="true">*</span></label>
                        <input id="menu-item-name" type="text" className="input-field" value={menuForm.name} onChange={(e) => setMenuForm({...menuForm, name: e.target.value})} required placeholder="e.g. Grilled Chicken Alfredo" autoFocus />
                    </div>
                    <div className="menu-form-row">
                        <div className="form-group">
                            <label htmlFor="menu-item-category">Category <span aria-hidden="true">*</span></label>
                            <div className={`menu-category-picker ${categoryDropdownOpen ? 'open' : ''}`} ref={categoryDropdownRef}>
                                <Tag size={17} />
                                <button
                                    id="menu-item-category"
                                    type="button"
                                    className="input-field menu-category-trigger"
                                    aria-haspopup="listbox"
                                    aria-expanded={categoryDropdownOpen}
                                    onClick={() => setCategoryDropdownOpen(open => !open)}
                                >
                                    <span>{menuForm.category || 'Select a category'}</span>
                                    <ChevronDown size={18} />
                                </button>
                                <div className="menu-category-options" role="listbox" aria-label="Available categories">
                                    {categories.filter(category => category !== 'All').map(category => (
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={menuForm.category === category}
                                            className={menuForm.category === category ? 'selected' : ''}
                                            key={category}
                                            onClick={() => {
                                                setMenuForm({...menuForm, category})
                                                setCategoryDropdownOpen(false)
                                            }}
                                        >
                                            <span className="menu-category-option-icon">{CATEGORY_ICONS[category] || '🍴'}</span>
                                            <span>{category}</span>
                                            {menuForm.category === category && <Check size={16} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="menu-item-price">Price <span aria-hidden="true">*</span></label>
                            <div className="menu-input-with-icon">
                                <PhilippinePeso size={17} />
                                <input id="menu-item-price" type="number" step="0.01" min="0" className="input-field" value={menuForm.price} onChange={(e) => setMenuForm({...menuForm, price: e.target.value})} required placeholder="0.00" />
                            </div>
                        </div>
                    </div>
                    {priceIsChanging && (
                        <div className="form-group">
                            <label htmlFor="menu-price-change-reason">Reason for price change <small>Optional</small></label>
                            <input
                                id="menu-price-change-reason"
                                type="text"
                                className="input-field"
                                maxLength={500}
                                value={priceChangeReason}
                                onChange={(event) => setPriceChangeReason(event.target.value)}
                                placeholder="e.g. Supplier cost increase or promotional pricing"
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <div className="menu-label-row">
                            <label htmlFor="menu-item-description">Description <small>Optional</small></label>
                            <span>{menuForm.description.length}/240</span>
                        </div>
                        <textarea id="menu-item-description" className="input-field menu-description-field" value={menuForm.description} onChange={(e) => setMenuForm({...menuForm, description: e.target.value})} rows={3} maxLength={240} placeholder="Describe the ingredients, flavors, or serving size..."></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="menu-item-image">Menu photo <small>Optional</small></label>
                        <label className="menu-image-upload" htmlFor="menu-item-image">
                            <span className="menu-upload-icon"><ImagePlus size={22} /></span>
                            <span className="menu-upload-copy">
                                <strong>{menuImage ? menuImage.name : 'Choose a menu photo'}</strong>
                                <small>{menuImage ? 'Click to select a different image' : 'PNG or JPG, up to 5 MB'}</small>
                            </span>
                            <span className="menu-upload-button">Browse</span>
                        </label>
                        <input id="menu-item-image" type="file" className="menu-file-input" onChange={(e) => setMenuImage(e.target.files[0] || null)} accept="image/png,image/jpeg,image/webp" />
                    </div>
                    <div className="menu-form-actions">
                        <button type="button" className="menu-cancel-button" onClick={() => setMenuModal(false)}>Cancel</button>
                        <button type="submit" className="menu-save-button" disabled={submitting}>
                            {submitting ? <><span className="menu-button-spinner" /> Saving...</> : <><Save size={17} /> {menuForm.id ? 'Save Changes' : 'Add Menu Item'}</>}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={priceHistoryModal} onClose={() => setPriceHistoryModal(false)} title="Price History" className="price-history-modal">
                <div className="price-history-content">
                    <div className="price-history-heading">
                        <div>
                            <strong>{activeItem?.name}</strong>
                            <span>Current price: ₱{Number(activeItem?.price || 0).toFixed(2)}</span>
                        </div>
                        <History size={22} />
                    </div>
                    {priceHistoryLoading ? (
                        <div className="recipe-builder-loading"><span className="menu-button-spinner" /> Loading changes...</div>
                    ) : priceHistory.length === 0 ? (
                        <div className="empty-state">No price changes have been recorded yet.</div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Price</th><th>Old</th><th>New</th><th>Changed by</th><th>Date & time</th><th>Reason</th></tr></thead>
                                <tbody>
                                    {priceHistory.map(entry => (
                                        <tr key={entry.id}>
                                            <td>{entry.priceType}</td>
                                            <td>{entry.oldPrice == null ? '—' : `₱${Number(entry.oldPrice).toFixed(2)}`}</td>
                                            <td><strong>₱{Number(entry.newPrice || 0).toFixed(2)}</strong></td>
                                            <td>{entry.staffMember}</td>
                                            <td>{new Date(entry.changedAt).toLocaleString('en-PH')}</td>
                                            <td>{entry.reason || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Recipe Modal */}
            <Modal isOpen={recipeModal} onClose={() => setRecipeModal(false)} title="Recipe Builder" className="recipe-builder-modal">
                <div className="recipe-modal-content">
                    {recipeLoading ? (
                        <div className="recipe-builder-loading"><span className="menu-button-spinner" /> Loading recipe...</div>
                    ) : (
                        <>
                            <div className="recipe-item-summary">
                                <div className="recipe-item-photo">
                                    {activeItem?.image ? <img src={resolveMenuImageUrl(activeItem.image)} alt="" /> : <ChefHat size={24} />}
                                </div>
                                <div className="recipe-item-copy">
                                    <span>Recipe for</span>
                                    <strong>{activeItem?.name}</strong>
                                    <small>{activeItem?.category} · ₱{Number(activeItem?.price || 0).toFixed(2)}</small>
                                </div>
                                <div className="recipe-count-badge">
                                    <BookOpen size={16} />
                                    <strong>{recipe.length}</strong>
                                    <span>{recipe.length === 1 ? 'ingredient' : 'ingredients'}</span>
                                </div>
                            </div>

                            <div className="recipe-builder-heading">
                                <div><h4>Ingredients</h4><p>Choose inventory items and specify the amount used for one serving.</p></div>
                                {recipe.length > 0 && <span>{recipe.length} added</span>}
                            </div>

                            <div className="recipe-ingredients-list">
                                {recipe.length === 0 ? (
                                    <div className="recipe-empty-state">
                                        <span><PackageOpen size={28} /></span>
                                        <h4>Start building this recipe</h4>
                                        <p>Add the ingredients used to prepare one serving of {activeItem?.name}.</p>
                                        <button type="button" onClick={addRecipeIngredient}><Plus size={16} /> Add first ingredient</button>
                                    </div>
                                ) : (
                                    recipe.map((ing, idx) => {
                                        const selectedInventory = inventoryItems.find(item => item.id === parseInt(ing.inventory_item_id))
                                        return (
                                            <div key={idx} className="recipe-ingredient-row">
                                                <div className="recipe-row-index"><GripVertical size={14} /><span>{idx + 1}</span></div>
                                                <div className="recipe-ingredient-field">
                                                    <label htmlFor={`recipe-item-${idx}`}>Inventory ingredient</label>
                                                    <select 
                                                        id={`recipe-item-${idx}`}
                                                        className="input-field"
                                                        value={ing.inventory_item_id}
                                                        onChange={(e) => updateRecipeIngredient(idx, 'inventory_item_id', e.target.value)}
                                                    >
                                                        {inventoryItems.map(inv => (
                                                            <option key={inv.id} value={inv.id}>{inv.name}</option>
                                                        ))}
                                                    </select>
                                                    <small>{selectedInventory ? `${selectedInventory.quantity ?? 0} ${selectedInventory.unit || ''} currently in stock` : 'Inventory item'}</small>
                                                </div>
                                                <div className="recipe-quantity-field">
                                                    <label htmlFor={`recipe-qty-${idx}`}>Amount per serving</label>
                                                    <div className="quantity-input-group">
                                                        <Scale size={15} />
                                                        <input 
                                                            id={`recipe-qty-${idx}`}
                                                            type="number" 
                                                            className="input-field" 
                                                            step={['g', 'ml', 'tsp'].includes(ing.serving_unit) ? '1' : '0.01'}
                                                            min={['g', 'ml', 'tsp'].includes(ing.serving_unit) ? '1' : '0.01'}
                                                            value={ing.quantity_needed}
                                                            onChange={(e) => updateRecipeIngredient(idx, 'quantity_needed', e.target.value)}
                                                        />
                                                        <select
                                                            className="unit-select"
                                                            value={ing.serving_unit || ing.unit || '-'}
                                                            onChange={(e) => updateRecipeIngredient(idx, 'serving_unit', e.target.value)}
                                                            aria-label={`Serving unit for ingredient ${idx + 1}`}
                                                        >
                                                            {servingUnitsFor(ing.unit).map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <button type="button" className="recipe-remove-button" onClick={() => removeRecipeIngredient(idx)} aria-label={`Remove ingredient ${idx + 1}`} title="Remove ingredient">
                                                    <Trash2 size={17} />
                                                </button>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                            
                            {recipe.length > 0 && <button type="button" className="recipe-add-button" onClick={addRecipeIngredient}>
                                <Plus size={17} /> Add another ingredient
                            </button>}

                            <div className="recipe-form-actions">
                                <button type="button" className="menu-cancel-button" onClick={() => setRecipeModal(false)}>Cancel</button>
                                <button type="button" className="menu-save-button" onClick={saveRecipe} disabled={recipeSaving}>
                                    {recipeSaving ? <><span className="menu-button-spinner" /> Saving...</> : <><Save size={17} /> Save Recipe</>}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    )
}
