import api from './api'

export const usersService = {
    getAll: () => api.get('/users').then((r) => r.data),
    create: (data) => api.post('/users', data).then((r) => r.data),
    update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
    delete: (id) => api.delete(`/users/${id}`).then((r) => r.data),
}
