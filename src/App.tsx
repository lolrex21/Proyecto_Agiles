import { useEffect, useState } from 'react'
import {
  isAuthenticated,
  getCurrentUser,
  logout,
  syncGoogleSession,
} from './services/authService'

import LoginForm from './components/Student/LoginForm'
import IncidentReportForm from './components/Student/IncidentReportForm'
import GuardDashboard from './components/Guard/GuardDashboard'

import TrustGroupForm from './components/TrustGroupForm'
import TrustGroupList from './components/TrustGroupList'
import NotificationBell from './components/NotificationBell'

type MainTab = 'reportar' | 'grupos'

import TrustGroupForm from './components/TrustGroupForm'
import TrustGroupList from './components/TrustGroupList'
import NotificationBell from './components/NotificationBell'

type MainTab = 'reportar' | 'grupos'

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeTab, setActiveTab] = useState<MainTab>('reportar')
  const [refreshTrustGroups, setRefreshTrustGroups] = useState(0)
  const [sessionMessage, setSessionMessage] = useState('')

  const user = getCurrentUser()

  useEffect(() => {
    const checkSession = async () => {
      if (isAuthenticated()) {
        setCheckingSession(false)
        return
      }

      const result = await syncGoogleSession()

      if (result.success) {
        setAuthenticated(true)
      } else {
        setSessionMessage(result.message)
      }

      setCheckingSession(false)
    }

    checkSession()
  }, [])

  const handleLogin = () => {
    setSessionMessage('')
    setAuthenticated(true)
  }

  const handleLogout = async () => {
    await logout()
    setAuthenticated(false)
    setActiveTab('reportar')
  }

  const handleGroupCreated = () => {
    setRefreshTrustGroups(prev => prev + 1)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="rounded-2xl bg-white px-6 py-5 shadow-lg text-center">
          <p className="text-sm font-semibold text-uta-navy">
            Ingresando a tu cuenta...
          </p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <LoginForm onLogin={handleLogin} initialMessage={sessionMessage} />
  }

  if (user?.rol === 'guardia') {
    return <GuardDashboard />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-uta-navy text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">UTA Security</h1>
            <p className="text-sm text-white/80">
              Sistema de acceso seguro y reporte de incidentes
            </p>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <NotificationBell
                userId={user.id}
                userRole={user.rol || 'usuario'}
              />
            )}

            <div className="text-right">
              <p className="font-semibold">{user?.nombre}</p>
              <p className="text-xs text-white/70">{user?.correo}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('reportar')}
            className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
              activeTab === 'reportar'
                ? 'bg-uta-red text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Reportar emergencia
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grupos')}
            className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
              activeTab === 'grupos'
                ? 'bg-uta-red text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Grupos de confianza
          </button>
        </div>

        {activeTab === 'reportar' && <IncidentReportForm />}

        {activeTab === 'grupos' && user && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <TrustGroupForm
              ownerId={user.id}
              onGroupCreated={handleGroupCreated}
            />

            <TrustGroupList
              userId={user.id}
              refreshKey={refreshTrustGroups}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App