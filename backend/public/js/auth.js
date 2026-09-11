/* ============================================================
   Comoda Restaurant Management System — Authentication
   API-based login/logout, session management, role-based access
   ============================================================ */

const Auth = {
    currentUser: null,

    init() {
        const session = sessionStorage.getItem('comoda_session');
        const token = sessionStorage.getItem('comoda_token');
        if (session && token) {
            this.currentUser = JSON.parse(session);
            return true;
        }
        return false;
    },

    async login(username, password) {
        try {
            const res = await DataStore.request('POST', '/auth/login', { username, password });
            if (res && res.success) {
                this.currentUser = res.user;
                sessionStorage.setItem('comoda_session', JSON.stringify(res.user));
                sessionStorage.setItem('comoda_token', res.token);
                return { success: true, user: res.user };
            }
            return { success: false, message: 'Invalid username or password' };
        } catch (e) {
            return { success: false, message: e.message || 'Login failed' };
        }
    },

    async logout() {
        try {
            await DataStore.request('POST', '/auth/logout');
        } catch (e) { /* ignore */ }
        this.currentUser = null;
        sessionStorage.removeItem('comoda_session');
        sessionStorage.removeItem('comoda_token');
    },

    getUser() {
        return this.currentUser;
    },

    getRole() {
        return this.currentUser ? this.currentUser.role : null;
    },

    // Role access matrix
    roleAccess: {
        'Admin': ['dashboard', 'users', 'inventory', 'orders', 'kitchen', 'billing', 'sales', 'reports'],
        'Cashier': ['dashboard', 'orders', 'billing', 'sales'],
        'Purchaser': ['dashboard', 'inventory'],
        'Kitchen Staff': ['dashboard', 'orders', 'kitchen'],
        'Waiter': ['dashboard', 'orders', 'kitchen']
    },

    canAccess(page) {
        if (!this.currentUser) return false;
        const allowed = this.roleAccess[this.currentUser.role] || [];
        return allowed.includes(page);
    },

    getAccessiblePages() {
        if (!this.currentUser) return [];
        return this.roleAccess[this.currentUser.role] || [];
    }
};
