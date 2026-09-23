import { trustGroupsRepo } from '../db/trustGroupsRepo'
import { usersRepo } from '../db/usersRepo'
import { notificationsRepo } from '../db/notificationsRepo'
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

    const group = await trustGroupsRepo.create(userId, {
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
    })

    await trustGroupsRepo.addMember(group.id, userId, 'admin')

    return { success: true, message: 'Grupo creado exitosamente.', data: group }
  } catch (error) {
    console.error('Error al crear grupo:', error)
    return { success: false, message: 'Error al crear el grupo.' }
  }
}

export const getUserTrustGroups = async (userId: number): Promise<TrustGroup[]> => {
  try {
    const groupIds = await trustGroupsRepo.getGroupIdsForUser(userId)
    if (groupIds.length === 0) return []
    return await trustGroupsRepo.findManyByIds(groupIds)
  } catch (error) {
    console.error('Error al obtener grupos:', error)
    return []
  }
}

export const getTrustGroup = async (groupId: number): Promise<TrustGroup | null> => {
  try {
    return await trustGroupsRepo.findById(groupId)
  } catch (error) {
    console.error('Error al obtener grupo:', error)
    return null
  }
}

export const getGroupMembers = async (groupId: number): Promise<TrustGroupMember[]> => {
  try {
    const members = await trustGroupsRepo.listMembers(groupId)
    if (members.length === 0) return []

    const userIds = members.map((member) => member.usuario_id)
    const users = await usersRepo.findByIds(userIds)

    const userMap = new Map(users.map((user) => [user.id, user]))
    return members.map((member) => ({
      ...member,
      rol: member.rol as 'admin' | 'miembro',
      usuario: userMap.get(member.usuario_id)
        ? {
            id: userMap.get(member.usuario_id)!.id,
            nombre: userMap.get(member.usuario_id)!.nombre,
            correo: userMap.get(member.usuario_id)!.correo,
          }
        : undefined,
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
  return trustGroupsRepo.getRoleInGroup(groupId, userId)
}

export const countGroupAdmins = async (groupId: number): Promise<number> => {
  return trustGroupsRepo.countAdmins(groupId)
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

    const invitedUser = await usersRepo.findByEmail(email)
    if (!invitedUser) {
      return { success: false, message: 'No se encontró un usuario con ese correo.' }
    }

    if (invitedUser.id === requesterId) {
      return { success: false, message: 'No puedes invitarte a ti mismo.' }
    }

    const existingMember = await trustGroupsRepo.findExistingMembership(
      groupId,
      invitedUser.id
    )
    if (existingMember) {
      return { success: false, message: 'Este usuario ya es miembro del grupo.' }
    }

    const existingRequest = await trustGroupsRepo.findPendingInvitation(
      groupId,
      invitedUser.id
    )
    if (existingRequest) {
      return {
        success: false,
        message: 'Ya existe una solicitud pendiente para este usuario.',
      }
    }

    await trustGroupsRepo.createInvitation({
      grupoId: groupId,
      invitedUserId: invitedUser.id,
      requesterId,
      mensaje: message,
    })

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
    const request = await trustGroupsRepo.findPendingRequest(requestId, userId)
    if (!request) {
      return { success: false, message: 'Solicitud no encontrada.' }
    }

    if (!accept) {
      await trustGroupsRepo.updateRequestStatus(requestId, 'rechazado')
      return { success: true, message: 'Solicitud rechazada.' }
    }

    await trustGroupsRepo.addMember(request.grupo_id, userId, 'miembro')
    await trustGroupsRepo.updateRequestStatus(requestId, 'aceptado')

    return { success: true, message: 'Solicitud aceptada.' }
  } catch (error) {
    console.error('Error al responder solicitud:', error)
    return { success: false, message: 'Error al procesar la solicitud.' }
  }
}

export const removeMember = async (
  memberId: number,
  currentUserId: number
): Promise<TrustGroupResult> => {
  try {
    const member = await trustGroupsRepo.findMemberById(memberId)
    if (!member) return { success: false, message: 'Miembro no encontrado.' }

    const currentRole = await trustGroupsRepo.getRoleInGroup(
      member.grupo_id,
      currentUserId
    )
    if (currentRole !== 'admin') {
      return { success: false, message: 'Solo el admin puede eliminar miembros.' }
    }

    const ok = await trustGroupsRepo.removeMemberById(memberId)
    if (!ok) return { success: false, message: 'No se pudo eliminar el miembro.' }

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
    const role = await trustGroupsRepo.getRoleInGroup(groupId, userId)
    if (!role) {
      return { success: false, message: 'No eres miembro de este grupo.' }
    }

    if (role === 'admin') {
      const adminCount = await trustGroupsRepo.countAdmins(groupId)
      if (adminCount <= 1) {
        return {
          success: false,
          message: 'No puedes salir si eres el único admin.',
        }
      }
    }

    const ok = await trustGroupsRepo.removeUserFromGroup(groupId, userId)
    if (!ok) return { success: false, message: 'No se pudo salir del grupo.' }

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
    const role = await trustGroupsRepo.getRoleInGroup(groupId, currentUserId)
    if (role !== 'admin') {
      return { success: false, message: 'Solo el admin puede eliminar el grupo.' }
    }

    const ok = await trustGroupsRepo.deleteById(groupId)
    if (!ok) return { success: false, message: 'No se pudo eliminar el grupo.' }

    return { success: true, message: 'Grupo eliminado.' }
  } catch (error) {
    console.error('Error al eliminar grupo:', error)
    return { success: false, message: 'Error al eliminar el grupo.' }
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

    const memberUserIds = members.map((m) => m.usuario_id)
    return await notificationsRepo.notifyGroupMembers(
      groupId,
      incidentId,
      userIdEmitter,
      message,
      memberUserIds
    )
  } catch (error) {
    console.error('Error al notificar grupo:', error)
    return false
  }
}

export const getUnreadNotifications = async (userId: number) => {
  try {
    return await trustGroupsRepo.listPendingInvitationsForUser(userId)
  } catch (error) {
    console.error('Error al obtener notificaciones:', error)
    return []
  }
}

export const markNotificationAsRead = async (
  notificationId: number
): Promise<boolean> => {
  try {
    return await notificationsRepo.markGroupRead(notificationId)
  } catch (error) {
    console.error('Error al marcar notificación:', error)
    return false
  }
}