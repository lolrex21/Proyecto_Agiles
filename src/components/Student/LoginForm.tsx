import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  initDemoUser,
  isAuthenticated,
  loginUser,
  registerUser,
  signInWithGoogle,
} from '../../services/authService'

interface LoginFormProps {
  onLogin: () => void
  initialMessage?: string
}

interface LoginErrors {
  username?: string
  password?: string
}

const defaultFormState = {
  username: '',
  password: '',
}

export default function LoginForm({ onLogin, initialMessage = '' }: LoginFormProps) {
  const [credentials, setCredentials] = useState(defaultFormState)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [message, setMessage] = useState(initialMessage)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    initDemoUser()
  }, [])

  useEffect(() => {
    setMessage(initialMessage)
  }, [initialMessage])

  const validate = () => {
    const newErrors: LoginErrors = {}

    if (!credentials.username.trim()) {
      newErrors.username = 'El correo es obligatorio.'
    }

    if (!credentials.password.trim()) {
      newErrors.password = 'La contraseña es obligatoria.'
    } else if (credentials.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setCredentials(prev => ({ ...prev, [name]: value }))

    if (errors[name as keyof LoginErrors]) {
      setErrors(prev => ({ ...prev, [name as keyof LoginErrors]: undefined }))
    }
  }

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

  const handleGoogleLogin = async () => {
    setMessage('')
    setLoading(true)

    const result = await signInWithGoogle()

    if (!result.success) {
      setLoading(false)
      setMessage(result.message)
    }
  }

  const toggleMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'))
    setMessage('')
    setErrors({})
  }

  if (isAuthenticated()) {
    return (
      <div className="max-w-md mx-auto mt-8 sm:mt-16 px-4 py-6 sm:p-6 bg-white rounded-2xl sm:rounded-3xl shadow-lg">
        <h2 className="text-xl sm:text-2xl font-bold text-uta-navy mb-3 sm:mb-4">
          Ya has iniciado sesión
        </h2>
        <p className="text-xs sm:text-sm text-gray-600">
          Tu sesión ya está activa. Si deseas cambiar de cuenta, cierra sesión.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-7">
        <h1 className="text-2xl sm:text-3xl font-bold text-uta-navy mb-1 sm:mb-2">
          {mode === 'login' ? 'Iniciar Sesión' : 'Registrar Cuenta'}
        </h1>

        <p className="text-xs sm:text-sm text-gray-600 mb-5 sm:mb-6">
          {mode === 'login'
            ? 'Ingresa tus credenciales o continúa con Gmail.'
            : 'Crea una cuenta con contraseña segura.'}
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-4 w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-white px-4 py-4 sm:py-5 text-sm sm:text-base font-bold text-uta-navy transition duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
        >
          {loading ? 'Conectando con Google...' : 'Continuar con Gmail'}
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-semibold uppercase text-gray-400">o</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-xs sm:text-sm font-semibold text-uta-navy mb-2"
            >
              Correo
            </label>

            <input
              id="username"
              name="username"
              type="email"
              value={credentials.username}
              onChange={handleInputChange}
              placeholder="tu.email@gmail.com"
              className="w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 px-4 py-3 sm:py-4 text-sm sm:text-base focus:border-uta-gold focus:outline-none focus:ring-2 focus:ring-uta-gold/20 transition"
              autoComplete="username"
            />

            {errors.username && (
              <p className="mt-2 text-xs text-uta-red font-medium">
                {errors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs sm:text-sm font-semibold text-uta-navy mb-2"
            >
              Contraseña
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleInputChange}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 px-4 py-3 sm:py-4 text-sm sm:text-base focus:border-uta-gold focus:outline-none focus:ring-2 focus:ring-uta-gold/20 transition"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {errors.password && (
              <p className="mt-2 text-xs text-uta-red font-medium">
                {errors.password}
              </p>
            )}
          </div>

          {message && (
            <div className="rounded-xl sm:rounded-2xl bg-uta-gray/30 px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 border border-gray-200">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl sm:rounded-2xl bg-uta-navy px-4 py-4 sm:py-5 text-sm sm:text-base text-white font-bold transition duration-200 hover:bg-uta-navy-dark disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>

          <div className="mt-5 sm:mt-7 text-center text-xs sm:text-sm text-gray-600">
            {mode === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-bold text-uta-gold hover:text-uta-gold-dark transition"
                >
                  Regístrate
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-bold text-uta-gold hover:text-uta-gold-dark transition"
                >
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