export interface LoginData {
  username: string
  password: string
}

export interface AuthResult {
  success: boolean
  message: string
  token?: string
}
