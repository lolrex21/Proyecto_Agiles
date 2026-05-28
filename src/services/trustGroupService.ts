import { supabase } from './supabaseClient'
import type {
  TrustGroup,
  TrustGroupMember,
  CreateTrustGroupData,
  TrustGroupResult,
} from '../types/trustGroup'

export const createTrustGroup = async (
  userId: number | null,
  data: CreateTrustGroupData
): Promise<TrustGroupResult> => {
  try {
    if (!userId) return { success: false, message: 'Usuario no autenticado.' }

    const { data: group, error } = await supabase
      .from('grupos_confianza')
      .insert({
        usuario_creador_id: userId,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion?.trim() || null,
      })
      .select()
      .single()

    if (error || !group) {
      return { success: false, message: error?.message || 'No se pudo crear el grupo.' }
    }

    // Te agregamos como admin. Si esto falla, el grupo no aparecería en tu lista,
    // así que borramos el grupo huérfano y devolvemos el error real.
    const memberResult = await addMemberByUserId(group.id, userId, 'admin')

    if (!memberResult.success) {
      await supabase.from('grupos_confianza').delete().eq('id', group.id)
      return {
        success: false,
        message: `El grupo no se pudo registrar para tu usuario: ${memberResult.message}`,
      }
    }

    return { success: true, message: 'Grupo creado exitosamente.', data: group }
  } catch (error) {
    console.error('Error al crear grupo:', error)
    return { success: false, message: 'Error al crear el grupo.' }
  }
}

export const getUserTrustGroups = async (userId: number): Promise<TrustGroup[]> => {
  try {
    const { data: memberships, error } = await supabase
      .from('grupo_miembros')
      .select('grupo_id')
      .eq('usuario_id', userId)

    if (error || !memberships) return []

    const groupIds = memberships.map(item => item.grupo_id)
    if (groupIds.length === 0) return []

    const { data: groups, error: groupError } = await supabase
      .from('grupos_confianza')
      .select('*')
      .in('id', groupIds)

    if (groupError || !groups) return []

    return groups
  } catch (error) {
    console.error('Error al obtener grupos:', error)
    return []
  }
}

export const getTrustGroup = async (groupId: number): Promise<TrustGroup | null> => {
  try {
    const { data, error } = await supabase
      .from('grupos_confianza')
      .select('*')
      .eq('id', groupId)
      .single()

    if (error || !data) return null

    return data
  } catch (error) {
    console.error('Error al obtener grupo:', error)
    return null
  }
}

export const getGroupMembers = async (groupId: number): Promise<TrustGroupMember[]> => {
  try {
    const { data: members, error } = await supabase
      .from('grupo_miembros')
      .select('id, grupo_id, usuario_id, rol, joined_at')
      .eq('grupo_id', groupId)

    if (error || !members) return []

    const userIds = members.map(member => member.usuario_id)

    const { data: users } = await supabase
      .from('usuarios')
      .select('id, nombre, correo')
      .in('id', userIds)

    const userMap = new Map()
    ;(users || []).forEach(user => userMap.set(user.id, user))

    return members.map(member => ({
      ...member,
      usuario: userMap.get(member.usuario_id),
    }))
  } catch (error) {
    console.error('Error al obtener miembros:', error)
    return []
  }
}

export const getGroupMembershipRole = async (
  groupId: number,
  userId: number
): Promise<'admin' | 'miembro' | null> => {
  const { data, error } = await supabase
    .from('grupo_miembros')
    .select('rol')
    .eq('grupo_id', groupId)
    .eq('usuario_id', userId)
    .single()

  if (error || !data) return null
  return data.rol
}

export const countGroupAdmins = async (groupId: number): Promise<number> => {
  const { data, error } = await supabase
    .from('grupo_miembros')
    .select('id')
    .eq('grupo_id', groupId)
    .eq('rol', 'admin')

  if (error || !data) return 0
  return data.length
}

const addMemberByUserId = async (
  groupId: number,
  userId: number,
  rol: 'admin' | 'miembro' = 'miembro'
): Promise<TrustGroupResult> => {
  try {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .insert({
        grupo_id: groupId,
        usuario_id: userId,
        rol,
      })
      .select()
      .single()

    if (error || !data) return { success: false, message: 'No se pudo agregar el miembro.' }

    return { success: true, message: 'Miembro agregado exitosamente.', data }
  } catch (error) {
    console.error('Error al agregar miembro:', error)
    return { success: false, message: 'Error al agregar miembro.' }
  }
}

export const addMemberByEmail = async (
  groupId: number,
  email: string,
  currentUserId: number
): Promise<TrustGroupResult> => {
  return createGroupInvitation(groupId, email, currentUserId)
}

export const createGroupInvitation = async (
  groupId: number,
  invitedEmail: string,
  requesterId: number,
  message?: string
): Promise<TrustGroupResult> => {
  try {
    const email = invitedEmail.trim().toLowerCase()

    const { data: invitedUser, error: invitedError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('correo', email)
      .single()

    if (invitedError || !invitedUser) {
      return { success: false, message: 'No se encontró un usuario con ese correo.' }
    }

    if (invitedUser.id === requesterId) {
      return { success: false, message: 'No puedes invitarte a ti mismo.' }
    }

    const { data: existingMember } = await supabase
      .from('grupo_miembros')
      .select('id')
      .eq('grupo_id', groupId)
      .eq('usuario_id', invitedUser.id)
      .maybeSingle()

    if (existingMember) {
      return { success: false, message: 'Este usuario ya es miembro del grupo.' }
    }

    const { data: existingRequest } = await supabase
      .from('solicitudes_grupo')
      .select('id')
      .eq('grupo_id', groupId)
      .eq('usuario_invitado_id', invitedUser.id)
      .eq('estado', 'pendiente')
      .maybeSingle()

    if (existingRequest) {
      return { success: false, message: 'Ya existe una solicitud pendiente para este usuario.' }
    }

    const { error } = await supabase
      .from('solicitudes_grupo')
      .insert({
        grupo_id: groupId,
        usuario_invitado_id: invitedUser.id,
        usuario_solicitante_id: requesterId,
        mensaje: message || 'Te invitaron a un grupo de confianza.',
        estado: 'pendiente',
      })

    if (error) throw error

    return { success: true, message: 'Solicitud enviada correctamente.' }
  } catch (error) {
    console.error('Error al crear solicitud:', error)
    return { success: false, message: 'Error al enviar solicitud.' }
  }
}

export const respondToGroupInvitation = async (
  requestId: number,
  userId: number,
  accept: boolean
): Promise<TrustGroupResult> => {
  try {
    const { data: request, error } = await supabase
      .from('solicitudes_grupo')
      .select('*')
      .eq('id', requestId)
      .eq('usuario_invitado_id', userId)
      .eq('estado', 'pendiente')
      .single()

    if (error || !request) {
      return { success: false, message: 'Solicitud no encontrada.' }
    }

    if (!accept) {
      await supabase.from('solicitudes_grupo').update({ estado: 'rechazado' }).eq('id', requestId)
      return { success: true, message: 'Solicitud rechazada.' }
    }

    const addResult = await addMemberByUserId(request.grupo_id, userId, 'miembro')
    if (!addResult.success) return addResult

    await supabase.from('solicitudes_grupo').update({ estado: 'aceptado' }).eq('id', requestId)

    return { success: true, message: 'Solicitud aceptada.' }
  } catch (error) {
    console.error('Error al responder solicitud:', error)
    return { success: false, message: 'Error al procesar solicitud.' }
  }
}

export const removeMember = async (
  memberId: number,
  currentUserId: number
): Promise<TrustGroupResult> => {
  try {
    const { data: member, error } = await supabase
      .from('grupo_miembros')
      .select('*')
      .eq('id', memberId)
      .single()

    if (error || !member) return { success: false, message: 'Miembro no encontrado.' }

    const currentRole = await getGroupMembershipRole(member.grupo_id, currentUserId)
    if (currentRole !== 'admin') {
      return { success: false, message: 'Solo el admin puede eliminar miembros.' }
    }

    const { error: deleteError } = await supabase
      .from('grupo_miembros')
      .delete()
      .eq('id', memberId)

    if (deleteError) return { success: false, message: 'No se pudo eliminar el miembro.' }

    return { success: true, message: 'Miembro eliminado.' }
  } catch (error) {
    console.error('Error al eliminar miembro:', error)
    return { success: false, message: 'Error al eliminar miembro.' }
  }
}

export const leaveGroup = async (
  groupId: number,
  userId: number
): Promise<TrustGroupResult> => {
  try {
    const role = await getGroupMembershipRole(groupId, userId)

    if (!role) return { success: false, message: 'No eres miembro de este grupo.' }

    if (role === 'admin') {
      const adminCount = await countGroupAdmins(groupId)
      if (adminCount <= 1) {
        return { success: false, message: 'No puedes salir si eres el único admin.' }
      }
    }

    const { error } = await supabase
      .from('grupo_miembros')
      .delete()
      .eq('grupo_id', groupId)
      .eq('usuario_id', userId)

    if (error) return { success: false, message: 'No se pudo salir del grupo.' }

    return { success: true, message: 'Saliste del grupo.' }
  } catch (error) {
    console.error('Error al salir del grupo:', error)
    return { success: false, message: 'Error al salir del grupo.' }
  }
}

export const deleteTrustGroup = async (
  groupId: number,
  currentUserId: number
): Promise<TrustGroupResult> => {
  try {
    const role = await getGroupMembershipRole(groupId, currentUserId)

    if (role !== 'admin') {
      return { success: false, message: 'Solo el admin puede eliminar el grupo.' }
    }

    const { error } = await supabase
      .from('grupos_confianza')
      .delete()
      .eq('id', groupId)

    if (error) {
      console.error('Error Supabase al eliminar grupo:', error)
      return { success: false, message: error.message || 'No se pudo eliminar el grupo.' }
    }

    return { success: true, message: 'Grupo eliminado.' }
  } catch (error) {
    console.error('Error al eliminar grupo:', error)
    return { success: false, message: 'Error al eliminar grupo.' }
  }
}

export const notifyGroupMembers = async (
  groupId: number,
  incidentId: number,
  userIdEmitter: number,
  message: string
): Promise<boolean> => {
  try {
    const { data: members, error } = await supabase
      .from('grupo_miembros')
      .select('usuario_id')
      .eq('grupo_id', groupId)
      .neq('usuario_id', userIdEmitter)

    if (error || !members || members.length === 0) return false

    const notifications = members.map(member => ({
      grupo_id: groupId,
      incidente_id: incidentId,
      usuario_emisor_id: userIdEmitter,
      mensaje: message,
      leida: false,
    }))

    const { error: insertError } = await supabase
      .from('notificaciones_grupo')
      .insert(notifications)

    if (insertError) {
      console.error('Error al notificar miembros:', insertError)
      return false
    }

    return true
  } catch (error) {
    console.error('Error al notificar grupo:', error)
    return false
  }
}

export const getUnreadNotifications = async (userId: number) => {
  const { data, error } = await supabase
    .from('solicitudes_grupo')
    .select('*')
    .eq('usuario_invitado_id', userId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error al obtener notificaciones:', error)
    return []
  }

  return data || []
}

export const markNotificationAsRead = async (notificationId: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notificaciones_grupo')
      .update({ leida: true })
      .eq('id', notificationId)

    return !error
  } catch (error) {
    console.error('Error al marcar notificación:', error)
    return false
  }
}