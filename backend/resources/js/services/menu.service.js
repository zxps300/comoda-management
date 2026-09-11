import api from './api'

export const menuService = {
    getAll: () => api.get('/menu-items').then((r) => r.data),
    create: (data) => api.post('/menu-items', data).then((r) => r.data),
    update: (id, data) => api.put(`/menu-items/${id}`, data).then((r) => r.data),
    delete: (id) => api.delete(`/menu-items/${id}`).then((r) => r.data),
}
