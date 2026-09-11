import { useEffect, useState } from 'react'
import { salesService } from '../services/sales.service'
import { useToastContext } from '../contexts/ToastContext'
import Modal from '../components/ui/Modal'
import { TrendingUp } from 'lucide-react'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })

export default function Sales() {
    const toast = useToastContext()
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [detail, setDetail] = useState(null)

    useEffect(() => {
        salesService.getAll()
            .then(setSales)
            .catch(() => toast('Failed to load sales', 'error'))
            .finally(() => setLoading(false))
    }, [])

    const totalRevenue = sales.reduce((s, r) => s + Number(r.total), 0)
    const today = new Date().toISOString().split('T')[0]
    const todayRevenue = sales.filter((s) => s.date === today).reduce((sum, r) => sum + Number(r.total), 0)

    return (
        <div>
            <div className="page-header">
                <div><h2>Sales Records</h2><p>View all completed transactions</p></div>
            </div>

            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon brown"><TrendingUp /></div>
                    <div className="stat-info">
                        <div className="stat-label">Total Revenue</div>
                        <div className="stat-value" style={{ fontSize: '1.3rem' }}>{fmt(totalRevenue)}</div>
                        <div className="stat-sub">{sales.length} transactions</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><TrendingUp /></div>
                    <div className="stat-info">
                        <div className="stat-label">Today's Revenue</div>
                        <div className="stat-value" style={{ fontSize: '1.3rem' }}>{fmt(todayRevenue)}</div>
                        <div className="stat-sub">{sales.filter((s) => s.date === today).length} transactions today</div>
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? <div className="loading"><div className="spinner" /></div> : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>#</th><th>Date</th><th>Time</th><th>Cashier</th><th>Total</th><th>Received</th><th>Change</th><th></th></tr>
                            </thead>
                            <tbody>
                                {sales.length === 0 ? (
                                    <tr><td colSpan={8}><div className="empty-state"><TrendingUp size={36} /><h3>No sales yet</h3></div></td></tr>
                                ) : sales.map((s) => (
                                    <tr key={s.id}>
                                        <td className="font-mono">#{s.id}</td>
                                        <td>{s.date}</td>
                                        <td>{s.time}</td>
                                        <td>{s.cashier}</td>
                                        <td><strong style={{ color: 'var(--brown-700)' }}>{fmt(s.total)}</strong></td>
                                        <td>{fmt(s.amount_received)}</td>
                                        <td>{fmt(s.change_amount)}</td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setDetail(s)}>View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Sale #${detail?.id}`} narrow
                footer={<button className="btn btn-secondary btn-block" onClick={() => setDetail(null)}>Close</button>}>
                {detail && (
                    <div>
                        <div className="form-row">
                            <div><div className="stat-label">Date</div><strong>{detail.date}</strong></div>
                            <div><div className="stat-label">Time</div><strong>{detail.time}</strong></div>
                        </div>
                        <div style={{ marginTop: 12 }}><div className="stat-label">Cashier</div><strong>{detail.cashier}</strong></div>
                        <hr style={{ margin: '16px 0', borderColor: 'var(--cream-300)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Total Billed</span><strong>{fmt(detail.total)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Amount Received</span><strong>{fmt(detail.amount_received)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Change Given</span><strong style={{ color: 'var(--success)' }}>{fmt(detail.change_amount)}</strong></div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
