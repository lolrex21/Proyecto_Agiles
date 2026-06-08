import { useEffect, useState } from 'react'
import { supabase } from './services/supabaseClient'
import {
  isAuthenticated,
  getCurrentUser,
  syncGoogleSession,
} from './services/authService'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

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
      console.log('[GoogleLogin] resultado:', result)  // TEMPORAL — quitar luego

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
       console.log('[auth] evento:', event, '| hay sesión?:', !!session) 
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

  // Captura el deep link de regreso de Google OAuth en la APK
  // (este useEffect va al nivel superior del componente, NO dentro del de arriba)
  // Captura el deep link de regreso de Google OAuth en la APK
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.includes('auth-callback')) return

      try {
        // El code viene como parámetro ?code=... ; hay que extraerlo y pasar SOLO el code
        const code = new URL(url).searchParams.get('code')

        if (!code) {
          console.error('[GoogleLogin] el deep link no trajo code:', url)
          return
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[GoogleLogin] error al canjear el code:', error.message)
        }

        await Browser.close()
      } catch (e) {
        console.error('[GoogleLogin] excepción en el canje:', e)
      }
    })

    return () => {
      void listenerPromise.then((listener) => listener.remove())
    }
  }, [])

  const handleLogin = () => {
    setSessionMessage('')
    setAuthenticated(true)
    setCurrentUser(getCurrentUser())
  }

  const handleGroupCreated = () => {
    setRefreshTrustGroups((prev) => prev + 1)
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

  const currentRole = String(
    currentUser?.rol || currentUser?.role || currentUser?.tipo_usuario || ''
  ).toLowerCase()

  const isGuardOrAdmin = [
    'guardia',
    'guard',
    'admin',
    'administrador',
  ].includes(currentRole)

  if (isGuardOrAdmin) {
    return <GuardDashboard role={currentRole} />
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-hidden">
      <Header />

      <main className="fixed left-0 right-0 top-[4rem] bottom-[3.8rem] mx-auto w-full max-w-6xl px-3 pt-2 overflow-hidden">
        {activeTab === 'reportar' && (
          <div className="h-full overflow-hidden">
            <IncidentReportForm />
          </div>
        )}

        {activeTab === 'grupos' && currentUser && (
          <div className="h-full overflow-y-auto pb-4">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <TrustGroupForm onSuccess={handleGroupCreated} />

              <TrustGroupList refreshTrigger={refreshTrustGroups} />
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-6xl grid grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTab('reportar')}
            className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-bold transition ${
              activeTab === 'reportar'
                ? 'text-uta-red border-t-2 border-uta-red'
                : 'text-gray-500 border-t-2 border-transparent hover:text-gray-700'
            }`}
          >
            <span className="text-xl leading-none">🚨</span>
            Reportar emergencia
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grupos')}
            className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-bold transition ${
              activeTab === 'grupos'
                ? 'text-uta-red border-t-2 border-uta-red'
                : 'text-gray-500 border-t-2 border-transparent hover:text-gray-700'
            }`}
          >
            <span className="text-xl leading-none">👥</span>
            Grupos de confianza
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App