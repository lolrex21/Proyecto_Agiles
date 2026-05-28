import { useEffect, useState } from 'react'
import { supabase } from './services/supabaseClient'
import {
  isAuthenticated,
  getCurrentUser,
  syncGoogleSession,
} from './services/authService'

import LoginForm from './components/Student/LoginForm'
import IncidentReportForm from './components/Student/IncidentReportForm'
import GuardDashboard from './components/Guard/GuardDashboard'

import TrustGroupForm from './components/TrustGroupForm'
import TrustGroupList from './components/TrustGroupList'
import Header from './components/Header'

type MainTab = 'reportar' | 'grupos'

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeTab, setActiveTab] = useState<MainTab>('reportar')
  const [refreshTrustGroups, setRefreshTrustGroups] = useState(0)
  const [sessionMessage, setSessionMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(getCurrentUser())

  useEffect(() => {
    let isMounted = true
    let handled = false

    const cleanUrlHash = () => {
      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    const applyResult = async (session: any) => {
      if (handled || !isMounted) return
      handled = true

      const result = await syncGoogleSession(session)
      if (!isMounted) return

      if (result.success) {
        setSessionMessage('')
        setCurrentUser(getCurrentUser())
        setAuthenticated(true)
        cleanUrlHash()
      } else {
        handled = false
        setSessionMessage(result.message)
        setCurrentUser(null)
        setAuthenticated(false)
      }

      setCheckingSession(false)
    }

    const bootstrap = async () => {
      if (isAuthenticated()) {
        setCurrentUser(getCurrentUser())
        setAuthenticated(true)
        setCheckingSession(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session) {
        await applyResult(session)
      } else {
        setAuthenticated(false)
        setCurrentUser(null)
        setCheckingSession(false)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        void applyResult(session)
      }
    })

    void bootstrap()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLogin = () => {
    setSessionMessage('')
    setAuthenticated(true)
    setCurrentUser(getCurrentUser())
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

  if (currentUser?.rol === 'guardia') {
    return <GuardDashboard />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

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

        {activeTab === 'grupos' && currentUser && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <TrustGroupForm onSuccess={handleGroupCreated} />

            <TrustGroupList refreshTrigger={refreshTrustGroups} />
          </div>
        )}
      </main>
    </div>
  )
}

export default App