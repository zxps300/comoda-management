import api from './api'

export const attendanceService = {
    getAll: (params = {}) => api.get('/attendance', { params }).then(r => r.data),
    getSummary: (params) => api.get('/attendance/summary', { params }).then(r => r.data),
    create: (data) => api.post('/attendance', data).then(r => r.data),
    update: (id, data) => api.put(`/attendance/${id}`, data).then(r => r.data),
    delete: (id) => api.delete(`/attendance/${id}`).then(r => r.data),
}
