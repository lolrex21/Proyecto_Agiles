import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import type { AuthResult, LoginData } from '../types/auth'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

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

const saveLocalSession = (user: any, token: string) => {
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

const getGoogleDisplayName = (metadata: any, email: string) => {
  return (
    metadata?.full_name ||
    metadata?.name ||
    metadata?.user_name ||
    email.split('@')[0]
  )
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
    saveLocalSession(existingUser, session.access_token)

    return {
      success: true,
      message: 'Inicio de sesión con Google exitoso.',
      token: session.access_token,
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

  saveLocalSession(newUser, session.access_token)

  return {
    success: true,
    message: 'Inicio de sesión con Google exitoso.',
    token: session.access_token,
  }
}

export const initDemoUser = async () => {
  return
}

export const registerUser = async ({ username, password }: LoginData): Promise<AuthResult> => {
  const safeUsername = sanitize(username)
  const safePassword = sanitize(password)

  if (!safeUsername || !safePassword) {
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
        nombre: safeUsername.split('@')[0],
        correo: safeUsername,
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
  saveLocalSession(data, token)

  return {
    success: true,
    message: 'Registro exitoso.',
    token,
  }
}

export const loginUser = async ({ username, password }: LoginData): Promise<AuthResult> => {
  const safeUsername = sanitize(username)
  const safePassword = sanitize(password)

  if (!safeUsername || !safePassword) {
    return {
      success: false,
      message: 'Correo y contraseña requeridos.',
    }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('correo', safeUsername)
    .eq('password', safePassword)
    .single()

  if (error || !data) {
    return {
      success: false,
      message: 'Correo o contraseña incorrectos.',
    }
  }

  const token = createToken()
  saveLocalSession(data, token)

  return {
    success: true,
    message: 'Autenticación exitosa.',
    token,
  }
}

export const signInWithGoogle = async (): Promise<AuthResult> => {
  clearLocalSession()

  const isNative = Capacitor.isNativePlatform()
  const redirectTo = isNative
    ? 'com.uta.campusseguro://auth-callback'
    : window.location.origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile',
      redirectTo,
      skipBrowserRedirect: isNative, // en móvil abrimos el navegador nosotros
    },
  })

  if (error) {
    return {
      success: false,
      message: error.message || 'No se pudo iniciar sesión con Google.',
    }
  }

  // En la APK abrimos la URL de Google en el navegador del sistema.
  if (isNative && data?.url) {
    await Browser.open({ url: data.url })
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

export const getCurrentUser = () => {
  const user = localStorage.getItem(USER_STORAGE_KEY)

  if (!user) return null

  try {
    return JSON.parse(user)
  } catch {
    clearLocalSession()
    return null
  }
}