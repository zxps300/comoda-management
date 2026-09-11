import { useCallback, useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { settingsService } from '../services/settings.service'
import { menuService } from '../services/menu.service'
import { useToastContext } from '../contexts/ToastContext'
import { 
    Settings as SettingsIcon, Save, Store, Calculator, 
    RefreshCw, MapPin, Percent, FileText, ChevronRight, Check,
    UtensilsCrossed, Eye, EyeOff
} from 'lucide-react'

export default function Settings() {
    const { settings, loading, refreshSettings } = useSettings()
    const toast = useToastContext()
    const [activeTab, setActiveTab] = useState('general')
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Menu Availability state
    const [menuItems, setMenuItems] = useState([])
    const [menuLoading, setMenuLoading] = useState(false)
    const [togglingId, setTogglingId] = useState(null)

    const loadMenu = useCallback(() => {
        setMenuLoading(true)
        menuService.getAll().then(setMenuItems).catch(() => toast('Failed to load menu items', 'error')).finally(() => setMenuLoading(false))
    }, [toast])

    useEffect(() => { if (activeTab === 'menu') loadMenu() }, [activeTab, loadMenu])

    const toggleAvailability = async (item) => {
        setTogglingId(item.id)
        try {
            await menuService.update(item.id, { ...item, available: !item.available })
            setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, available: !m.available } : m))
            toast(`${item.name} marked as ${!item.available ? 'Available' : 'Unavailable'}`, 'success')
        } catch {
            toast('Failed to update availability', 'error')
        } finally {
            setTogglingId(null)
        }
    }

    // Local form state
    const [formData, setFormData] = useState({
        store_name: '',
        tax_rate: '',
        receipt_footer: '',
    })

    useEffect(() => {
        if (!loading) {
            setFormData({
                store_name: settings.store_name || '',
                tax_rate: settings.tax_rate || '0.12',
                receipt_footer: settings.receipt_footer || '',
            })
            setHasChanges(false)
        }
    }, [settings, loading])

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }))
        setHasChanges(true)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const updates = [
                { key: 'store_name', value: formData.store_name, group: 'general' },
                { key: 'tax_rate', value: formData.tax_rate, group: 'pos' },
                { key: 'receipt_footer', value: formData.receipt_footer, group: 'pos' },
            ]
            await settingsService.bulkUpdate(updates)
            await refreshSettings()
            toast('Settings applied perfectly!', 'success')
            setHasChanges(false)
        } catch (err) {
            toast('Failed to save settings', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>

    const tabs = [
        { id: 'general', icon: Store, label: 'Store Information', desc: 'Basic details & branding' },
        { id: 'pos', icon: Calculator, label: 'POS & Tax', desc: 'Rates, receipts & behavior' },
        { id: 'menu', icon: UtensilsCrossed, label: 'Menu Availability', desc: 'Toggle items on/off in POS' },
    ]

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            
            {/* Header Section */}
            <div style={{ 
                marginBottom: 30, 
                padding: '30px', 
                borderRadius: 'var(--radius-lg)', 
                background: 'linear-gradient(135deg, var(--brown-900) 0%, var(--brown-700) 100%)',
                color: '#fff',
                boxShadow: '0 10px 30px rgba(111, 78, 55, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: -50, right: -20, opacity: 0.1 }}>
                    <SettingsIcon size={200} />
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h2 style={{ fontSize: '2rem', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12, backdropFilter: 'blur(5px)' }}>
                            <SettingsIcon size={28} />
                        </div>
                        System Configuration
                    </h2>
                    <p style={{ margin: 0, opacity: 0.85, fontSize: '0.95rem' }}>Customize global preferences to perfectly fit your business workflow.</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 30, flex: 1, minHeight: 0 }}>
                {/* Modern Sidebar Navigation */}
                <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ 
                                textAlign: 'left', 
                                padding: '16px 20px', 
                                borderRadius: 'var(--radius-md)', 
                                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent', 
                                color: activeTab === tab.id ? 'var(--brown-800)' : 'var(--text-secondary)', 
                                border: activeTab === tab.id ? '1px solid var(--cream-400)' : '1px solid transparent',
                                cursor: 'pointer', 
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 16,
                                boxShadow: activeTab === tab.id ? '0 8px 20px rgba(0,0,0,0.04)' : 'none',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {activeTab === tab.id && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'var(--brown-600)' }} />}
                            
                            <div style={{ 
                                background: activeTab === tab.id ? 'var(--brown-100)' : 'rgba(0,0,0,0.03)', 
                                color: activeTab === tab.id ? 'var(--brown-700)' : 'inherit',
                                padding: 10, 
                                borderRadius: 10 
                            }}>
                                <tab.icon size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>{tab.label}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>{tab.desc}</div>
                            </div>
                            <ChevronRight size={16} style={{ opacity: activeTab === tab.id ? 1 : 0, transform: `translateX(${activeTab === tab.id ? 0 : -10}px)`, transition: 'all 0.3s ease' }} />
                        </button>
                    ))}
                </div>

                {/* Content Area with Glassmorphism */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    background: 'rgba(255, 255, 255, 0.6)', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 40,
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    
                    {activeTab === 'general' && (
                        <div style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                            <div style={{ marginBottom: 30 }}>
                                <h3 style={{ fontSize: '1.4rem', color: 'var(--brown-800)', margin: '0 0 5px 0' }}>Store Information</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>These details are used across the system for sales invoices and branding.</p>
                            </div>
                            
                            <div style={{ background: '#fff', padding: 25, borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-300)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                <div className="form-group" style={{ maxWidth: 500 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600, color: 'var(--brown-700)' }}>
                                        <MapPin size={16} /> Registered Store Name
                                    </label>
                                    <input 
                                        style={{ padding: '14px 16px', fontSize: '1.05rem', background: 'var(--bg-app)', border: '1px solid var(--cream-400)', borderRadius: '8px', width: '100%', transition: 'border 0.3s ease' }}
                                        value={formData.store_name} 
                                        onChange={(e) => handleChange('store_name', e.target.value)} 
                                        placeholder="e.g. Comoda Management"
                                        onFocus={(e) => e.target.style.border = '1px solid var(--brown-500)'}
                                        onBlur={(e) => e.target.style.border = '1px solid var(--cream-400)'}
                                    />
                                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 8 }}>This name will appear on the top of printed sales invoices and your main sidebar menu.</small>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pos' && (
                        <div style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                            <div style={{ marginBottom: 30 }}>
                                <h3 style={{ fontSize: '1.4rem', color: 'var(--brown-800)', margin: '0 0 5px 0' }}>POS Configuration</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage tax rates and how the terminal handles checkout processes.</p>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                                {/* Tax Rate Card */}
                                <div style={{ background: '#fff', padding: 25, borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-300)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                                    <div style={{ background: 'var(--brown-50)', padding: 15, borderRadius: '50%', color: 'var(--brown-600)' }}>
                                        <Percent size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--brown-800)', marginBottom: 5 }}>
                                            Active Tax Rate
                                        </label>
                                        <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>This decimal value is multiplied against the subtotal during checkout.</p>
                                        <div style={{ position: 'relative', maxWidth: 200 }}>
                                            <input 
                                                style={{ padding: '12px 16px', fontSize: '1.1rem', fontWeight: 700, background: 'var(--bg-app)', border: '1px solid var(--cream-400)', borderRadius: '8px', width: '100%' }}
                                                type="number" 
                                                step="0.01" 
                                                value={formData.tax_rate} 
                                                onChange={(e) => handleChange('tax_rate', e.target.value)} 
                                                placeholder="0.12"
                                            />
                                            <div style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Text Card */}
                                <div style={{ background: '#fff', padding: 25, borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-300)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                                    <div style={{ background: 'var(--brown-50)', padding: 15, borderRadius: '50%', color: 'var(--brown-600)' }}>
                                        <FileText size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--brown-800)', marginBottom: 5 }}>
                                            Invoice Footer Message
                                        </label>
                                        <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>This text gets printed at the very bottom of the sales invoice.</p>
                                        <textarea 
                                            style={{ padding: '14px 16px', fontSize: '0.95rem', background: 'var(--bg-app)', border: '1px solid var(--cream-400)', borderRadius: '8px', width: '100%', resize: 'vertical', minHeight: 80 }}
                                            value={formData.receipt_footer} 
                                            onChange={(e) => handleChange('receipt_footer', e.target.value)} 
                                            placeholder="Thank you for dining with us!"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'menu' && (
                        <div style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: '1.4rem', color: 'var(--brown-800)', margin: '0 0 5px 0' }}>Menu Availability</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    Toggle items to show or hide them on the POS. Unavailable items appear greyed-out and cannot be ordered.
                                </p>
                            </div>

                            {menuLoading ? (
                                <div className="loading" style={{ padding: 60 }}><div className="spinner" /></div>
                            ) : menuItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                                    <UtensilsCrossed size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                                    <p>No menu items found.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary bar */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 10, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                                            ● {menuItems.filter(m => m.available).length} Available
                                        </div>
                                        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, color: '#991b1b' }}>
                                            ✕ {menuItems.filter(m => !m.available).length} Unavailable
                                        </div>
                                    </div>

                                    {/* Group by category */}
                                    {[...new Set(menuItems.map(m => m.category))].map(cat => (
                                        <div key={cat} style={{ marginBottom: 24 }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-600)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--cream-300)' }}>
                                                {cat}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {menuItems.filter(m => m.category === cat).map(item => (
                                                    <div key={item.id} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 14,
                                                        background: '#fff',
                                                        border: `1px solid ${item.available ? 'rgba(22,163,74,0.2)' : 'var(--cream-300)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '12px 16px',
                                                        transition: 'all 0.2s ease'
                                                    }}>
                                                        {/* Status dot */}
                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.available ? '#16a34a' : '#d1d5db', flexShrink: 0, transition: 'background 0.3s ease' }} />

                                                        {/* Item info */}
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: item.available ? 'var(--text-primary)' : 'var(--text-muted)' }}>{item.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₱{Number(item.price).toFixed(2)}</div>
                                                        </div>

                                                        {/* Toggle pill */}
                                                        <button
                                                            onClick={() => toggleAvailability(item)}
                                                            disabled={togglingId === item.id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 7,
                                                                padding: '7px 16px',
                                                                borderRadius: 20,
                                                                border: 'none',
                                                                cursor: togglingId === item.id ? 'wait' : 'pointer',
                                                                fontWeight: 700,
                                                                fontSize: '0.78rem',
                                                                transition: 'all 0.2s ease',
                                                                background: item.available ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                                                                color: item.available ? '#166534' : '#991b1b',
                                                            }}
                                                        >
                                                            {togglingId === item.id ? (
                                                                <RefreshCw size={13} className="spin" />
                                                            ) : item.available ? (
                                                                <Eye size={13} />
                                                            ) : (
                                                                <EyeOff size={13} />
                                                            )}
                                                            {togglingId === item.id ? 'Saving...' : item.available ? 'Available' : 'Unavailable'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Floating Action Bar - Only shows when there are changes */}
            <div style={{
                position: 'absolute',
                bottom: hasChanges ? 30 : -100,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                padding: '16px 30px',
                borderRadius: '50px',
                boxShadow: '0 15px 35px rgba(0,0,0,0.15), 0 5px 15px rgba(111, 78, 55, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                zIndex: 100,
                border: '1px solid rgba(255,255,255,0.5)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brown-800)', fontWeight: 600 }}>
                    <div style={{ background: 'var(--warning)', width: 10, height: 10, borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                    Unsaved Changes Detected
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                        className="btn btn-secondary" 
                        style={{ borderRadius: '20px', padding: '8px 20px' }}
                        onClick={() => {
                            setFormData({ store_name: settings.store_name || '', tax_rate: settings.tax_rate || '0.12', receipt_footer: settings.receipt_footer || '' })
                            setHasChanges(false)
                        }}
                    >
                        Discard
                    </button>
                    <button 
                        className="btn btn-primary" 
                        style={{ borderRadius: '20px', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={handleSave} 
                        disabled={saving}
                    >
                        {saving ? <RefreshCw className="spin" size={16} /> : <Check size={16} strokeWidth={3} />} 
                        {saving ? 'Applying...' : 'Apply Settings'}
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                    70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
            `}} />
        </div>
    )
}
