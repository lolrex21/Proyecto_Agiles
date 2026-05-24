import { useState } from 'react'
import { isAuthenticated, getCurrentUser } from './services/authService'
import LoginForm from './components/LoginForm'
import IncidentReportForm from './components/IncidentReportForm'
import GuardDashboard from './components/Guard/GuardDashboard'

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const user = getCurrentUser()

  const handleLogin = () => {
    setAuthenticated(true)
  }

  const handleLogout = () => {
    logout()
    setAuthenticated(false)
  }

  if (!authenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  // Si es guardia, mostrar dashboard
  if (user?.rol === 'guardia') {
    return <GuardDashboard />
  }

  // Si es usuario normal, mostrar formulario de reporte
  return <IncidentReportForm onLogout={handleLogout} />
}

export default App