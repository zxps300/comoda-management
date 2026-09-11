/* ============================================================
   Comoda Restaurant Management System — User Management
   Figma-style staff card layout with colored avatars
   ============================================================ */

const Users = {
    editingId: null,

    async render() {
        const container = document.getElementById('page-users');
        let users;
        try { users = await DataStore.getAll('users'); } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load users</p></div>';
            return;
        }

        const avatarColors = ['#F97316', '#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6', '#EF4444', '#3B82F6', '#06B6D4'];
        const getColor = (name) => {
            let h = 0;
            for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
            return avatarColors[Math.abs(h) % avatarColors.length];
        };
        const roleColors = {
            'Admin': { bg: '#FEF3C7', text: '#D97706' },
            'Cashier': { bg: '#DBEAFE', text: '#2563EB' },
            'Waiter': { bg: '#F3E8FF', text: '#7C3AED' },
            'Kitchen Staff': { bg: '#D1FAE5', text: '#059669' },
            'Purchaser': { bg: '#FEE2E2', text: '#DC2626' },
        };

        container.innerHTML = `
            <div class="staff-header">
                <div class="staff-header-left">
                    <div class="staff-header-icon"><i data-lucide="users-round"></i></div>
                    <div>
                        <h2>Staff Management</h2>
                        <p>Manage team accounts and role access</p>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="Users.openAdd()">
                    <i data-lucide="user-plus"></i> Add Team Member
                </button>
            </div>

            <div class="staff-grid">
                ${users.map(u => {
            const initials = u.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const color = getColor(u.fullName);
            const rc = roleColors[u.role] || { bg: '#F1F5F9', text: '#64748B' };
            const email = u.email || u.username + '@comoda.com';
            return `
                    <div class="staff-card">
                        <div class="staff-card-actions">
                            <button class="staff-action-btn" onclick="Users.openEdit(${u.id})" title="Edit">
                                <i data-lucide="pencil"></i>
                            </button>
                            ${u.id !== 1 ? `
                            <button class="staff-action-btn danger" onclick="Users.delete(${u.id})" title="Delete">
                                <i data-lucide="trash-2"></i>
                            </button>` : ''}
                        </div>

                        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
                            <div class="staff-avatar" style="background:${color};font-size:1.1rem">${initials}</div>
                            <div>
                                <div class="staff-name">${u.fullName}</div>
                                <span style="font-size:0.72rem;font-weight:600;padding:2px 10px;border-radius:99px;background:${rc.bg};color:${rc.text}">${u.role}</span>
                            </div>
                        </div>

                        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
                            <div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-secondary)">
                                <i data-lucide="mail" style="width:14px;height:14px;color:var(--primary);flex-shrink:0"></i>
                                ${email}
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-secondary)">
                                <i data-lucide="user" style="width:14px;height:14px;color:var(--primary);flex-shrink:0"></i>
                                @${u.username}
                            </div>
                        </div>

                        <div class="staff-card-btns">
                            <button class="btn btn-edit btn-sm" onclick="Users.openEdit(${u.id})" style="flex:1;justify-content:center">
                                <i data-lucide="pencil"></i> Edit
                            </button>
                            ${u.id !== 1 ? `
                            <button class="btn-delete" onclick="Users.delete(${u.id})">
                                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                            </button>` : `<span style="width:36px"></span>`}
                        </div>
                    </div>`;
        }).join('')}
            </div>
        `;
        lucide.createIcons();
    },

    openAdd() {
        this.editingId = null;
        document.getElementById('userModalTitle').textContent = 'Add Team Member';
        document.getElementById('userForm').reset();
        document.getElementById('userPasswordGroup').style.display = 'block';
        App.openModal('userModal');
    },

    async openEdit(id) {
        let user;
        try { user = await DataStore.getById('users', id); } catch (e) { return; }
        if (!user) return;
        this.editingId = id;
        document.getElementById('userModalTitle').textContent = 'Edit Team Member';
        document.getElementById('userFullName').value = user.fullName;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userPassword').value = '';
        document.getElementById('userRole').value = user.role;
        const emailEl = document.getElementById('userEmail');
        if (emailEl) emailEl.value = user.email || '';
        document.getElementById('userPasswordGroup').style.display = 'block';
        App.openModal('userModal');
    },

    async save() {
        const fullName = document.getElementById('userFullName').value.trim();
        const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value.trim();
        const role = document.getElementById('userRole').value;
        const emailEl = document.getElementById('userEmail');
        const email = emailEl ? emailEl.value.trim() : '';

        if (!fullName || !username || !role) {
            App.toast('Please fill in all required fields', 'error');
            return;
        }
        try {
            if (this.editingId) {
                const updates = { fullName, username, role, email };
                if (password) updates.password = password;
                await DataStore.update('users', this.editingId, updates);
                App.toast('Team member updated!', 'success');
            } else {
                if (!password) { App.toast('Password is required', 'error'); return; }
                await DataStore.add('users', { fullName, username, password, role, email });
                App.toast('Team member added!', 'success');
            }
        } catch (e) { App.toast('Error: ' + e.message, 'error'); return; }
        App.closeModal('userModal');
        this.render();
    },

    async delete(id) {
        if (!confirm('Remove this team member?')) return;
        try {
            await DataStore.remove('users', id);
            App.toast('Team member removed', 'warning');
            this.render();
        } catch (e) { App.toast('Error: ' + e.message, 'error'); }
    }
};
