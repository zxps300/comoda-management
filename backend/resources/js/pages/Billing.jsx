import { useEffect, useState } from 'react'
import { ordersService } from '../services/orders.service'
import { salesService } from '../services/sales.service'
import Modal from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { Receipt, Printer } from 'lucide-react'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })

export default function Billing() {
    const toast = useToastContext()
    const { user } = useAuth()
    const [orders, setOrders] = useState([])
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [payModal, setPayModal] = useState(false)
    const [receiptModal, setReceiptModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [amountReceived, setAmountReceived] = useState('')
    const [lastSale, setLastSale] = useState(null)
    const [processing, setProcessing] = useState(false)

    const load = () => {
        setLoading(true)
        Promise.all([
            ordersService.getAll({ status: 'Completed,Ready,Preparing,Pending' }),
            salesService.getAll()
        ]).then(([orderData, saleData]) => {
            setOrders(orderData.filter(o => o.status !== 'Cancelled'))
            setSales(saleData)
        }).catch(() => toast('Failed to load data', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(load, [])

    const openPay = (order) => {
        setSelectedOrder(order)
        setAmountReceived('')
        setPayModal(true)
    }

    const openReceipt = (sale) => {
        setLastSale(sale)
        setReceiptModal(true)
    }

    const change = Number(amountReceived) - (selectedOrder?.total || 0)

    const processPayment = async () => {
        if (!amountReceived || Number(amountReceived) < selectedOrder.total) {
            toast('Insufficient amount received', 'warning'); return
        }
        setProcessing(true)
        try {
            const sale = await salesService.create({
                orderId: selectedOrder.id,
                total: selectedOrder.total,
                amountReceived: Number(amountReceived),
                change: change,
                cashier: user?.fullName || 'Cashier',
            })
            setLastSale({ ...sale, order: selectedOrder })
            setPayModal(false)
            setReceiptModal(true)
            toast('Payment processed!', 'success')
            load()
        } catch (err) {
            toast(err.response?.data?.message || 'Error processing payment', 'error')
        } finally { setProcessing(false) }
    }

    const unpaid = orders.filter((o) => !o.isPaid)
    const served = orders.filter((o) => o.status === 'Completed').slice(0, 10)

    return (
        <div>
            <div className="page-header">
                <div><h2>Billing & Receipts</h2><p>View completed transactions and process payments</p></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
                {/* Transaction History (Sales) */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Completed Transactions (Paid)</span>
                        <span className="badge badge-success">{sales.length}</span>
                    </div>
                    {loading ? <div className="loading"><div className="spinner" /></div> : sales.length === 0 ? (
                        <div className="empty-state"><Receipt size={36} /><h3>No completed payments</h3></div>
                    ) : sales.map((s) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--cream-300)' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>Order #{s.orderId} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>• {s.time}</span></div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.items?.length || 0} items · Cashier: {s.cashier}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, color: 'var(--success)' }}>{fmt(s.total)}</div>
                                <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => openReceipt(s)}>
                                    <Printer size={13} /> Receipt
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Unpaid Orders or Served Status */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Unpaid Orders (Waiter)</span>
                        <span className="badge badge-warning">{unpaid.length}</span>
                    </div>
                    {unpaid.length === 0 ? (
                        <div className="empty-state"><Receipt size={36} /><h3>No unpaid orders</h3></div>
                    ) : unpaid.map((o) => (
                        <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--cream-300)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Table {o.tableNumber} <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>#{o.id}</span></div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.items?.length} items · <StatusBadge status={o.status} /></div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {o.items?.map((i, idx) => (
                                        <span key={idx} style={{ background: 'var(--cream-100)', padding: '1px 5px', borderRadius: 4 }}>{i.name} ×{i.quantity}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, color: 'var(--brown-700)' }}>{fmt(o.total)}</div>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={() => openPay(o)}>
                                    <Receipt size={13} /> Pay
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Modal */}
            <Modal isOpen={payModal} onClose={() => setPayModal(false)} title={`Process Payment — Table ${selectedOrder?.tableNumber}`}
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
                    <button className="btn btn-success btn-lg" onClick={processPayment} disabled={processing || change < 0}>
                        {processing ? 'Processing...' : 'Confirm Payment'}
                    </button>
                </>}>
                {selectedOrder && (
                    <>
                        <div style={{ background: 'var(--cream-100)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
                            {selectedOrder.items?.map((i, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                    <span>{i.name} ×{i.quantity}</span>
                                    <span>{fmt(i.price * i.quantity)}</span>
                                </div>
                            ))}
                            <hr className="receipt-divider" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                                <span>Total</span><span style={{ color: 'var(--brown-700)' }}>{fmt(selectedOrder.total)}</span>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Amount Received</label>
                            <input className="input" type="number" step="0.01" placeholder="Enter amount" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
                        </div>
                        {amountReceived && (
                            <div style={{ background: change >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{change >= 0 ? 'Change' : 'Insufficient by'}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.4rem', color: change >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(Math.abs(change))}</div>
                            </div>
                        )}
                    </>
                )}
            </Modal>

            {/* Sales Invoice Modal */}
            <Modal isOpen={receiptModal} onClose={() => setReceiptModal(false)} title="Sales Invoice" narrow
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setReceiptModal(false)}>Close</button>
                    <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Invoice</button>
                </>}>
                {lastSale && (
                    <div className="receipt">
                        <div style={{ textAlign: 'center', marginBottom: 10 }}>
                            <strong style={{ fontSize: '1.2rem' }}>COMODA RESTAURANT</strong><br />
                            <span>SALES INVOICE</span>
                        </div>
                        <hr className="receipt-divider" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>Order ID: #{lastSale.orderId || lastSale.order?.id}</span>
                            <span>Date: {lastSale.date}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>Cashier: {lastSale.cashier}</span>
                            <span>Time: {lastSale.time}</span>
                        </div>
                        <hr className="receipt-divider" />
                        {(lastSale.order?.items || lastSale.items)?.map((i, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 2 }}>
                                <span>{i.name} ×{i.quantity}</span>
                                <span>{fmt(i.price * i.quantity)}</span>
                            </div>
                        ))}
                        <hr className="receipt-divider" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                            <span>Total</span><strong>{fmt(lastSale.total)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: 4 }}>
                            <span>Received</span><span>{fmt(lastSale.amountReceived ?? lastSale.amount_received)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span>Change</span><span>{fmt(lastSale.change ?? lastSale.change_amount)}</span>
                        </div>
                        <hr className="receipt-divider" />
                        <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.85rem', marginTop: 10 }}>Thank you for dining with us!</div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
