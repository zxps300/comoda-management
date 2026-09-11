/* ============================================================
   Comoda Restaurant Management System — Data Layer
   API-backed persistence with fetch helpers
   ============================================================ */

const DataStore = {
    baseUrl: '/api',

    _getToken() {
        return sessionStorage.getItem('comoda_token');
    },

    async request(method, endpoint, body = null) {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
        const token = this._getToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        const options = { method, headers };
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(this.baseUrl + endpoint, options);
        if (res.status === 401) {
            // Only force re-login if a token was already stored (session expired)
            // Don't reload if this IS the login request (no token yet)
            if (this._getToken()) {
                sessionStorage.removeItem('comoda_token');
                sessionStorage.removeItem('comoda_session');
                location.reload();
                return null;
            }
            // For login failures, throw so the caller can show the error
            const err = await res.json().catch(() => ({ message: 'Invalid username or password' }));
            throw new Error(err.message || 'Invalid username or password');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(err.message || 'Request failed');
        }
        if (res.status === 204) return null;
        return res.json();
    },

    // ─── Collection → endpoint mapping ────────────────────
    _endpoint(collection) {
        const map = {
            'users': '/users',
            'menuItems': '/menu-items',
            'inventory': '/inventory',
            'orders': '/orders',
            'sales': '/sales',
            'stockLogs': '/stock-logs',
        };
        return map[collection] || '/' + collection;
    },

    // ─── CRUD (async, returns data) ──────────────────────
    async getAll(collection) {
        return await this.request('GET', this._endpoint(collection));
    },

    async getById(collection, id) {
        return await this.request('GET', this._endpoint(collection) + '/' + id);
    },

    async add(collection, item) {
        return await this.request('POST', this._endpoint(collection), item);
    },

    async update(collection, id, updates) {
        return await this.request('PUT', this._endpoint(collection) + '/' + id, updates);
    },

    async remove(collection, id) {
        return await this.request('DELETE', this._endpoint(collection) + '/' + id);
    },

    async query(collection, params) {
        let qs = '';
        if (typeof params === 'object' && params !== null) {
            qs = '?' + new URLSearchParams(params).toString();
        }
        return await this.request('GET', this._endpoint(collection) + qs);
    },

    async count(collection, predicate) {
        // Count locally after fetching — used by sidebar badges
        const data = await this.getAll(collection);
        if (!predicate) return data.length;
        return data.filter(predicate).length;
    },

    // ─── Seed / Reset (no-ops for API mode) ─────────────
    seed() { /* seeding is done via php artisan db:seed */ },
    reset() { /* use php artisan migrate:fresh --seed */ },

    _generateId() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
};
