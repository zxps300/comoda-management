import api from './api'

export const authService = {
    login: (username, password) =>
        api.post('/auth/login', { username, password }).then((r) => r.data),

    logout: () => api.post('/auth/logout').then((r) => r.data),

    me: () => api.get('/auth/user').then((r) => r.data),
}
