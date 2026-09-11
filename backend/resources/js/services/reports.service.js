import api from './api'

export const reportsService = {
    daily: (date) => api.get('/reports/daily', { params: { date } }).then((r) => r.data),
    monthly: (month) => api.get('/reports/monthly', { params: { month } }).then((r) => r.data),
    inventory: () => api.get('/reports/inventory').then((r) => r.data),
}
