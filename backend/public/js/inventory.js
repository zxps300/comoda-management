/* ============================================================
   Comoda Restaurant Management System — Inventory Management
   Item CRUD, stock in/out, low-stock alerts (API-backed)
   ============================================================ */

const Inventory = {
    editingId: null,
    currentCategory: 'All',
    searchQuery: '',

    async render() {
        const container = document.getElementById('page-inventory');
        let items;
        try {
            items = await DataStore.getAll('inventory');
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load inventory</p></div>';
            return;
        }
        const lowStockItems = items.filter(i => i.quantity <= i.min_stock);

        const categories = ['All', ...new Set(items.map(i => i.category))];

        // Filter
        let filtered = items;
        if (this.currentCategory !== 'All') {
            filtered = filtered.filter(i => i.category === this.currentCategory);
        }
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        }

        container.innerHTML = `
            ${lowStockItems.length > 0 ? `
            <div class="low-stock-banner">
                <div class="alert-icon"><i data-lucide="alert-triangle"></i></div>
                <div class="alert-text">
                    <h4>${lowStockItems.length} Item(s) Need Restocking</h4>
                    <p>${lowStockItems.map(i => i.name).join(', ')}</p>
                </div>
            </div>` : ''}

            <div class="card">
                <div class="card-header">
                    <h3><i data-lucide="package"></i> Inventory Items</h3>
                    <div class="toolbar">
                        <div class="search-box">
                            <i data-lucide="search"></i>
                            <input type="text" class="form-control" placeholder="Search items..." value="${this.searchQuery}" oninput="Inventory.search(this.value)">
                        </div>
                        <button class="btn btn-primary" onclick="Inventory.openAdd()">
                            <i data-lucide="plus"></i> Add Item
                        </button>
                        <button class="btn btn-success" onclick="Inventory.openStockModal('in')">
                            <i data-lucide="package-plus"></i> Stock In
                        </button>
                        <button class="btn btn-secondary" onclick="Inventory.openStockModal('out')">
                            <i data-lucide="package-minus"></i> Stock Out
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="category-tabs">
                        ${categories.map(c => `
                            <div class="category-tab ${c === this.currentCategory ? 'active' : ''}" onclick="Inventory.filterCategory('${c}')">${c}</div>
                        `).join('')}
                    </div>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Category</th>
                                    <th>Unit</th>
                                    <th>Quantity</th>
                                    <th>Min Stock</th>
                                    <th>Status</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><p>No items found</p></div></td></tr>` :
                filtered.map(i => `
                                    <tr>
                                        <td><strong>${i.name}</strong></td>
                                        <td><span class="badge badge-neutral">${i.category}</span></td>
                                        <td>${i.unit}</td>
                                        <td class="${i.quantity <= i.min_stock ? 'text-danger fw-700' : ''}">${i.quantity}</td>
                                        <td>${i.min_stock}</td>
                                        <td>${i.quantity === 0
                        ? '<span class="badge badge-danger">Out of Stock</span>'
                        : i.quantity <= i.min_stock
                            ? '<span class="badge badge-warning">Low Stock</span>'
                            : '<span class="badge badge-success">In Stock</span>'
                    }</td>
                                        <td class="text-right">
                                            <button class="btn btn-secondary btn-sm" onclick="Inventory.openEdit(${i.id})">
                                                <i data-lucide="pencil"></i>
                                            </button>
                                            <button class="btn btn-danger btn-sm" onclick="Inventory.delete(${i.id})">
                                                <i data-lucide="trash-2"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
    },

    filterCategory(cat) {
        this.currentCategory = cat;
        this.render();
    },

    search(query) {
        this.searchQuery = query;
        this.render();
    },

    openAdd() {
        this.editingId = null;
        document.getElementById('inventoryModalTitle').textContent = 'Add Inventory Item';
        document.getElementById('inventoryForm').reset();
        App.openModal('inventoryModal');
    },

    async openEdit(id) {
        let item;
        try {
            item = await DataStore.getById('inventory', id);
        } catch (e) { return; }
        if (!item) return;
        this.editingId = id;
        document.getElementById('inventoryModalTitle').textContent = 'Edit Inventory Item';
        document.getElementById('invName').value = item.name;
        document.getElementById('invCategory').value = item.category;
        document.getElementById('invUnit').value = item.unit;
        document.getElementById('invQuantity').value = item.quantity;
        document.getElementById('invMinStock').value = item.min_stock;
        App.openModal('inventoryModal');
    },

    async save() {
        const name = document.getElementById('invName').value.trim();
        const category = document.getElementById('invCategory').value.trim();
        const unit = document.getElementById('invUnit').value.trim();
        const quantity = parseInt(document.getElementById('invQuantity').value) || 0;
        const min_stock = parseInt(document.getElementById('invMinStock').value) || 0;

        if (!name || !category || !unit) {
            App.toast('Please fill in all required fields', 'error');
            return;
        }

        try {
            if (this.editingId) {
                await DataStore.update('inventory', this.editingId, { name, category, unit, quantity, min_stock });
                App.toast('Item updated successfully', 'success');
            } else {
                await DataStore.add('inventory', { name, category, unit, quantity, min_stock });
                App.toast('Item added successfully', 'success');
            }
        } catch (e) {
            App.toast('Error: ' + e.message, 'error');
            return;
        }

        App.closeModal('inventoryModal');
        this.render();
    },

    async delete(id) {
        if (!confirm('Are you sure you want to delete this inventory item?')) return;
        try {
            await DataStore.remove('inventory', id);
            App.toast('Item deleted', 'warning');
            this.render();
        } catch (e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    // ─── Stock In / Out ─────────────────────────────────
    async openStockModal(type) {
        let items;
        try {
            items = await DataStore.getAll('inventory');
        } catch (e) { return; }

        document.getElementById('stockModalTitle').textContent = type === 'in' ? 'Stock In — Add Inventory' : 'Stock Out — Deduct Inventory';
        document.getElementById('stockType').value = type;

        const select = document.getElementById('stockItem');
        select.innerHTML = '<option value="">Select item...</option>' +
            items.map(i => `<option value="${i.id}">${i.name} (Current: ${i.quantity} ${i.unit})</option>`).join('');
        document.getElementById('stockQuantity').value = '';
        document.getElementById('stockReason').value = '';
        App.openModal('stockModal');
    },

    async saveStock() {
        const type = document.getElementById('stockType').value;
        const itemId = document.getElementById('stockItem').value;
        const qty = parseInt(document.getElementById('stockQuantity').value) || 0;
        const reason = document.getElementById('stockReason').value.trim();

        if (!itemId || qty <= 0) {
            App.toast('Please select an item and enter a valid quantity', 'error');
            return;
        }

        try {
            const result = await DataStore.request('POST', '/inventory/stock', {
                item_id: parseInt(itemId),
                type,
                quantity: qty,
                reason,
                performed_by: Auth.getUser().fullName,
            });

            App.toast(result.message, 'success');

            if (result.item && result.item.quantity <= result.item.min_stock) {
                App.toast(`⚠️ ${result.item.name} is now low on stock (${result.item.quantity} ${result.item.unit})`, 'warning');
            }
        } catch (e) {
            App.toast('Error: ' + e.message, 'error');
            return;
        }

        App.closeModal('stockModal');
        this.render();
    }
};
