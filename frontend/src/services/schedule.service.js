import api from './api'

export const scheduleService = {
    getAll: (userId = null) => {
        const params = userId ? `?user_id=${userId}` : ''
        return api.get(`/schedules${params}`).then(r => r.data)
    },
    create: (data) => api.post('/schedules', data).then(r => r.data),
    update: (id, data) => api.put(`/schedules/${id}`, data).then(r => r.data),
    delete: (id) => api.delete(`/schedules/${id}`).then(r => r.data),
}
