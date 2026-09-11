/* ============================================================
   Comoda Restaurant Management System — POS / Orders
   Figma-style order card grid layout
   ============================================================ */

const Orders = {
    cart: [],
    menuItems: [],
    activeFilter: 'All',

    async render() {
        const container = document.getElementById('page-orders');
        container.innerHTML = `<div class="empty-state"><p>Loading menu…</p></div>`;

        try {
            this.menuItems = await DataStore.getAll('menuItems');
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><p>Failed to load menu items.</p></div>`;
            return;
        }

        const categories = ['All', ...new Set(this.menuItems.map(i => i.category))];
        const available = this.activeFilter === 'All'
            ? this.menuItems
            : this.menuItems.filter(i => i.category === this.activeFilter);

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;height:calc(100vh - 120px)">
                <!-- Left: Menu -->
                <div style="overflow-y:auto">
                    <!-- Category Filter Pills -->
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
                        ${categories.map(cat => `
                            <button onclick="Orders.filterCategory('${cat}')" class="btn ${this.activeFilter === cat ? 'btn-primary' : 'btn-secondary'} btn-sm">
                                ${cat}
                            </button>`).join('')}
                    </div>

                    <!-- Menu Grid -->
                    ${available.length === 0
                ? `<div class="empty-state">
                            <i data-lucide="utensils"></i>
                            <p>No menu items yet.<br>Add items in Menu Management.</p>
                           </div>`
                : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px">
                            ${available.filter(i => i.available !== false).map(item => `
                                <div class="menu-item-card" onclick="Orders.addToCart(${item.id})" style="
                                    background:var(--surface);border:1.5px solid var(--border);
                                    border-radius:var(--radius);overflow:hidden;cursor:pointer;
                                    transition:all 0.2s ease;box-shadow:var(--shadow-sm)
                                " onmouseenter="this.style.borderColor='var(--primary)';this.style.transform='translateY(-3px)';this.style.boxShadow='var(--shadow)'"
                                   onmouseleave="this.style.borderColor='var(--border)';this.style.transform='none';this.style.boxShadow='var(--shadow-sm)'">
                                    <div style="height:100px;background:#F8FAFC;overflow:hidden;position:relative">
                                        ${item.image
                        ? `<img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover">`
                        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem">🍽️</div>`}
                                        <span style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:99px">${App.currency(item.price)}</span>
                                    </div>
                                    <div style="padding:10px">
                                        <div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:3px">${item.name}</div>
                                        <span style="font-size:0.68rem;background:var(--primary-100);color:var(--primary-dark);padding:2px 8px;border-radius:99px;font-weight:600">${item.category}</span>
                                    </div>
                                </div>`).join('')}
                           </div>`}
                </div>

                <!-- Right: Cart -->
                <div style="background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;flex-direction:column;overflow:hidden">
                    <!-- Cart Header -->
                    <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
                        <h3 style="font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px">
                            <i data-lucide="shopping-cart" style="color:var(--primary)"></i>
                            Order Cart
                        </h3>
                        ${this.cart.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="Orders.clearCart()">Clear</button>` : ''}
                    </div>

                    <!-- Cart Items -->
                    <div style="flex:1;overflow-y:auto;padding:12px">
                        ${this.cart.length === 0
                ? `<div class="empty-state" style="padding:32px 16px">
                                <i data-lucide="shopping-cart" style="width:36px;height:36px;opacity:0.25;margin-bottom:8px"></i>
                                <p>Tap items to add to cart</p>
                               </div>`
                : this.cart.map(item => `
                                <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
                                    <div style="flex:1">
                                        <div style="font-size:0.85rem;font-weight:600">${item.name}</div>
                                        <div style="font-size:0.78rem;color:var(--primary)">${App.currency(item.price)}</div>
                                    </div>
                                    <div style="display:flex;align-items:center;gap:8px">
                                        <button onclick="Orders.changeQty(${item.id}, -1)" style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:var(--text-secondary);transition:all 0.15s" onmouseenter="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">−</button>
                                        <span style="font-weight:700;min-width:20px;text-align:center">${item.qty}</span>
                                        <button onclick="Orders.changeQty(${item.id}, 1)" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--primary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:#fff;transition:all 0.15s">+</button>
                                    </div>
                                    <span style="font-size:0.85rem;font-weight:700;min-width:60px;text-align:right;color:var(--text)">${App.currency(item.price * item.qty)}</span>
                                </div>`).join('')}
                    </div>

                    <!-- Cart Footer -->
                    <div style="border-top:1px solid var(--border);padding:16px 18px">
                        ${this.cart.length > 0 ? `
                        <div style="margin-bottom:12px">
                            ${[
                    ['Subtotal', this.calcSubtotal()],
                    ['Tax (5%)', this.calcTax()],
                ].map(([l, v]) => `
                                <div style="display:flex;justify-content:space-between;font-size:0.83rem;padding:3px 0">
                                    <span style="color:var(--text-secondary)">${l}</span>
                                    <span style="font-weight:600">${App.currency(v)}</span>
                                </div>`).join('')}
                            <div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:800;color:var(--primary);padding-top:8px;border-top:2px solid var(--border);margin-top:8px">
                                <span>Total</span>
                                <span>${App.currency(this.calcTotal())}</span>
                            </div>
                        </div>` : ''}

                        <div style="display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;gap:8px">
                                <select id="tableSelect" class="form-control" style="flex:1">
                                    ${Array.from({ length: 20 }).map((_, i) => `<option value="${i + 1}">Table ${i + 1}</option>`).join('')}
                                </select>
                            </div>
                            <button class="btn btn-primary btn-block ${this.cart.length === 0 ? '' : ''}"
                                onclick="Orders.submitOrder()"
                                ${this.cart.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                                <i data-lucide="send"></i> Place Order
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    calcSubtotal() { return this.cart.reduce((s, i) => s + i.price * i.qty, 0); },
    calcTax() { return this.calcSubtotal() * 0.05; },
    calcTotal() { return this.calcSubtotal() + this.calcTax(); },

    filterCategory(cat) { this.activeFilter = cat; this.render(); },

    addToCart(id) {
        const item = this.menuItems.find(i => i.id === id);
        if (!item) return;
        const existing = this.cart.find(i => i.id === id);
        if (existing) { existing.qty++; }
        else { this.cart.push({ id: item.id, name: item.name, price: Number(item.price), qty: 1 }); }
        this.render();
    },

    changeQty(id, delta) {
        const idx = this.cart.findIndex(i => i.id === id);
        if (idx === -1) return;
        this.cart[idx].qty += delta;
        if (this.cart[idx].qty <= 0) this.cart.splice(idx, 1);
        this.render();
    },

    clearCart() { this.cart = []; this.render(); },

    async submitOrder() {
        if (this.cart.length === 0) return;
        const tableNumber = parseInt(document.getElementById('tableSelect').value) || 1;
        const subtotal = this.calcSubtotal();
        const tax = this.calcTax();
        const total = this.calcTotal();
        try {
            await DataStore.add('orders', {
                tableNumber,
                customerName: `Table ${tableNumber}`,
                items: this.cart.map(i => ({
                    menuItemId: i.id, name: i.name, price: i.price, quantity: i.qty
                })),
                subtotal, tax, total,
            });
            App.toast(`Order for Table ${tableNumber} placed!`, 'success');
            this.cart = [];
            this.render();
        } catch (e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },
};
