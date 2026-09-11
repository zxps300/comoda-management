import api from './api'

export const dashboardService = {
    get: () => api.get('/dashboard').then((r) => r.data),
}
