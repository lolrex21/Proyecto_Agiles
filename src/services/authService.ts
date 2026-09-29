import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import type { AuthResult, LoginData, UserSession } from '../types/auth'

const USER_STORAGE_KEY = 'uta-auth-user'
const SESSION_TOKEN_KEY = 'uta-auth-token'

const ALLOWED_GOOGLE_EMAIL_DOMAIN =
  import.meta.env.VITE_ALLOWED_GOOGLE_EMAIL_DOMAIN || ''

const DEFAULT_OAUTH_ROLE =
  import.meta.env.VITE_DEFAULT_OAUTH_ROLE || 'usuario'

const sanitize = (value: string) => value.trim().replace(/[<>"'\\]/g, '')

const createToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Adapter pattern (Liskov Substitution Principle - LSP):
 * Unifies diverse user representations (Google OAuth user, database row, legacy storage)
 * into the standard UserSession contract so all components consume predictable fields.
 */
export const mapToUserSession = (raw: unknown): UserSession => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid user payload')
  }

  const record = raw as Record<string, unknown>
  const id = Number(record.id) || 0
  const correo = String(record.correo || record.email || '').trim().toLowerCase()
  const metadata = (record.user_metadata || {}) as Record<string, unknown>

  const rawName = String(
    record.nombre ||
    record.name ||
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    (correo ? correo.split('@')[0] : '') ||
    'Usuario'
  ).trim()

  const rawRole = String(
    record.rol || record.role || record.tipo_usuario || 'usuario'
  ).trim().toLowerCase()

  const rol = (rawRole === 'guard' || rawRole === 'guardia') ? 'guardia' : rawRole

  return {
    id,
    nombre: rawName,
    correo,
    rol,
    zona_id: record.zona_id != null ? Number(record.zona_id) : null,
  }
}

const saveLocalSession = (user: UserSession, token: string) => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

const clearLocalSession = () => {
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

const isAllowedGoogleEmail = (email: string) => {
  if (!ALLOWED_GOOGLE_EMAIL_DOMAIN) return true

  return email
    .toLowerCase()
    .endsWith(`@${ALLOWED_GOOGLE_EMAIL_DOMAIN.toLowerCase()}`)
}

const getGoogleDisplayName = (
  metadata: Record<string, unknown> | null | undefined,
  email: string
): string => {
  if (!metadata) return email.split('@')[0]

  const nameCandidate =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name

  return typeof nameCandidate === 'string' && nameCandidate.trim()
    ? nameCandidate.trim()
    : email.split('@')[0]
}

const syncSessionWithUsuariosTable = async (
  session: Session
): Promise<AuthResult> => {
  const email = session.user.email

  if (!email) {
    await supabase.auth.signOut()
    clearLocalSession()

    return {
      success: false,
      message: 'Google no devolvió un correo válido.',
    }
  }

  if (!isAllowedGoogleEmail(email)) {
    await supabase.auth.signOut()
    clearLocalSession()

    return {
      success: false,
      message: `Solo se permite el acceso con correos @${ALLOWED_GOOGLE_EMAIL_DOMAIN}.`,
    }
  }

  const safeEmail = sanitize(email.toLowerCase())
  const safeName = sanitize(getGoogleDisplayName(session.user.user_metadata, safeEmail))

  const { data: existingUser, error: searchError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('correo', safeEmail)
    .maybeSingle()

  if (searchError) {
    return {
      success: false,
      message: `No se pudo consultar la tabla usuarios: ${searchError.message}`,
    }
  }

  if (existingUser) {
    const sessionUser = mapToUserSession(existingUser)
    saveLocalSession(sessionUser, session.access_token)

    return {
      success: true,
      message: 'Inicio de sesión con Google exitoso.',
      token: session.access_token,
      user: sessionUser,
    }
  }

  const { data: newUser, error: insertError } = await supabase
    .from('usuarios')
    .insert([
      {
        nombre: safeName,
        correo: safeEmail,
        password: `google-oauth-${session.user.id}-${createToken()}`,
        rol: DEFAULT_OAUTH_ROLE,
      },
    ])
    .select()
    .single()

  if (insertError || !newUser) {
    return {
      success: false,
      message: `No se pudo crear el usuario de Google en la tabla usuarios: ${
        insertError?.message || 'error desconocido'
      }`,
    }
  }

  const sessionUser = mapToUserSession(newUser)
  saveLocalSession(sessionUser, session.access_token)

  return {
    success: true,
    message: 'Inicio de sesión con Google exitoso.',
    token: session.access_token,
    user: sessionUser,
  }
}

export const registerUser = async (credentials: LoginData): Promise<AuthResult> => {
  const rawEmail = credentials.email || credentials.username || ''
  const safeEmail = sanitize(rawEmail).toLowerCase()
  const safePassword = sanitize(credentials.password)

  if (!safeEmail || !safePassword) {
    return {
      success: false,
      message: 'El correo y la contraseña son obligatorios.',
    }
  }

  if (safePassword.length < 8) {
    return {
      success: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert([
      {
        nombre: safeEmail.split('@')[0],
        correo: safeEmail,
        password: safePassword,
        rol: 'usuario',
      },
    ])
    .select()
    .single()

  if (error || !data) {
    return {
      success: false,
      message: `No se pudo registrar el usuario: ${
        error?.message || 'verifica si el correo ya existe'
      }`,
    }
  }

  const token = createToken()
  const sessionUser = mapToUserSession(data)
  saveLocalSession(sessionUser, token)

  return {
    success: true,
    message: 'Registro exitoso.',
    token,
    user: sessionUser,
  }
}

export const loginUser = async (credentials: LoginData): Promise<AuthResult> => {
  const rawEmail = credentials.email || credentials.username || ''
  const safeEmail = sanitize(rawEmail).toLowerCase()
  const safePassword = sanitize(credentials.password)

  if (!safeEmail || !safePassword) {
    return {
      success: false,
      message: 'Correo y contraseña requeridos.',
    }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('correo', safeEmail)
    .eq('password', safePassword)
    .single()

  if (error || !data) {
    return {
      success: false,
      message: 'Correo o contraseña incorrectos.',
    }
  }

  const token = createToken()
  const sessionUser = mapToUserSession(data)
  saveLocalSession(sessionUser, token)

  return {
    success: true,
    message: 'Autenticación exitosa.',
    token,
    user: sessionUser,
  }
}

export const signInWithGoogle = async (): Promise<AuthResult> => {
  clearLocalSession()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile',
      redirectTo: window.location.origin,
    },
  })

  if (error) {
    return {
      success: false,
      message: error.message || 'No se pudo iniciar sesión con Google.',
    }
  }

  return {
    success: true,
    message: 'Redirigiendo a Google...',
  }
}

export const syncGoogleSession = async (
  sessionFromEvent?: Session | null
): Promise<AuthResult> => {
  let session = sessionFromEvent || null

  if (!session) {
    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      return {
        success: false,
        message: `No se pudo recuperar la sesión de Google: ${error.message}`,
      }
    }

    session = currentSession
  }

  if (!session?.user) {
    return {
      success: false,
      message: 'No hay sesión de Google activa.',
    }
  }

  return syncSessionWithUsuariosTable(session)
}

export const logout = async () => {
  await supabase.auth.signOut()
  clearLocalSession()
}

export const getAuthToken = () => localStorage.getItem(SESSION_TOKEN_KEY)

export const isAuthenticated = () => Boolean(getAuthToken())

export const getCurrentUser = (): UserSession | null => {
  const user = localStorage.getItem(USER_STORAGE_KEY)

  if (!user) return null

  try {
    const parsed = JSON.parse(user)
    return mapToUserSession(parsed)
  } catch {
    clearLocalSession()
    return null
  }
}
