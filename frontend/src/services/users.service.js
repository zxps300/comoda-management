import api from './api'

export const usersService = {
    getAll: () => api.get('/users').then((r) => r.data),
    getArchived: () => api.get('/users/archived').then((r) => r.data),
    create: (data) => api.post('/users', data).then((r) => r.data),
    update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
    archive: (id) => api.delete(`/users/${id}`).then((r) => r.data),
    restore: (id) => api.post(`/users/${id}/restore`).then((r) => r.data),
    forceDelete: (id) => api.delete(`/users/${id}/force`).then((r) => r.data),
}
