/* ============================================================
   Comoda Restaurant Management System — Dashboard
   Figma-style gradient stat cards + charts
   ============================================================ */

const Dashboard = {
    async render() {
        const container = document.getElementById('page-dashboard');
        container.innerHTML = `<div class="empty-state"><p>Loading dashboard…</p></div>`;

        let data = {};
        try {
            data = await DataStore.request('GET', '/dashboard');
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><p>Failed to load dashboard data.</p></div>`;
            return;
        }

        const todayRev = data.todayRevenue || 0;
        const activeOrders = data.activeOrders || 0;
        const lowStock = data.lowStockCount || 0;
        const menuItems = data.totalMenuItems || 0;
        const weekly = data.weeklyData || [];
        const topItems = data.topItems || [];
        const lowStockItems = data.lowStockItems || [];
        const activeList = data.activeOrdersList || [];

        const maxBar = Math.max(...weekly.map(d => d.total), 1);

        container.innerHTML = `
            <!-- Stat Cards -->
            <div class="stats-grid">
                <div class="stat-card green">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i data-lucide="philippine-peso"></i></div>
                        <div class="stat-card-badge">↑ Today</div>
                    </div>
                    <div class="stat-label">Today's Revenue</div>
                    <div class="stat-value">${App.currency(todayRev)}</div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i data-lucide="shopping-cart"></i></div>
                        <div class="stat-card-badge">Live</div>
                    </div>
                    <div class="stat-label">Active Orders</div>
                    <div class="stat-value">${activeOrders}</div>
                </div>
                <div class="stat-card blue">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i data-lucide="package"></i></div>
                        <div class="stat-card-badge">${lowStock > 0 ? 'Alert' : 'OK'}</div>
                    </div>
                    <div class="stat-label">Low Stock Alerts</div>
                    <div class="stat-value">${lowStock}</div>
                </div>
                <div class="stat-card pink">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i data-lucide="utensils"></i></div>
                        <div class="stat-card-badge">Menu</div>
                    </div>
                    <div class="stat-label">Menu Items</div>
                    <div class="stat-value">${menuItems}</div>
                </div>
            </div>

            <!-- Charts Row -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                <!-- Weekly Revenue -->
                <div class="card">
                    <div class="card-header">
                        <h3><i data-lucide="trending-up"></i> Weekly Revenue</h3>
                        <span class="badge badge-success">↑ This Week</span>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            ${weekly.map(d => {
            const pct = maxBar > 0 ? Math.max((d.total / maxBar) * 180, 4) : 4;
            return `<div class="chart-bar-group">
                                    <div class="chart-bar" style="height:${pct}px" title="${App.currency(d.total)}"></div>
                                    <div class="chart-bar-label">${d.day}</div>
                                </div>`;
        }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Top Items -->
                <div class="card">
                    <div class="card-header">
                        <h3><i data-lucide="star"></i> Top Selling Items</h3>
                        <span class="badge badge-orange">This Month</span>
                    </div>
                    <div class="card-body" style="padding-top:12px">
                        ${topItems.length === 0
                ? '<div class="empty-state" style="padding:24px"><p>No sales data yet</p></div>'
                : topItems.map((item, i) => `
                            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
                                <div style="width:28px;height:28px;border-radius:50%;background:var(--grad-orange);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:#fff;flex-shrink:0">#${i + 1}</div>
                                <span style="flex:1;font-size:0.85rem;font-weight:500">${item.name}</span>
                                <span style="font-size:0.82rem;color:var(--primary);font-weight:700">${App.currency(item.revenue)}</span>
                            </div>`).join('')}
                    </div>
                </div>
            </div>

            <!-- Bottom Row -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <!-- Active Orders List -->
                <div class="card">
                    <div class="card-header">
                        <h3><i data-lucide="clock"></i> Active Orders</h3>
                        <span class="badge badge-warning">${activeList.length} orders</span>
                    </div>
                    <div class="card-body no-padding">
                        ${activeList.length === 0
                ? '<div class="empty-state"><p>No active orders</p></div>'
                : activeList.slice(0, 5).map(o => `
                            <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                                <div>
                                    <div style="font-weight:600;font-size:0.85rem">Table ${o.tableNumber} • ${o.customerName}</div>
                                    <div style="font-size:0.75rem;color:var(--text-muted)">${o.items.length} items</div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-weight:700;color:var(--primary)">${App.currency(o.total)}</div>
                                    <span class="badge ${this.statusBadge(o.status)}" style="font-size:0.68rem">${o.status}</span>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>

                <!-- Low Stock Items -->
                <div class="card">
                    <div class="card-header">
                        <h3><i data-lucide="alert-triangle"></i> Low Stock Alerts</h3>
                        <span class="badge badge-danger">${lowStockItems.length} items</span>
                    </div>
                    <div class="card-body no-padding">
                        ${lowStockItems.length === 0
                ? '<div class="empty-state"><p>All stock levels are fine! ✅</p></div>'
                : lowStockItems.slice(0, 5).map(i => `
                            <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                                <div>
                                    <div style="font-weight:600;font-size:0.85rem">${i.name}</div>
                                    <div style="font-size:0.75rem;color:var(--text-muted)">${i.category}</div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-weight:700;color:var(--danger)">${i.quantity} ${i.unit}</div>
                                    <div style="font-size:0.72rem;color:var(--text-muted)">Min: ${i.minStock}</div>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    statusBadge(status) {
        const map = {
            'Pending': 'badge-warning',
            'Preparing': 'badge-warning',
            'Ready': 'badge-success',
            'Delivered': 'badge-info',
            'Completed': 'badge-success',
            'Cancelled': 'badge-danger',
        };
        return map[status] || 'badge-secondary';
    },
};
