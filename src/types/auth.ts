// src/types/auth.ts

export type UserRole = 'usuario' | 'guardia' | 'admin' | string

/**
 * Standard unified contract for authenticated user sessions.
 * Fulfills Liskov Substitution Principle (LSP): any auth provider
 * (Google OAuth, database credentials) is adapted to this contract.
 */
export interface IUser {
  id: number
  nombre: string
  correo: string
  rol: UserRole
  zona_id?: number | null
}

export type UserSession = IUser

export interface LoginData {
  email: string
  password: string
  /** @deprecated Compatibility fallback for legacy callers */
  username?: string
}

export interface AuthResult {
  success: boolean
  message: string
  token?: string
  user?: UserSession
}
