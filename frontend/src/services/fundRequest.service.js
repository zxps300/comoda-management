import api from './api'

export const fundRequestService = {
    getAll: (status = 'all') => api.get(`/fund-requests?status=${status}`).then((r) => r.data),
    create: (data) => api.post('/fund-requests', data).then((r) => r.data),
    release: (id, data) => api.post(`/fund-requests/${id}/release`, data).then((r) => r.data),
    liquidate: (id, data) => {
        if (data instanceof FormData) {
            return api.post(`/fund-requests/${id}/liquidate`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            }).then((r) => r.data)
        }
        return api.post(`/fund-requests/${id}/liquidate`, data).then((r) => r.data)
    },
    complete: (id) => api.post(`/fund-requests/${id}/complete`).then((r) => r.data),
    managerApprove: (id, action) => api.post(`/fund-requests/${id}/manager-approve`, { action }).then((r) => r.data),
}
