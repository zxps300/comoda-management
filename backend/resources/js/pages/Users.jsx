import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, UserRound } from 'lucide-react'
import { usersService } from '../services/users.service'
import Modal from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import { useToastContext } from '../contexts/ToastContext'

const ROLES = ['Admin', 'Cashier', 'Purchaser', 'Kitchen Staff', 'Waiter']
const BLANK = { fullName: '', username: '', email: '', password: '', role: '', is_active: true }

export default function Users() {
    const toast = useToastContext()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(BLANK)
    const [saving, setSaving] = useState(false)

    const load = () => {
        setLoading(true)
        usersService.getAll()
            .then(setUsers)
            .catch(() => toast('Failed to load users', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(load, [])

    const openAdd = () => { setEditing(null); setForm(BLANK); setModal(true) }
    const openEdit = (u) => {
        setEditing(u)
        setForm({ full_name: u.full_name, username: u.username, email: u.email || '', password: '', role: u.role, is_active: u.is_active })
        setModal(true)
    }

    const save = async () => {
        if (!form.fullName || !form.username || !form.role) {
            toast('Name, username, and role are required', 'warning')
            return
        }
        if (!editing && !form.password) {
            toast('Password is required for new users', 'warning')
            return
        }
        setSaving(true)
        try {
            const payload = { ...form }
            if (!payload.password) delete payload.password
            if (editing) {
                await usersService.update(editing.id, payload)
                toast('User updated', 'success')
            } else {
                await usersService.create(payload)
                toast('User created', 'success')
            }
            setModal(false)
            load()
        } catch (err) {
            toast(err.response?.data?.message || 'Error saving user', 'error')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (u) => {
        if (!confirm(`Delete ${u.fullName}?`)) return
        try {
            await usersService.delete(u.id)
            toast('User deleted', 'success')
            load()
        } catch { toast('Error deleting user', 'error') }
    }

    const filtered = users.filter((u) =>
        [u.fullName, u.username, u.email, u.role].join(' ').toLowerCase().includes(search.toLowerCase())
    )

    const initials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>User Management</h2>
                    <p>Manage staff accounts and access roles</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={16} /> Add User
                </button>
            </div>

            <div className="card">
                <div className="search-bar">
                    <div className="search-input-wrapper">
                        <Search size={16} />
                        <input className="input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner" /></div>
                ) : (
                    <div className="user-cards-grid">
                        {filtered.length === 0 ? (
                            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                                <UserRound size={48} />
                                <h3>No users found</h3>
                            </div>
                        ) : filtered.map((u) => (
                            <div className="user-card" key={u.id}>
                                <div className="user-card-avatar">{initials(u.fullName)}</div>
                                <div className="user-card-name">{u.fullName}</div>
                                <div className="user-card-email">{u.email || '—'}</div>
                                <StatusBadge status={u.role} />
                                <div style={{ marginTop: 4 }}>
                                    <StatusBadge status={u.is_active ? 'Active' : 'Inactive'} />
                                </div>
                                <div className="user-card-actions">
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>
                                        <Pencil size={14} /> Edit
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={modal}
                onClose={() => setModal(false)}
                title={editing ? 'Edit User' : 'Add User'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={save} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label>Full Name *</label>
                    <input className="input" placeholder="John Doe" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input className="input" type="email" placeholder="john@comoda.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Username *</label>
                        <input className="input" placeholder="juandc" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                        <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Role *</label>
                        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                            <option value="">Select role...</option>
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Status</label>
                        <select className="input" value={String(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
