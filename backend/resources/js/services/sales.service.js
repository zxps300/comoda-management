import api from './api'

export const salesService = {
    getAll: () => api.get('/sales').then((r) => r.data),
    getOne: (id) => api.get(`/sales/${id}`).then((r) => r.data),
    create: (data) => api.post('/sales', data).then((r) => r.data),
}
