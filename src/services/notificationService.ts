import { supabase } from './supabaseClient'
import type { GeneralNotification, GroupNotification, GroupRequest, NotificationSummary } from '../types/trustGroup'

export const getUserGeneralNotifications = async (userId: number): Promise<GeneralNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, usuario_id, incidente_id, mensaje, leido, fecha')
      .eq('usuario_id', userId)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('Error al obtener notificaciones generales:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error al obtener notificaciones generales:', error)
    return []
  }
}

const getUserGroupIds = async (userId: number): Promise<number[]> => {
  const { data, error } = await supabase
    .from('grupo_miembros')
    .select('grupo_id')
    .eq('usuario_id', userId)

  if (error) {
    console.error('Error al obtener grupos de usuario:', error)
    return []
  }

  return (data || []).map((item: any) => item.grupo_id)
}

export const getUserGroupNotifications = async (userId: number): Promise<GroupNotification[]> => {
  try {
    const grupoIds = await getUserGroupIds(userId)
    if (grupoIds.length === 0) {
      return []
    }

    const { data, error } = await supabase
      .from('notificaciones_grupo')
      .select('id, grupo_id, incidente_id, usuario_emisor_id, mensaje, leida, created_at')
      .in('grupo_id', grupoIds)
      .neq('usuario_emisor_id', userId)
      .eq('leida', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error al obtener notificaciones de grupo:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error al obtener notificaciones de grupo:', error)
    return []
  }
}

export const getPendingInvitesForUser = async (userId: number): Promise<GroupRequest[]> => {
  try {
    const { data: requests, error } = await supabase
      .from('solicitudes_grupo')
      .select('id, grupo_id, usuario_solicitante_id, mensaje, estado, created_at')
      .eq('usuario_invitado_id', userId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error al obtener solicitudes de grupo:', error)
      return []
    }

    const requestList = requests || []
    if (requestList.length === 0) {
      return []
    }

    const grupoIds = requestList.map((request: any) => request.grupo_id)
    const solicitanteIds = requestList.map((request: any) => request.usuario_solicitante_id)

    const { data: groups } = await supabase
      .from('grupos_confianza')
      .select('id, nombre')
      .in('id', grupoIds)

    const { data: users } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('id', solicitanteIds)

    const groupMap = new Map<number, { id: number; nombre: string }>()
    ;(groups || []).forEach((group: any) => {
      groupMap.set(group.id, group)
    })

    const userMap = new Map<number, { id: number; nombre: string }>()
    ;(users || []).forEach((user: any) => {
      userMap.set(user.id, user)
    })

    return requestList.map((request: any) => ({
      ...request,
      grupo_nombre: groupMap.get(request.grupo_id)?.nombre,
      solicitante_nombre: userMap.get(request.usuario_solicitante_id)?.nombre,
    }))
  } catch (error) {
    console.error('Error al obtener solicitudes de grupo:', error)
    return []
  }
}

export const getNotificationSummary = async (userId: number): Promise<NotificationSummary> => {
  try {
    const grupoIds = await getUserGroupIds(userId)
    const [{ data: general = [] }, { data: group = [] }, { data: invites = [] }] = await Promise.all([
      supabase
        .from('notificaciones')
        .select('id, leido')
        .eq('usuario_id', userId),
      grupoIds.length > 0
        ? supabase
            .from('notificaciones_grupo')
            .select('id, leida')
            .in('grupo_id', grupoIds)
            .neq('usuario_emisor_id', userId)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('solicitudes_grupo')
        .select('id')
        .eq('usuario_invitado_id', userId)
        .eq('estado', 'pendiente'),
    ])

    return {
      pendingInvites: (invites || []).length,
      unreadGeneral: ((general || []) as any[]).filter((item: any) => !item.leido).length,
      unreadGroup: ((group || []) as any[]).filter((item: any) => !item.leida).length,
    }
  } catch (error) {
    console.error('Error al obtener resumen de notificaciones:', error)
    return { pendingInvites: 0, unreadGeneral: 0, unreadGroup: 0 }
  }
}

export const markGeneralNotificationRead = async (notificationId: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leido: true })
      .eq('id', notificationId)

    if (error) {
      console.error('Error al marcar notificación general como leída:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error al marcar notificación general como leída:', error)
    return false
  }
}

export const markGroupNotificationRead = async (notificationId: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notificaciones_grupo')
      .update({ leida: true })
      .eq('id', notificationId)

    if (error) {
      console.error('Error al marcar notificación de grupo como leída:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error al marcar notificación de grupo como leída:', error)
    return false
  }
}

export const subscribeToNotificationChannels = (
  userId: number,
  callback: () => void
): { unsubscribe: () => Promise<void> } => {
  const channel = supabase.channel(`notifications-${userId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'notificaciones',
      filter: `usuario_id=eq.${userId}`,
    },
    () => callback()
  )

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'notificaciones_grupo',
    },
    () => callback()
  )

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'solicitudes_grupo',
      filter: `usuario_invitado_id=eq.${userId}`,
    },
    () => callback()
  )

  void channel.subscribe()

  return {
    unsubscribe: async () => {
      await supabase.removeChannel(channel)
    },
  }
}
