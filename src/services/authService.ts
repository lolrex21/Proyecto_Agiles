import bcrypt from 'bcryptjs'
import type { AuthResult, LoginData } from '../types/auth'

// Claves de almacenamiento local para la sesión y el usuario.
const USER_STORAGE_KEY = 'uta-auth-user'
const SESSION_TOKEN_KEY = 'uta-auth-token'

interface StoredUser {
  username: string
  passwordHash: string
}

const sanitize = (value: string) => value.trim().replace(/[<>"'\\]/g, '')

const createToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const getStoredUser = (): StoredUser | null => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) as StoredUser : null
  } catch (error) {
    console.error('Error leyendo usuario en el almacenamiento:', error)
    return null
  }
}

const saveStoredUser = (user: StoredUser) => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

const saveSessionToken = (token: string) => {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

// Inicializa un usuario de demostración en el almacenamiento local.
// Este usuario se crea solo si no existe uno previamente.
export const initDemoUser = async () => {
  const existingUser = getStoredUser()
  if (existingUser) return

  const demoPassword = 'Ut@Segur@2026'
  const passwordHash = await bcrypt.hash(demoPassword, 12)
  saveStoredUser({ username: 'admin', passwordHash })
}

// Registra un nuevo usuario localmente con contraseña hasheada.
// La contraseña nunca se guarda en texto plano.
export const registerUser = async ({ username, password }: LoginData): Promise<AuthResult> => {
  const safeUsername = sanitize(username)
  const safePassword = sanitize(password)

  if (!safeUsername || !safePassword) {
    return { success: false, message: 'El nombre de usuario y la contraseña son obligatorios.' }
  }
  if (safePassword.length < 8) {
    return { success: false, message: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (getStoredUser()?.username === safeUsername) {
    return { success: false, message: 'El usuario ya existe. Inicia sesión.' }
  }

  const passwordHash = await bcrypt.hash(safePassword, 12)
  saveStoredUser({ username: safeUsername, passwordHash })
  const token = createToken()
  saveSessionToken(token)

  return { success: true, message: 'Registro exitoso.', token }
}

// Autentica al usuario validando la contraseña contra el hash almacenado.
export const loginUser = async ({ username, password }: LoginData): Promise<AuthResult> => {
  const safeUsername = sanitize(username)
  const safePassword = sanitize(password)

  if (!safeUsername || !safePassword) {
    return { success: false, message: 'Nombre de usuario y contraseña requeridos.' }
  }

  const storedUser = getStoredUser()
  if (!storedUser || storedUser.username !== safeUsername) {
    return { success: false, message: 'Usuario no encontrado.' }
  }

  const isMatch = await bcrypt.compare(safePassword, storedUser.passwordHash)
  if (!isMatch) {
    return { success: false, message: 'Contraseña incorrecta.' }
  }

  const token = createToken()
  saveSessionToken(token)
  return { success: true, message: 'Autenticación exitosa.', token }
}

export const logout = () => {
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

export const getAuthToken = () => localStorage.getItem(SESSION_TOKEN_KEY)

export const isAuthenticated = () => Boolean(getAuthToken())
