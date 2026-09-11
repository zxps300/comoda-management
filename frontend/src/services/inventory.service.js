import api from './api'

export const inventoryService = {
    getAll: () => api.get('/inventory').then((r) => r.data),
    create: (data) => {
        if (data instanceof FormData) {
            return api.post('/inventory', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            }).then((r) => r.data)
        }
        return api.post('/inventory', data).then((r) => r.data)
    },
    update: (id, data) => api.put(`/inventory/${id}`, data).then((r) => r.data),
    delete: (id) => api.delete(`/inventory/${id}`).then((r) => r.data),
    stockAdjust: (data) => {
        if (data instanceof FormData) {
            return api.post('/inventory/stock', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            }).then((r) => r.data)
        }
        return api.post('/inventory/stock', data).then((r) => r.data)
    },
    getLogs: () => api.get('/inventory/logs').then((r) => r.data),
    getBatches: (id) => api.get(`/inventory/${id}/batches`).then((r) => r.data),
    deleteBatch: (id) => api.delete(`/inventory/batches/${id}`).then((r) => r.data),
    expireBatch: (id, reason) => api.post(`/inventory/batches/${id}/expire`, { reason }).then((r) => r.data),
    disposeBatch: (id, reason) => api.post(`/inventory/batches/${id}/dispose`, { reason }).then((r) => r.data),
}
