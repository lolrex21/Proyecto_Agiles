import { getCurrentUser, logout } from '../../services/authService'
import './Header.css'

export default function Header() {
  const user = getCurrentUser()

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const userName = user?.nombre || user?.name || 'Usuario'
  const userEmail = user?.email || user?.correo || 'Correo no disponible'
  const userRole = user?.rol || user?.role || user?.tipo_usuario || 'estudiante'

  const isGuard = userRole === 'guardia' || userRole === 'guard'

  return (
    <header className="app-header">
      <div className="app-header-container">
        <div className="brand-section">
          <div className="brand-icon">
            <span>🛡️</span>
          </div>

          <div>
            <h1 className="brand-title">UTA CampusSeguro</h1>
            <p className="brand-subtitle">
              Sistema de alertas universitarias
            </p>
          </div>
        </div>

        <div className="user-card">
          <div className="user-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="user-details">
            <span className="user-role">
              {isGuard ? 'Guardia de seguridad' : 'Estudiante'}
            </span>

            <strong className="user-fullname">
              {userName}
            </strong>

            <span className="user-email">
              {userEmail}
            </span>

            {isGuard && (
              <span className="user-zone">
                Zona: {user?.zona_id || 'Sin asignar'}
              </span>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="logout-button"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}