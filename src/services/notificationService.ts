import { notificationsRepo } from '../db/notificationsRepo'
import { trustGroupsRepo } from '../db/trustGroupsRepo'
import { usersRepo } from '../db/usersRepo'
import type {
  GeneralNotification,
  GroupNotification,
  GroupRequest,
  NotificationSummary,
} from '../types/trustGroup'

export const getUserGeneralNotifications = async (
  userId: number
): Promise<GeneralNotification[]> => {
  try {
    const rows = await notificationsRepo.listForUser(userId)
    return rows.map((row) => ({
      id: row.id,
      usuario_id: row.usuario_id,
      incidente_id: row.incidente_id ?? 0,
      mensaje: row.mensaje,
      leido: row.leido,
      fecha: row.fecha,
    }))
  } catch (error) {
    console.error('Error al obtener notificaciones generales:', error)
    return []
  }
}

const getUserGroupIds = async (userId: number): Promise<number[]> => {
  try {
    return await trustGroupsRepo.getGroupIdsForUser(userId)
  } catch (error) {
    console.error('Error al obtener grupos de usuario:', error)
    return []
  }
}

export const getUserGroupNotifications = async (
  userId: number
): Promise<GroupNotification[]> => {
  try {
    const grupoIds = await getUserGroupIds(userId)
    if (grupoIds.length === 0) return []
    return await notificationsRepo.listForGroups(grupoIds, userId)
  } catch (error) {
    console.error('Error al obtener notificaciones de grupo:', error)
    return []
  }
}

export const getPendingInvitesForUser = async (
  userId: number
): Promise<GroupRequest[]> => {
  try {
    const requests = await trustGroupsRepo.listPendingInvitationsForUser(userId)
    if (requests.length === 0) return []

    const grupoIds = requests.map((request) => request.grupo_id)
    const solicitanteIds = requests.map((request) => request.usuario_solicitante_id)

    const [groups, users] = await Promise.all([
      trustGroupsRepo.findManyByIdSimple(grupoIds),
      usersRepo.findByIds(solicitanteIds),
    ])

    const groupMap = new Map(groups.map((group) => [group.id, group]))
    const userMap = new Map(users.map((user) => [user.id, user]))

    return requests.map((request) => ({
      id: request.id,
      grupo_id: request.grupo_id,
      usuario_invitado_id: userId,
      usuario_solicitante_id: request.usuario_solicitante_id,
      estado: 'pendiente',
      mensaje: request.mensaje ?? undefined,
      created_at: request.created_at,
      grupo_nombre: groupMap.get(request.grupo_id)?.nombre,
      solicitante_nombre: userMap.get(request.usuario_solicitante_id)?.nombre,
    }))
  } catch (error) {
    console.error('Error al obtener solicitudes de grupo:', error)
    return []
  }
}

export const getNotificationSummary = async (
  userId: number
): Promise<NotificationSummary> => {
  try {
    const grupoIds = await getUserGroupIds(userId)
    const [unreadGeneral, unreadGroup, pendingInvites] = await Promise.all([
      notificationsRepo.countUnreadForUser(userId),
      grupoIds.length > 0
        ? notificationsRepo.countUnreadForGroups(grupoIds, userId)
        : Promise.resolve(0),
      trustGroupsRepo.listPendingInvitationsForUser(userId).then((rows) => rows.length),
    ])

    return {
      pendingInvites,
      unreadGeneral,
      unreadGroup,
    }
  } catch (error) {
    console.error('Error al obtener resumen de notificaciones:', error)
    return { pendingInvites: 0, unreadGeneral: 0, unreadGroup: 0 }
  }
}

export const markGeneralNotificationRead = async (
  notificationId: number
): Promise<boolean> => {
  try {
    return await notificationsRepo.markGeneralRead(notificationId)
  } catch (error) {
    console.error('Error al marcar notificación general como leída:', error)
    return false
  }
}

export const markGroupNotificationRead = async (
  notificationId: number
): Promise<boolean> => {
  try {
    return await notificationsRepo.markGroupRead(notificationId)
  } catch (error) {
    console.error('Error al marcar notificación de grupo como leída:', error)
    return false
  }
}

export const subscribeToNotificationChannels = (
  userId: number,
  callback: () => void
): { unsubscribe: () => Promise<void> } => {
  return notificationsRepo.subscribeToUserNotifications(userId, callback)
}