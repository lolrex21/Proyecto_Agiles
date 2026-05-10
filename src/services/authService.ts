import { supabase } from './supabaseClient'
import type { AuthResult, LoginData } from '../types/auth'

const USER_STORAGE_KEY = 'uta-auth-user'
const SESSION_TOKEN_KEY = 'uta-auth-token'

const sanitize = (value: string) => value.trim().replace(/[<>"'\\]/g, '')

const createToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const initDemoUser = async () => {
  return
}

export const registerUser = async ({ username, password }: LoginData): Promise<AuthResult> => {
  const safeUsername = sanitize(username)
  const safePassword = sanitize(password)

  if (!safeUsername || !safePassword) {
    return { success: false, message: 'El correo y la contraseña son obligatorios.' }
  }

  if (safePassword.length < 8) {
    return { success: false, message: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert([
      {
        nombre: safeUsername.split('@')[0],
        correo: safeUsername,
        password: safePassword,
        rol: 'usuario',
      },
    ])
    .select()
    .single()

  if (error || !data) {
    return { success: false, message: 'No se pudo registrar el usuario. Verifica si el correo ya existe.' }
  }

  const token = createToken()

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(SESSION_TOKEN_KEY, token)

  return { success: true, message: 'Registro exitoso.', token }
}

export const loginUser = async ({ username, password }: LoginData): Promise<AuthResult> => {
  const safeUsername = sanitize(username)
  const safePassword = sanitize(password)

  if (!safeUsername || !safePassword) {
    return { success: false, message: 'Correo y contraseña requeridos.' }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('correo', safeUsername)
    .eq('password', safePassword)
    .single()

  if (error || !data) {
    return { success: false, message: 'Correo o contraseña incorrectos.' }
  }

  const token = createToken()

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(SESSION_TOKEN_KEY, token)

  return { success: true, message: 'Autenticación exitosa.', token }
}

export const logout = () => {
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
}

export const getAuthToken = () => localStorage.getItem(SESSION_TOKEN_KEY)

export const isAuthenticated = () => Boolean(getAuthToken())

export const getCurrentUser = () => {
  const user = localStorage.getItem(USER_STORAGE_KEY)
  return user ? JSON.parse(user) : null
}