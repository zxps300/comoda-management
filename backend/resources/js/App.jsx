import { useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { ToastContext } from './contexts/ToastContext'
import { useToast } from './hooks/useToast'
import Toast from './components/ui/Toast'
import AppRouter from './router'

function AppShell() {
  const { toasts, toast } = useToast()

  // Sidebar badges — updated by any page that wants to show counts
  const [badges] = useState({})

  return (
    <ToastContext.Provider value={toast}>
      <AppRouter badges={badges} />
      <Toast toasts={toasts} />
    </ToastContext.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
