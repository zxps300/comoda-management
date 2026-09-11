import api from './api'

export const settingsService = {
    getAll: () => api.get('/settings').then((r) => r.data),
    bulkUpdate: (settings) => api.post('/settings/bulk', { settings }).then((r) => r.data),
}
