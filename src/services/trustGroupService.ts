import { trustGroupsRepo } from '../db/trustGroupsRepo'
import { usersRepo } from '../db/usersRepo'
import { notificationsRepo } from '../db/notificationsRepo'
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
  if (!userId) return { success: false, message: 'Usuario no autenticado.' }

  if (!data.nombre.trim()) return { success: false, message: 'El nombre del grupo es obligatorio.' }

  const group = await trustGroupsRepo.create(userId, {
    nombre: data.nombre,
    descripcion: data.descripcion ?? null,
  })

  // El trigger de creación inserta al administrador en la misma transacción.

  return { success: true, message: 'Grupo creado exitosamente.', data: group }
}

export const getUserTrustGroups = async (userId: number): Promise<TrustGroup[]> => {
  const groupIds = await trustGroupsRepo.getGroupIdsForUser(userId)
  if (groupIds.length === 0) return []
  return await trustGroupsRepo.findManyByIds(groupIds)
}

export const getTrustGroup = async (groupId: number): Promise<TrustGroup | null> => {
  return await trustGroupsRepo.findById(groupId)
}

export const getGroupMembers = async (groupId: number): Promise<TrustGroupMember[]> => {
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
  if (await trustGroupsRepo.getRoleInGroup(groupId, requesterId) !== 'admin') {
    return { success: false, message: 'Solo el admin puede invitar miembros.' }
  }
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
}

export const respondToGroupInvitation = async (
  requestId: number,
  userId: number,
  accept: boolean
): Promise<TrustGroupResult> => {
  const request = await trustGroupsRepo.findPendingRequest(requestId, userId)
  if (!request) {
    return { success: false, message: 'Solicitud no encontrada.' }
  }

  // El trigger inserta la membresía dentro de la actualización si se acepta.
  const updated = await trustGroupsRepo.updateRequestStatus(
    requestId, accept ? 'aceptado' : 'rechazado'
  )
  if (!updated) return { success: false, message: 'La solicitud ya no está pendiente.' }
  return { success: true, message: accept ? 'Solicitud aceptada.' : 'Solicitud rechazada.' }
}

export const removeMember = async (
  memberId: number,
  currentUserId: number
): Promise<TrustGroupResult> => {
  const member = await trustGroupsRepo.findMemberById(memberId)
  if (!member) return { success: false, message: 'Miembro no encontrado.' }

  const currentRole = await trustGroupsRepo.getRoleInGroup(
    member.grupo_id,
    currentUserId
  )
  if (currentRole !== 'admin') {
    return { success: false, message: 'Solo el admin puede eliminar miembros.' }
  }

  if (member.rol === 'admin' && await trustGroupsRepo.countAdmins(member.grupo_id) <= 1) {
    return { success: false, message: 'No puedes eliminar al único admin.' }
  }

  const ok = await trustGroupsRepo.removeMemberById(memberId)
  if (!ok) return { success: false, message: 'No se pudo eliminar el miembro.' }

  return { success: true, message: 'Miembro eliminado.' }
}

export const leaveGroup = async (
  groupId: number,
  userId: number
): Promise<TrustGroupResult> => {
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
}

export const deleteTrustGroup = async (
  groupId: number,
  currentUserId: number
): Promise<TrustGroupResult> => {
  const role = await trustGroupsRepo.getRoleInGroup(groupId, currentUserId)
  if (role !== 'admin') {
    return { success: false, message: 'Solo el admin puede eliminar el grupo.' }
  }

  const ok = await trustGroupsRepo.deleteById(groupId)
  if (!ok) return { success: false, message: 'No se pudo eliminar el grupo.' }

  return { success: true, message: 'Grupo eliminado.' }
}

export const notifyGroupMembers = async (
  groupId: number,
  incidentId: number,
  userIdEmitter: number,
  message: string
): Promise<boolean> => {
  const members = (await trustGroupsRepo.listMembers(groupId))
    .filter(member => member.usuario_id !== userIdEmitter)
  if (members.length === 0) return false

  const memberUserIds = members.map((m) => m.usuario_id)
  return await notificationsRepo.notifyGroupMembers(
    groupId,
    incidentId,
    userIdEmitter,
    message,
    memberUserIds
  )
}

export const getUnreadNotifications = async (userId: number) => {
  return await trustGroupsRepo.listPendingInvitationsForUser(userId)
}

// Alias compatible: una sola implementación para marcar notificaciones de grupo.
export { markGroupNotificationRead as markNotificationAsRead } from './notificationService'
