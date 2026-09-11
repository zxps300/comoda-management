/* ============================================================
   Comoda Restaurant Management System — Kitchen Display
   Figma-style order cards with status actions
   ============================================================ */

const Kitchen = {
    filter: 'active',

    async render() {
        const container = document.getElementById('page-kitchen');
        let orders;
        try { orders = await DataStore.getAll('orders'); } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load orders</p></div>';
            return;
        }

        const statuses = { active: ['Pending', 'Preparing'], all: null, ready: ['Ready'] };
        const filtered = statuses[this.filter]
            ? orders.filter(o => statuses[this.filter].includes(o.status))
            : orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled');

        const statusColor = {
            'Pending': { badge: 'badge-warning', btn: 'btn-primary', lbl: 'Mark Preparing', next: 'Preparing' },
            'Preparing': { badge: 'badge-warning', btn: 'btn-success', lbl: 'Mark Ready', next: 'Ready' },
            'Ready': { badge: 'badge-success', btn: 'btn-info', lbl: 'Mark Delivered', next: 'Delivered' },
            'Delivered': { badge: 'badge-info', btn: '', lbl: '', next: '' },
        };

        container.innerHTML = `
            <!-- Toolbar -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
                <div style="display:flex;gap:8px">
                    ${[['active', 'Active Orders'], ['ready', 'Ready'], ['all', 'All']].map(([k, l]) => `
                    <button class="btn ${this.filter === k ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="Kitchen.setFilter('${k}')">${l}</button>`).join('')}
                </div>
                <button class="btn btn-secondary btn-sm" onclick="Kitchen.render()">
                    <i data-lucide="refresh-cw"></i> Refresh
                </button>
            </div>

            <!-- Order Grid -->
            <div class="order-grid">
                ${filtered.length === 0
                ? `<div class="empty-state" style="grid-column:1/-1;padding:60px">
                        <i data-lucide="chef-hat" style="width:48px;height:48px;opacity:0.3;margin-bottom:12px"></i>
                        <p>No orders in this category</p>
                       </div>`
                : filtered.map(o => {
                    const sc = statusColor[o.status] || statusColor['Pending'];
                    const mins = Math.floor((Date.now() - new Date(o.createdAt)) / 60000);
                    const timeAgo = mins < 1 ? 'just now' : mins + ' min ago';
                    return `
                        <div class="order-card">
                            <div class="order-card-header">
                                <h4>#${String(o.id).padStart(5, '0')}</h4>
                                <span class="badge ${sc.badge}">
                                    <i data-lucide="${o.status === 'Ready' ? 'check-circle' : o.status === 'Preparing' ? 'clock' : 'circle'}"></i>
                                    ${o.status}
                                </span>
                            </div>
                            <div class="order-card-sub">Table ${o.tableNumber} • ${o.customerName || 'Walk-in'}</div>
                            <ul class="order-card-items">
                                ${o.items.map(i => `
                                    <li>
                                        <span style="font-weight:600">${i.quantity}× ${i.name}</span>
                                        <span>${App.currency(i.price * i.quantity)}</span>
                                    </li>`).join('')}
                            </ul>
                            <div class="order-card-footer">
                                <span class="order-card-time">${timeAgo}</span>
                                <span class="order-total">${App.currency(o.total)}</span>
                            </div>
                            ${sc.next ? `
                            <div class="order-card-actions">
                                <button class="btn ${sc.btn} btn-sm" style="flex:1;justify-content:center" onclick="Kitchen.updateStatus(${o.id},'${sc.next}')">
                                    ${sc.lbl}
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="Kitchen.viewDetail(${o.id})">Details</button>
                            </div>` : `
                            <div class="order-card-actions">
                                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="Kitchen.viewDetail(${o.id})">View Details</button>
                            </div>`}
                        </div>`;
                }).join('')}
            </div>
        `;
        lucide.createIcons();
    },

    setFilter(f) { this.filter = f; this.render(); },

    async updateStatus(id, status) {
        try {
            await DataStore.update('orders', id, { status });
            App.toast(`Order marked as ${status}`, 'success');
            this.render();
        } catch (e) { App.toast('Error: ' + e.message, 'error'); }
    },

    async viewDetail(id) {
        let order;
        try { order = await DataStore.getById('orders', id); } catch (e) { return; }
        if (!order) return;
        document.getElementById('orderDetailBody').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div><h4 style="font-size:1rem;font-weight:700">#${String(order.id).padStart(5, '0')}</h4>
                <p style="font-size:0.82rem;color:var(--text-muted)">Table ${order.tableNumber} • ${order.customerName}</p></div>
                <span class="badge ${Dashboard.statusBadge(order.status)}">${order.status}</span>
            </div>
            <div class="table-wrapper"><table>
                <thead><tr><th>Item</th><th>Qty</th><th class="text-right">Price</th></tr></thead>
                <tbody>${order.items.map(i => `<tr><td><strong>${i.name}</strong></td><td>${i.quantity}</td><td class="text-right">${App.currency(i.price)}</td></tr>`).join('')}</tbody>
            </table></div>
            <div style="margin-top:16px;text-align:right;font-size:1.1rem;font-weight:800;color:var(--primary)">Total: ${App.currency(order.total)}</div>`;
        App.openModal('orderDetailModal');
    }
};
