import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { settingsService } from '../services/settings.service'
import { useAuth } from './AuthContext'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
    const { token } = useAuth()
    const [settings, setSettings] = useState({})
    const [loading, setLoading] = useState(true)

    const fetchSettings = useCallback(async () => {
        if (!token) return
        try {
            const data = await settingsService.getAll()
            // Flat map settings for easy access, e.g. settings.tax_rate
            const flat = {}
            Object.values(data).forEach(group => {
                Object.assign(flat, group)
            })
            setSettings(flat)
        } catch (error) {
            console.error('Failed to fetch settings', error)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const getSetting = (key, fallback = null) => {
        return settings[key] !== undefined ? settings[key] : fallback
    }

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, getSetting }}>
            {children}
        </SettingsContext.Provider>
    )
}

export const useSettings = () => {
    const ctx = useContext(SettingsContext)
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
    return ctx
}
