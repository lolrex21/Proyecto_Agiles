import { useState } from 'react'
import { isAuthenticated, getCurrentUser } from './services/authService'
import LoginForm from './components/Student/LoginForm'
import IncidentReportForm from './components/Student/IncidentReportForm'
import GuardDashboard from './components/Guard/GuardDashboard'

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const user = getCurrentUser()

  const handleLogin = () => {
    setAuthenticated(true)
  }


  if (!authenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  // Si es guardia, mostrar dashboard
  if (user?.rol === 'guardia') {
    return <GuardDashboard />
  }

  // Si es usuario normal, mostrar formulario de reporte
  return <IncidentReportForm />
}

export default App