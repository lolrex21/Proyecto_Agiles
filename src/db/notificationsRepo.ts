import { supabase } from './supabaseClient'
import type { Tables, TablesInsert } from '../types/database'

export type NotificacionGeneral = Tables<'notificaciones'>
export type NotificacionGrupo = Tables<'notificaciones_grupo'>

export const notificationsRepo = {
  // ---------- Notificaciones generales ----------
  async listForUser(userId: number): Promise<NotificacionGeneral[]> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, usuario_id, incidente_id, mensaje, leido, fecha')
      .eq('usuario_id', userId)
      .order('fecha', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  async countUnreadForUser(userId: number): Promise<number> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, leido')
      .eq('usuario_id', userId)
    if (error) throw error
    return (data ?? []).filter((n) => !n.leido).length
  },

  async markGeneralRead(notificationId: number): Promise<boolean> {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leido: true })
      .eq('id', notificationId)
    return !error
  },

  // ---------- Notificaciones de grupo ----------
  async listForGroups(
    groupIds: number[],
    excludeEmisorId: number
  ): Promise<NotificacionGrupo[]> {
    if (groupIds.length === 0) return []
    const { data, error } = await supabase
      .from('notificaciones_grupo')
      .select(
        'id, grupo_id, incidente_id, usuario_emisor_id, mensaje, leida, created_at'
      )
      .in('grupo_id', groupIds)
      .neq('usuario_emisor_id', excludeEmisorId)
      .eq('leida', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  async countUnreadForGroups(
    groupIds: number[],
    excludeEmisorId: number
  ): Promise<number> {
    if (groupIds.length === 0) return 0
    const { data, error } = await supabase
      .from('notificaciones_grupo')
      .select('id, leida')
      .in('grupo_id', groupIds)
      .neq('usuario_emisor_id', excludeEmisorId)
    if (error) throw error
    return (data ?? []).filter((n) => !n.leida).length
  },

  async notifyGroupMembers(
    groupId: number,
    incidenteId: number,
    userIdEmisor: number,
    message: string,
    memberUserIds: number[]
  ): Promise<boolean> {
    if (memberUserIds.length === 0) return false
    const rows: TablesInsert<'notificaciones_grupo'>[] = memberUserIds.map(
      () => ({
        grupo_id: groupId,
        incidente_id: incidenteId,
        usuario_emisor_id: userIdEmisor,
        mensaje: message,
        leida: false,
      })
    )
    const { error } = await supabase.from('notificaciones_grupo').insert(rows)
    return !error
  },

  async markGroupRead(notificationId: number): Promise<boolean> {
    const { error } = await supabase
      .from('notificaciones_grupo')
      .update({ leida: true })
      .eq('id', notificationId)
    return !error
  },

  // ---------- Realtime ----------
  subscribeToUserNotifications(
    userId: number,
    onChange: () => void
  ): { unsubscribe: () => Promise<void> } {
    const channel = supabase.channel(`notifications-${userId}`)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${userId}`,
      },
      () => onChange()
    )

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notificaciones_grupo' },
      () => onChange()
    )

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'solicitudes_grupo',
        filter: `usuario_invitado_id=eq.${userId}`,
      },
      () => onChange()
    )

    void channel.subscribe()

    return {
      unsubscribe: async () => {
        await supabase.removeChannel(channel)
      },
    }
  },

  subscribeToIncidents(onChange: () => void): { unsubscribe: () => Promise<void> } {
    const channel = supabase
      .channel('incidentes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidentes' },
        () => onChange()
      )
      .subscribe()

    return {
      unsubscribe: async () => {
        await supabase.removeChannel(channel)
      },
    }
  },
}