/* ============================================================
   Comoda Restaurant Management System — Billing & Receipts
   Auto-compute totals, payment, digital receipt (API-backed)
   ============================================================ */

const Billing = {
    currentOrderId: null,

    async render() {
        const container = document.getElementById('page-billing');
        let orders;
        try {
            orders = await DataStore.getAll('orders');
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load billing</p></div>';
            return;
        }

        const readyOrders = orders.filter(o => o.status === 'Ready' || o.status === 'Completed');
        const pendingBills = orders.filter(o => o.status === 'Ready');
        readyOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        container.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
                <div class="stat-card" style="
                    background: linear-gradient(135deg, #ff8c00 0%, #f59e0b 50%, #fbbf24 100%);
                    border: none;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(245,158,11,0.40), 0 2px 8px rgba(0,0,0,0.10);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    ">
                    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                    <div style="position:absolute;bottom:-20px;right:30px;width:70px;height:70px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
                        <div style="width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i data-lucide="receipt" style="width:28px;height:28px;color:#fff;"></i>
                        </div>
                        <div>
                            <div style="font-family:'Outfit',sans-serif;font-size:2.4rem;font-weight:800;color:#fff;line-height:1;">${pendingBills.length}</div>
                            <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:4px;letter-spacing:0.02em;">Pending Bills</div>
                        </div>
                    </div>
                </div>
                <div class="stat-card" style="
                    background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);
                    border: none;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(16,185,129,0.40), 0 2px 8px rgba(0,0,0,0.10);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    ">
                    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                    <div style="position:absolute;bottom:-20px;right:30px;width:70px;height:70px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
                        <div style="width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i data-lucide="check-circle" style="width:28px;height:28px;color:#fff;"></i>
                        </div>
                        <div>
                            <div style="font-family:'Outfit',sans-serif;font-size:2.4rem;font-weight:800;color:#fff;line-height:1;">${orders.filter(o => o.status === 'Completed').length}</div>
                            <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:4px;letter-spacing:0.02em;">Completed Today</div>
                        </div>
                    </div>
                </div>
            </div>

            ${pendingBills.length > 0 ? `
            <div class="card mb-lg">
                <div class="card-header"><h3><i data-lucide="clock"></i> Ready for Billing</h3></div>
                <div class="card-body">
                    <div class="order-grid">
                        ${pendingBills.map(o => `
                            <div class="order-card" onclick="Billing.openFromOrder(${o.id})">
                                <div class="order-card-header">
                                    <h4>Table ${o.tableNumber}</h4>
                                    <span class="badge badge-success">Ready</span>
                                </div>
                                <ul class="order-card-items">
                                    ${o.items.map(i => `<li>${i.quantity}× ${i.name}</li>`).join('')}
                                </ul>
                                <div class="order-card-footer">
                                    <span class="order-total">${App.currency(o.total)}</span>
                                    <button class="btn btn-primary btn-sm">Bill Now</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>` : ''}

            <div class="card">
                <div class="card-header"><h3><i data-lucide="history"></i> Billing History</h3></div>
                <div class="card-body no-padding">
                    <div class="table-wrapper"><table>
                        <thead><tr><th>Order #</th><th>Table</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${readyOrders.length === 0
                ? '<tr><td colspan="7"><div class="empty-state"><p>No billing records</p></div></td></tr>'
                : readyOrders.slice(0, 20).map(o => `
                                <tr>
                                    <td><strong>#${String(o.id).padStart(6, '0')}</strong></td>
                                    <td>Table ${o.tableNumber}</td>
                                    <td>${o.customerName || '—'}</td>
                                    <td>${o.items.length} items</td>
                                    <td class="text-accent fw-700">${App.currency(o.total)}</td>
                                    <td><span class="badge ${Dashboard.statusBadge(o.status)}">${o.status}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onclick="Billing.viewReceipt(${o.id})">
                                            <i data-lucide="file-text"></i> Receipt
                                        </button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table></div>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    async openFromOrder(orderId) {
        let order;
        try { order = await DataStore.getById('orders', orderId); } catch (e) { return; }
        if (!order) return;
        this.currentOrderId = orderId;

        document.getElementById('billingBody').innerHTML = `
            <div style="margin-bottom:20px">
                <h4>Order #${String(order.id).padStart(6, '0')} — Table ${order.tableNumber}</h4>
                <p class="text-secondary">${order.customerName || 'Walk-in'}</p>
            </div>
            <div class="table-wrapper mb-lg"><table>
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th class="text-right">Subtotal</th></tr></thead>
                <tbody>
                    ${order.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${App.currency(i.price)}</td><td class="text-right text-accent">${App.currency(i.price * i.quantity)}</td></tr>`).join('')}
                </tbody>
            </table></div>
            <div style="text-align:right;padding:16px 0;border-top:2px solid var(--border)">
                <span class="text-secondary" style="font-size:1.1rem;margin-right:16px">Total Amount</span>
                <span class="font-outfit fw-700 text-accent" style="font-size:1.8rem">${App.currency(order.total)}</span>
            </div>
            <div class="form-row mt-lg">
                <div class="form-group">
                    <label>Amount Received</label>
                    <input type="number" class="form-control" id="amountReceived" placeholder="0.00" oninput="Billing.calcChange(${order.total})">
                </div>
                <div class="form-group">
                    <label>Change</label>
                    <input type="text" class="form-control" id="changeAmount" readonly style="font-weight:700;font-size:1.1rem;color:var(--success)">
                </div>
            </div>
        `;
        App.openModal('billingModal');
    },

    calcChange(total) {
        const received = parseFloat(document.getElementById('amountReceived').value) || 0;
        const change = received - total;
        document.getElementById('changeAmount').value = change >= 0 ? App.currency(change) : 'Insufficient';
        document.getElementById('changeAmount').style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
    },

    async processPayment() {
        let order;
        try { order = await DataStore.getById('orders', this.currentOrderId); } catch (e) { return; }
        if (!order) return;

        const received = parseFloat(document.getElementById('amountReceived').value) || 0;
        if (received < order.total) {
            App.toast('Insufficient payment amount', 'error');
            return;
        }

        try {
            await DataStore.request('POST', '/sales', {
                orderId: this.currentOrderId,
                total: order.total,
                amountReceived: received,
                change: received - order.total,
                cashier: Auth.getUser().fullName,
            });
            App.toast('Payment processed successfully!', 'success');
            App.closeModal('billingModal');
            this.viewReceipt(this.currentOrderId);
            this.render();
        } catch (e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    async viewReceipt(orderId) {
        let order;
        try { order = await DataStore.getById('orders', orderId); } catch (e) { return; }
        if (!order) return;

        let sales;
        try { sales = await DataStore.getAll('sales'); } catch (e) { sales = []; }
        const sale = sales.find(s => s.orderId === orderId);
        const now = new Date();

        document.getElementById('receiptContent').innerHTML = `
            <div class="receipt-container" id="printableReceipt">
                <div class="receipt-header">
                    <h2>COMODA RESTAURANT</h2>
                    <p>Premium Dining Experience</p>
                    <p style="margin-top:8px;font-size:11px">
                        Date: ${sale ? sale.date : now.toISOString().split('T')[0]}<br>
                        Time: ${sale ? sale.time : now.toLocaleTimeString()}<br>
                        Order: #${String(order.id).padStart(6, '0')}<br>
                        Table: ${order.tableNumber}<br>
                        Cashier: ${sale ? sale.cashier : Auth.getUser().fullName}
                    </p>
                </div>
                <div class="receipt-items"><table>
                    <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th>Price</th><th style="text-align:right">Amt</th></tr></thead>
                    <tbody>
                        ${order.items.map(i => `<tr><td style="text-align:left">${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:center">${Number(i.price).toFixed(2)}</td><td style="text-align:right">${(i.price * i.quantity).toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table></div>
                <div class="receipt-total">
                    <div style="display:flex;justify-content:space-between"><span>TOTAL</span><span>₱${Number(order.total).toFixed(2)}</span></div>
                    ${sale ? `
                    <div style="display:flex;justify-content:space-between;font-size:0.9rem;font-weight:normal;margin-top:4px"><span>Cash</span><span>₱${Number(sale.amountReceived).toFixed(2)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:0.9rem;font-weight:normal"><span>Change</span><span>₱${Number(sale.change).toFixed(2)}</span></div>` : ''}
                </div>
                <div class="receipt-footer">
                    <p>Thank you for dining with us!</p>
                    <p>Please come again ❤️</p>
                </div>
            </div>
        `;
        App.openModal('receiptModal');
    },

    printReceipt() {
        const content = document.getElementById('printableReceipt').innerHTML;
        const win = window.open('', '_blank', 'width=400,height=600');
        win.document.write(`<html><head><title>Receipt</title>
            <style>body{font-family:'Courier New',monospace;font-size:13px;margin:20px}h2{text-align:center;margin:0}p{margin:4px 0}table{width:100%;border-collapse:collapse}th,td{padding:4px;font-size:12px}.receipt-header,.receipt-footer{text-align:center;border-bottom:2px dashed #ccc;padding:10px 0}.receipt-footer{border-top:2px dashed #ccc;border-bottom:none}.receipt-total{border-top:2px dashed #ccc;padding-top:10px;margin-top:10px;font-weight:bold}</style>
            </head><body>${content}</body></html>`);
        win.document.close();
        win.print();
    }
};
