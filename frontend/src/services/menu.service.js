import api from './api'

export const cacheMenuImages = (items = []) => {
    if (!('serviceWorker' in navigator)) return

    const urls = [...new Set(items.map((item) => item.image).filter(Boolean))]
    if (!urls.length) return

    navigator.serviceWorker.ready
        .then((registration) => registration.active?.postMessage({ type: 'CACHE_MENU_IMAGES', urls }))
        .catch(() => {})
}

export const menuService = {
    getAll: () => api.get('/menu-items').then((r) => {
        cacheMenuImages(r.data)
        return r.data
    }),
    create: (data) => {
        if (data instanceof FormData) {
            return api.post('/menu-items', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            }).then((r) => r.data)
        }
        return api.post('/menu-items', data).then((r) => r.data)
    },
    update: (id, data) => api.put(`/menu-items/${id}`, data).then((r) => r.data),
    delete: (id) => api.delete(`/menu-items/${id}`).then((r) => r.data),
    getPriceHistory: (params = {}) => api.get('/menu-price-history', { params }).then((r) => r.data),
    getRecipe: (id) => api.get(`/menu-items/${id}/recipe`).then((r) => r.data),
    updateRecipe: (id, ingredients) => api.put(`/menu-items/${id}/recipe`, { ingredients }).then((r) => r.data),
}
