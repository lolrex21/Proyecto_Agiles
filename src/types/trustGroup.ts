/**
 * Tipos para el módulo de Grupos de Confianza
 * Gestión de grupos de usuarios con capacidad de notificaciones
 */

export interface TrustGroup {
  id: number
  usuario_creador_id: number
  nombre: string
  descripcion?: string | null
  created_at: string
  updated_at: string
}

export interface TrustGroupMember {
  id: number
  grupo_id: number
  usuario_id: number
  rol: 'admin' | 'miembro'
  joined_at: string
  usuario?: {
    id: number
    nombre: string
    correo: string
  }
}

export interface GroupNotification {
  id: number
  grupo_id: number
  incidente_id: number | null
  usuario_emisor_id: number
  mensaje: string
  leida: boolean
  created_at: string
}

export interface CreateTrustGroupData {
  nombre: string
  descripcion?: string
}

export interface AddMemberData {
  correo: string
}

export interface TrustGroupResult {
  success: boolean
  message: string
  data?: TrustGroup | TrustGroupMember | TrustGroup[]
}

export interface GeneralNotification {
  id: number
  usuario_id: number
  incidente_id: number
  mensaje: string
  leido: boolean
  fecha: string
}

export interface GroupRequest {
  id: number
  grupo_id: number
  usuario_invitado_id: number
  usuario_solicitante_id: number
  estado: 'pendiente' | 'aceptado' | 'rechazado'
  mensaje?: string
  created_at: string
  grupo_nombre?: string
  solicitante_nombre?: string
}

export interface NotificationSummary {
  pendingInvites: number
  unreadGeneral: number
  unreadGroup: number
}
