import api from './api'

export const salesService = {
    getAll:    ()     => api.get('/sales').then((r) => r.data),
    getOne:    (id)   => api.get(`/sales/${id}`).then((r) => r.data),
    create:    (data) => api.post('/sales', data).then((r) => r.data),
    delete:    (id)   => api.delete(`/sales/${id}`).then((r) => r.data),
    deleteAll: ()     => api.delete('/sales/delete-all').then((r) => r.data),
}

export const removedItemsService = {
    logRemoval: (data) => api.post('/removed-items', data).then((r) => r.data),
    getAll:     ()     => api.get('/removed-items').then((r) => r.data),
}
