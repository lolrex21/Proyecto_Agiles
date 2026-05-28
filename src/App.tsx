import { useState } from 'react'
import { isAuthenticated, getCurrentUser, logout } from './services/authService'

import LoginForm from './components/Student/LoginForm'
import IncidentReportForm from './components/Student/IncidentReportForm'
import GuardDashboard from './components/Guard/GuardDashboard'

import TrustGroupForm from './components/TrustGroupForm'
import TrustGroupList from './components/TrustGroupList'
import NotificationBell from './components/NotificationBell'

type MainTab = 'reportar' | 'grupos'

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [activeTab, setActiveTab] = useState<MainTab>('reportar')
  const [refreshTrustGroups, setRefreshTrustGroups] = useState(0)

  const user = getCurrentUser()

  const handleLogin = () => {
    setAuthenticated(true)
  }

  const handleLogout = () => {
    logout()
    setAuthenticated(false)
    setActiveTab('reportar')
  }

  const handleGroupCreated = () => {
    setRefreshTrustGroups(prev => prev + 1)
  }

  // Si no ha iniciado sesión
  if (!authenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  // Si es guardia
  if (user?.rol === 'guardia') {
    return <GuardDashboard />
  }

  // Usuario normal
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

          <div className="flex items-center gap-3">
            <NotificationBell />

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="pb-8">
        <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-6xl px-4">
            <button
              onClick={() => setActiveTab('reportar')}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'reportar'
                  ? 'border-uta-gold text-uta-gold'
                  : 'border-transparent text-gray-600 hover:text-uta-navy'
              }`}
            >
              🚨 Reportar Incidente
            </button>

            <button
              onClick={() => setActiveTab('grupos')}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'grupos'
                  ? 'border-uta-gold text-uta-gold'
                  : 'border-transparent text-gray-600 hover:text-uta-navy'
              }`}
            >
              👥 Grupos de Confianza
            </button>
          </div>
        </nav>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {activeTab === 'reportar' && <IncidentReportForm />}

          {activeTab === 'grupos' && (
            <div className="space-y-6">
              <TrustGroupForm onSuccess={handleGroupCreated} />
              <TrustGroupList refreshTrigger={refreshTrustGroups} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App