import { getCurrentUser, logout } from '../../services/authService'

export default function Header() {
  const user = getCurrentUser()

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-100">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">UTA CampusSeguro</h1>
          <p className="text-sm text-gray-600">
            Guardia: {user?.nombre} | Zona: {user?.zona_id || 'Sin asignar'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Salir
        </button>
      </div>
    </header>
  )
}