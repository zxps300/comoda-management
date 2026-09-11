/* ============================================================
   Comoda Restaurant Management System — Reports (API-backed)
   ============================================================ */

const Reports = {
    reportType: 'daily',
    selectedDate: new Date().toISOString().split('T')[0],
    selectedMonth: new Date().toISOString().slice(0, 7),

    render() {
        const container = document.getElementById('page-reports');
        container.innerHTML = `
            <div class="flex gap-md mb-lg" style="flex-wrap:wrap">
                <button class="btn ${this.reportType === 'daily' ? 'btn-primary' : 'btn-secondary'}" onclick="Reports.setType('daily')"><i data-lucide="calendar"></i> Daily Sales</button>
                <button class="btn ${this.reportType === 'monthly' ? 'btn-primary' : 'btn-secondary'}" onclick="Reports.setType('monthly')"><i data-lucide="calendar-range"></i> Monthly Sales</button>
                <button class="btn ${this.reportType === 'inventory' ? 'btn-primary' : 'btn-secondary'}" onclick="Reports.setType('inventory')"><i data-lucide="package"></i> Inventory Status</button>
            </div>
            <div id="reportContent"></div>`;
        lucide.createIcons();
        this.renderReport();
    },

    setType(type) { this.reportType = type; this.render(); },

    renderReport() {
        switch (this.reportType) {
            case 'daily': this.renderDaily(); break;
            case 'monthly': this.renderMonthly(); break;
            case 'inventory': this.renderInventory(); break;
        }
    },

    async renderDaily() {
        const el = document.getElementById('reportContent');
        let data;
        try { data = await DataStore.request('GET', '/reports/daily?date=' + this.selectedDate); } catch (e) { el.innerHTML = '<p>Error loading report</p>'; return; }

        el.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i data-lucide="calendar"></i> Daily Sales Report</h3>
                    <input type="date" class="form-control" value="${this.selectedDate}" onchange="Reports.selectedDate=this.value;Reports.renderDaily()" style="width:180px">
                </div>
                <div class="card-body">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">
                        <div style="background:linear-gradient(135deg,#ff8c00 0%,#f59e0b 50%,#fbbf24 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(245,158,11,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;color:#fff;line-height:1">${App.currency(data.totalRevenue)}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Total Revenue</div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#60a5fa 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(59,130,246,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:2.2rem;font-weight:800;color:#fff;line-height:1">${data.transactionCount}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Transactions</div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg,#7c3aed 0%,#8b5cf6 50%,#a78bfa 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(139,92,246,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;color:#fff;line-height:1">${App.currency(data.avgPerTransaction)}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Avg Per Transaction</div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(16,185,129,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:2.2rem;font-weight:800;color:#fff;line-height:1">${data.itemsSold}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Items Sold</div>
                            </div>
                        </div>
                    </div>
                    ${data.topItems && data.topItems.length > 0 ? `
                    <h4 class="mb-md" style="font-size:0.95rem">Top Selling Items</h4>
                    <div class="table-wrapper mb-lg"><table>
                        <thead><tr><th>Item</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                        <tbody>${data.topItems.slice(0, 10).map(i => `<tr><td><strong>${i.name}</strong></td><td>${i.qty}</td><td class="text-accent">${App.currency(i.revenue)}</td></tr>`).join('')}</tbody>
                    </table></div>` : ''}
                    <h4 class="mb-md" style="font-size:0.95rem">Transaction Details</h4>
                    <div class="table-wrapper"><table>
                        <thead><tr><th>ID</th><th>Time</th><th>Items</th><th>Total</th><th>Cashier</th></tr></thead>
                        <tbody>${!data.transactions || data.transactions.length === 0 ? '<tr><td colspan="5"><div class="empty-state"><p>No sales on this date</p></div></td></tr>' :
                data.transactions.map(s => `<tr><td>#${String(s.id).padStart(6, '0')}</td><td>${s.time || '—'}</td><td>${s.items}</td><td class="text-accent fw-700">${App.currency(s.total)}</td><td>${s.cashier || '—'}</td></tr>`).join('')}
                        </tbody>
                    </table></div>
                </div>
            </div>`;
        lucide.createIcons();
    },

    async renderMonthly() {
        const el = document.getElementById('reportContent');
        let data;
        try { data = await DataStore.request('GET', '/reports/monthly?month=' + this.selectedMonth); } catch (e) { el.innerHTML = '<p>Error loading report</p>'; return; }

        el.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i data-lucide="calendar-range"></i> Monthly Sales Report</h3>
                    <input type="month" class="form-control" value="${this.selectedMonth}" onchange="Reports.selectedMonth=this.value;Reports.renderMonthly()" style="width:180px">
                </div>
                <div class="card-body">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">
                        <div style="background:linear-gradient(135deg,#ff8c00 0%,#f59e0b 50%,#fbbf24 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(245,158,11,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;color:#fff;line-height:1">${App.currency(data.totalRevenue)}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Monthly Revenue</div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#60a5fa 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(59,130,246,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:2.2rem;font-weight:800;color:#fff;line-height:1">${data.transactionCount}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Total Transactions</div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg,#0e7490 0%,#06b6d4 50%,#67e8f9 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(6,182,212,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:2.2rem;font-weight:800;color:#fff;line-height:1">${data.activeDays}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Active Days</div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg,#7c3aed 0%,#8b5cf6 50%,#a78bfa 100%);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(139,92,246,0.38);">
                            <div style="position:absolute;top:-25px;right:-25px;width:100px;height:100px;background:rgba(255,255,255,0.12);border-radius:50%;"></div>
                            <div style="position:absolute;bottom:-15px;right:25px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
                            <div style="position:relative;z-index:1">
                                <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;color:#fff;line-height:1">${App.currency(data.dailyAverage)}</div>
                                <div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.85);margin-top:5px">Daily Average</div>
                            </div>
                        </div>
                    </div>
                    <h4 class="mb-md" style="font-size:0.95rem">Daily Breakdown</h4>
                    <div class="table-wrapper mb-lg"><table>
                        <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
                        <tbody>${!data.dailyBreakdown || data.dailyBreakdown.length === 0 ? '<tr><td colspan="3"><div class="empty-state"><p>No data</p></div></td></tr>' :
                data.dailyBreakdown.map(d => `<tr><td>${d.date}</td><td>${d.count}</td><td class="text-accent fw-700">${App.currency(d.total)}</td></tr>`).join('')}
                        </tbody>
                    </table></div>
                    ${data.topItems && data.topItems.length > 0 ? `<h4 class="mb-md" style="font-size:0.95rem">Top Items This Month</h4>
                    <div class="table-wrapper"><table><thead><tr><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead>
                    <tbody>${data.topItems.slice(0, 10).map(i => `<tr><td><strong>${i.name}</strong></td><td>${i.qty}</td><td class="text-accent">${App.currency(i.revenue)}</td></tr>`).join('')}</tbody></table></div>` : ''}
                </div>
            </div>`;
        lucide.createIcons();
    },

    async renderInventory() {
        const el = document.getElementById('reportContent');
        let data;
        try { data = await DataStore.request('GET', '/reports/inventory'); } catch (e) { el.innerHTML = '<p>Error loading report</p>'; return; }

        el.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i data-lucide="package"></i> Inventory Status Report</h3></div>
                <div class="card-body">
                    <div class="report-summary">
                        <div class="report-stat"><div class="value">${data.totalItems}</div><div class="label">Total Items</div></div>
                        <div class="report-stat"><div class="value" style="color:var(--success)">${data.wellStocked}</div><div class="label">Well Stocked</div></div>
                        <div class="report-stat"><div class="value" style="color:var(--warning)">${data.lowStock}</div><div class="label">Low Stock</div></div>
                        <div class="report-stat"><div class="value" style="color:var(--danger)">${data.outOfStock}</div><div class="label">Out of Stock</div></div>
                    </div>
                    <h4 class="mb-md" style="font-size:0.95rem">By Category</h4>
                    <div class="table-wrapper mb-lg"><table>
                        <thead><tr><th>Category</th><th>Items</th><th>Low Stock</th></tr></thead>
                        <tbody>${(data.categories || []).map(c => `<tr><td><strong>${c.category}</strong></td><td>${c.count}</td><td>${c.low > 0 ? `<span class="badge badge-warning">${c.low}</span>` : '<span class="badge badge-success">OK</span>'}</td></tr>`).join('')}</tbody>
                    </table></div>
                    <h4 class="mb-md" style="font-size:0.95rem">All Items</h4>
                    <div class="table-wrapper"><table>
                        <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Min</th><th>Unit</th><th>Status</th></tr></thead>
                        <tbody>${(data.items || []).map(i => `<tr>
                            <td><strong>${i.name}</strong></td><td>${i.category}</td>
                            <td class="${i.status !== 'OK' ? 'text-danger fw-700' : ''}">${i.quantity}</td>
                            <td>${i.min_stock}</td><td>${i.unit}</td>
                            <td>${i.status === 'Out' ? '<span class="badge badge-danger">Out</span>' : i.status === 'Low' ? '<span class="badge badge-warning">Low</span>' : '<span class="badge badge-success">OK</span>'}</td>
                        </tr>`).join('')}</tbody>
                    </table></div>
                </div>
            </div>`;
        lucide.createIcons();
    }
};
