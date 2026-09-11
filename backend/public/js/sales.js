/* ============================================================
   Comoda Restaurant Management System — Sales Records (API-backed)
   ============================================================ */

const Sales = {
    dateFilter: '',

    async render() {
        const container = document.getElementById('page-sales');
        let sales;
        try {
            let endpoint = '/sales';
            if (this.dateFilter) endpoint += '?date=' + this.dateFilter;
            sales = await DataStore.request('GET', endpoint);
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load sales</p></div>';
            return;
        }

        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
        const avgTransaction = sales.length > 0 ? totalRevenue / sales.length : 0;

        container.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:24px">
                <div class="stat-card" style="
                    background: linear-gradient(135deg, #ff8c00 0%, #f59e0b 50%, #fbbf24 100%);
                    border: none; position: relative; overflow: hidden;
                    box-shadow: 0 8px 32px rgba(245,158,11,0.40), 0 2px 8px rgba(0,0,0,0.10);">
                    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                    <div style="position:absolute;bottom:-20px;right:30px;width:70px;height:70px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
                        <div style="width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i data-lucide="philippine-peso" style="width:28px;height:28px;color:#fff;"></i>
                        </div>
                        <div>
                            <div style="font-family:'Outfit',sans-serif;font-size:1.8rem;font-weight:800;color:#fff;line-height:1;">${App.currency(totalRevenue)}</div>
                            <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:4px;">${this.dateFilter ? 'Filtered' : 'Total'} Revenue</div>
                        </div>
                    </div>
                </div>
                <div class="stat-card" style="
                    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
                    border: none; position: relative; overflow: hidden;
                    box-shadow: 0 8px 32px rgba(59,130,246,0.40), 0 2px 8px rgba(0,0,0,0.10);">
                    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                    <div style="position:absolute;bottom:-20px;right:30px;width:70px;height:70px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
                        <div style="width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i data-lucide="hash" style="width:28px;height:28px;color:#fff;"></i>
                        </div>
                        <div>
                            <div style="font-family:'Outfit',sans-serif;font-size:2.4rem;font-weight:800;color:#fff;line-height:1;">${sales.length}</div>
                            <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:4px;">Transactions</div>
                        </div>
                    </div>
                </div>
                <div class="stat-card" style="
                    background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%);
                    border: none; position: relative; overflow: hidden;
                    box-shadow: 0 8px 32px rgba(139,92,246,0.40), 0 2px 8px rgba(0,0,0,0.10);">
                    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                    <div style="position:absolute;bottom:-20px;right:30px;width:70px;height:70px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
                        <div style="width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i data-lucide="bar-chart" style="width:28px;height:28px;color:#fff;"></i>
                        </div>
                        <div>
                            <div style="font-family:'Outfit',sans-serif;font-size:1.8rem;font-weight:800;color:#fff;line-height:1;">${App.currency(avgTransaction)}</div>
                            <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:4px;">Avg. Transaction</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i data-lucide="trending-up"></i> Sales Transactions</h3>
                    <div class="toolbar">
                        <input type="date" class="form-control" value="${this.dateFilter}" onchange="Sales.filterDate(this.value)" style="width:180px">
                        ${this.dateFilter ? '<button class="btn btn-secondary btn-sm" onclick="Sales.clearFilter()">Clear</button>' : ''}
                    </div>
                </div>
                <div class="card-body no-padding">
                    <div class="table-wrapper"><table>
                        <thead><tr><th>ID</th><th>Date</th><th>Time</th><th>Items</th><th>Total</th><th>Cashier</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${sales.length === 0 ? '<tr><td colspan="7"><div class="empty-state"><p>No records</p></div></td></tr>' :
                sales.slice(0, 50).map(s => `<tr>
                                <td><strong>#${String(s.id).padStart(6, '0')}</strong></td>
                                <td>${s.date || '—'}</td><td>${s.time || '—'}</td>
                                <td>${s.items.length} item(s)</td>
                                <td class="text-accent fw-700">${App.currency(s.total)}</td>
                                <td>${s.cashier || '—'}</td>
                                <td><button class="btn btn-secondary btn-sm" onclick="Sales.viewDetail(${s.id})"><i data-lucide="eye"></i></button></td>
                            </tr>`).join('')}
                        </tbody>
                    </table></div>
                </div>
            </div>`;
        lucide.createIcons();
    },

    filterDate(d) { this.dateFilter = d; this.render(); },
    clearFilter() { this.dateFilter = ''; this.render(); },

    async viewDetail(id) {
        let sale;
        try { sale = await DataStore.getById('sales', id); } catch (e) { return; }
        if (!sale) return;
        document.getElementById('saleDetailBody').innerHTML = `
            <div class="flex justify-between items-center mb-lg">
                <div><h4>Transaction #${String(sale.id).padStart(6, '0')}</h4><p class="text-secondary">${sale.date} at ${sale.time || '—'}</p></div>
                <span class="badge badge-success">Completed</span>
            </div>
            <div class="table-wrapper mb-lg"><table>
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th class="text-right">Subtotal</th></tr></thead>
                <tbody>${sale.items.map(i => `<tr><td><strong>${i.name}</strong></td><td>${i.quantity}</td><td>${App.currency(i.price)}</td><td class="text-right text-accent">${App.currency(i.price * i.quantity)}</td></tr>`).join('')}</tbody>
            </table></div>
            <div style="text-align:right;padding:16px 0;border-top:2px solid var(--border)">
                <span class="text-secondary" style="margin-right:16px">Total</span>
                <span class="font-outfit fw-700 text-accent" style="font-size:1.5rem">${App.currency(sale.total)}</span>
            </div>
            <div class="text-muted mt-md" style="font-size:0.85rem">Cashier: <strong>${sale.cashier || '—'}</strong></div>`;
        App.openModal('saleDetailModal');
    }
};
