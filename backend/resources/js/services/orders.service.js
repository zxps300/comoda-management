import api from './api'

export const ordersService = {
    getAll: (params = {}) =>
        api.get('/orders', { params }).then((r) => r.data),
    getOne: (id) => api.get(`/orders/${id}`).then((r) => r.data),
    create: (data) => api.post('/orders', data).then((r) => r.data),
    updateStatus: (id, status) =>
        api.put(`/orders/${id}`, { status }).then((r) => r.data),
    delete: (id) => api.delete(`/orders/${id}`).then((r) => r.data),
}
