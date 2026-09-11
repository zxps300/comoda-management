import api from './api'

export const expensesService = {
    getAll: async () => {
        const res = await api.get('/expenses')
        return res.data
    },

    create: async (expenseData) => {
        const res = await api.post('/expenses', expenseData)
        return res.data
    },

    update: async (id, expenseData) => {
        const res = await api.put(`/expenses/${id}`, expenseData)
        return res.data
    },

    delete: async (id) => {
        const res = await api.delete(`/expenses/${id}`)
        return res.data
    }
}
