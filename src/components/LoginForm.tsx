import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { initDemoUser, isAuthenticated, loginUser, registerUser } from '../services/authService'

interface LoginFormProps {
  onLogin: () => void
}

interface LoginErrors {
  username?: string
  password?: string
}

const defaultFormState = {
  username: '',
  password: '',
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [credentials, setCredentials] = useState(defaultFormState)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Inicializa un usuario demo si no existe ninguno. Esto es útil para pruebas.
  useEffect(() => {
    initDemoUser()
  }, [])

  // Valida los campos del formulario antes de enviar.
  const validate = () => {
    const newErrors: LoginErrors = {}

    if (!credentials.username.trim()) {
      newErrors.username = 'El nombre de usuario es obligatorio.'
    }
    if (!credentials.password.trim()) {
      newErrors.password = 'La contraseña es obligatoria.'
    } else if (credentials.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Actualiza los valores del formulario y limpia errores parciales.
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setCredentials(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof LoginErrors]) {
      setErrors(prev => ({ ...prev, [name as keyof LoginErrors]: undefined }))
    }
  }

  // Envía el formulario al servicio de autenticación.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!validate()) return

    setLoading(true)
    const action = mode === 'login' ? loginUser : registerUser
    const result = await action(credentials)
    setLoading(false)

    if (!result.success) {
      setMessage(result.message)
      return
    }

    if (mode === 'register') {
      setMessage('Registro completado. Sesión iniciada automáticamente.')
    }

    onLogin()
  }

  // Cambia entre el modo de login y registro.
  const toggleMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'))
    setMessage('')
    setErrors({})
  }

  if (isAuthenticated()) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-3xl shadow-lg">
        <h2 className="text-2xl font-bold text-uta-navy mb-4">Ya has iniciado sesión</h2>
        <p className="text-sm text-gray-600">Tu sesión ya está activa. Si deseas cambiar de cuenta, cierra sesión.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-7">
        <h1 className="text-2xl font-bold text-uta-navy mb-2">{mode === 'login' ? 'Iniciar Sesión' : 'Registrar Cuenta'}</h1>
        <p className="text-sm text-gray-600 mb-6">
          {mode === 'login'
            ? 'Ingresa tus credenciales de forma segura.'
            : 'Crea una cuenta con contraseña segura y cifrada.'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-semibold text-uta-navy mb-1">
              Correo institucional
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={credentials.username}
              onChange={handleInputChange}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-uta-gold focus:outline-none focus:ring-2 focus:ring-uta-gold/20"
              autoComplete="username"
            />
            {errors.username && <p className="mt-2 text-xs text-uta-red">{errors.username}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-semibold text-uta-navy mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleInputChange}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-uta-gold focus:outline-none focus:ring-2 focus:ring-uta-gold/20"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {errors.password && <p className="mt-2 text-xs text-uta-red">{errors.password}</p>}
          </div>

          {message && <div className="mb-4 rounded-2xl bg-uta-gray/30 px-4 py-3 text-sm text-gray-700">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-uta-navy px-4 py-3 text-white font-semibold transition hover:bg-uta-navy-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>

          <div className="mt-5 text-center text-sm text-gray-600">
            {mode === 'login'
              ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button type="button" onClick={toggleMode} className="font-semibold text-uta-gold hover:text-uta-gold-dark">
                    Regístrate
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" onClick={toggleMode} className="font-semibold text-uta-gold hover:text-uta-gold-dark">
                    Inicia sesión
                  </button>
                </>
              )}
          </div>
        </form>
      </div>
    </div>
  )
}
