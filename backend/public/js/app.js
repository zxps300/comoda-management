/* ============================================================
   Comoda Restaurant Management System — Main App Controller
   SPA router, sidebar management, global utilities
   ============================================================ */

const App = {
    currentPage: 'dashboard',

    init() {
        DataStore.seed(); // no-op for API mode

        if (Auth.init()) {
            this.showApp();
        } else {
            this.showWelcome();
        }

        this.bindEvents();
        this.startClock();
    },

    // ─── Welcome / Login / Logout ───────────────────────
    showWelcome() {
        document.getElementById('welcomeOverlay').classList.remove('hidden');
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('active');
    },

    showLoginFromWelcome() {
        document.getElementById('welcomeOverlay').classList.add('hidden');
        document.getElementById('loginOverlay').classList.remove('hidden');
    },

    showLogin() {
        const welcomeOverlay = document.getElementById('welcomeOverlay');
        if (welcomeOverlay) welcomeOverlay.classList.add('hidden');
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
    },

    showApp() {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        this.buildSidebar();
        this.navigate('dashboard');
        this.updateUserPanel();
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const errorEl = document.getElementById('loginError');

        if (!username || !password) {
            errorEl.textContent = 'Please enter both username and password';
            errorEl.classList.add('show');
            return;
        }

        const result = await Auth.login(username, password);
        if (result.success) {
            errorEl.classList.remove('show');
            document.getElementById('loginForm').reset();
            this.showApp();
            App.toast('Welcome back, ' + result.user.fullName + '!', 'success');
        } else {
            errorEl.textContent = result.message;
            errorEl.classList.add('show');
        }
    },

    async handleLogout() {
        await Auth.logout();
        this.showLogin();
    },

    // ─── Sidebar ────────────────────────────────────────
    buildSidebar() {
        const nav = document.getElementById('sidebarNav');
        const pages = Auth.getAccessiblePages();

        const pageConfig = {
            dashboard: { icon: 'layout-dashboard', label: 'Dashboard', section: 'Main' },
            users: { icon: 'users', label: 'User Management', section: 'Main' },
            inventory: { icon: 'package', label: 'Inventory', section: 'Operations' },
            orders: { icon: 'shopping-cart', label: 'POS', section: 'Operations' },
            kitchen: { icon: 'chef-hat', label: 'Kitchen', section: 'Operations' },
            billing: { icon: 'receipt', label: 'Billing', section: 'Operations' },
            sales: { icon: 'trending-up', label: 'Sales Records', section: 'Finance' },
            reports: { icon: 'bar-chart-3', label: 'Reports', section: 'Finance' }
        };

        const sections = {};
        pages.forEach(p => {
            const cfg = pageConfig[p];
            if (!cfg) return;
            if (!sections[cfg.section]) sections[cfg.section] = [];
            sections[cfg.section].push({ page: p, ...cfg });
        });

        let html = '';
        Object.entries(sections).forEach(([section, items]) => {
            html += `<div class="nav-section">
                <div class="nav-section-title">${section}</div>`;
            items.forEach(item => {
                html += `<div class="nav-item" data-page="${item.page}">
                    <i data-lucide="${item.icon}"></i>
                    <span>${item.label}</span>
                </div>`;
            });
            html += '</div>';
        });

        nav.innerHTML = html;
        lucide.createIcons();

        nav.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', () => this.navigate(el.dataset.page));
        });
    },

    updateUserPanel() {
        const user = Auth.getUser();
        if (!user) return;
        const initials = user.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('userAvatar').textContent = initials;
        document.getElementById('userName').textContent = user.fullName;
        document.getElementById('userRole').textContent = user.role;
    },

    // ─── Navigation ─────────────────────────────────────
    navigate(page) {
        if (!Auth.canAccess(page)) {
            this.toast('Access denied for this page', 'error');
            return;
        }

        this.currentPage = page;

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // Show page
        document.querySelectorAll('.page').forEach(el => {
            el.classList.toggle('active', el.id === `page-${page}`);
        });

        // Update topbar
        const titles = {
            dashboard: { title: 'Dashboard', sub: 'Overview of your restaurant operations' },
            users: { title: 'User Management', sub: 'Manage staff accounts and access' },
            inventory: { title: 'Inventory Management', sub: 'Track ingredients and supplies' },
            orders: { title: 'Point of Sale', sub: 'Comoda Restaurant System' },
            kitchen: { title: 'Kitchen Display System', sub: 'Comoda Restaurant System' },
            billing: { title: 'Billing & Receipts', sub: 'Process payments and generate receipts' },
            sales: { title: 'Sales Records', sub: 'View completed transactions' },
            reports: { title: 'Reports', sub: 'Sales and inventory analytics' }
        };

        const t = titles[page] || { title: page, sub: '' };
        document.getElementById('topbarTitle').textContent = t.title;
        document.getElementById('topbarSub').textContent = t.sub;

        // Refresh page content
        this.refreshPage(page);
    },

    refreshPage(page) {
        switch (page) {
            case 'dashboard': Dashboard.render(); break;
            case 'users': Users.render(); break;
            case 'inventory': Inventory.render(); break;
            case 'orders': Orders.render(); break;
            case 'kitchen': Kitchen.render(); break;
            case 'billing': Billing.render(); break;
            case 'sales': Sales.render(); break;
            case 'reports': Reports.render(); break;
        }
    },

    // ─── Events ─────────────────────────────────────────
    bindEvents() {
        const btnGetStarted = document.getElementById('btnGetStarted');
        if (btnGetStarted) btnGetStarted.addEventListener('click', () => this.showLoginFromWelcome());

        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('btnLogout').addEventListener('click', () => this.handleLogout());
    },

    // ─── Clock ──────────────────────────────────────────
    startClock() {
        const update = () => {
            const now = new Date();
            const dateEl = document.getElementById('topbarDate');
            const timeEl = document.getElementById('topbarTime');
            if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
        update();
        setInterval(update, 1000);
    },

    // ─── Toast ──────────────────────────────────────────
    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i> ${message}`;
        container.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 3000);
    },

    // ─── Modal Helpers ──────────────────────────────────
    openModal(id) {
        document.getElementById(id).classList.add('active');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    },

    // ─── Currency Format ────────────────────────────────
    currency(amount) {
        return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // Refresh sidebar badges
    refreshSidebar() {
        this.buildSidebar();
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
