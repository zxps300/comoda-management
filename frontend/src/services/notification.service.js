import api from './api'

export const notificationService = {
    getAll: () => api.get('/notifications').then(r => r.data),
    markRead: key => api.post('/notifications/read', { key }).then(r => r.data),
    announce: data => api.post('/notifications/announcements', data).then(r => r.data),
}
