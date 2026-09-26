import type {
  GeneralNotification,
  GroupNotification,
  GroupRequest,
  NotificationSummary,
} from '../types/trustGroup'

import type { notificationsRepo as NotificationsRepo } from '../db/notificationsRepo'
import type { trustGroupsRepo as TrustGroupsRepo } from '../db/trustGroupsRepo'
import type { usersRepo as UsersRepo } from '../db/usersRepo'

export interface NotificationDependencies {
  notificationsRepo: Pick<typeof NotificationsRepo, 'listForUser' | 'listForGroups' | 'countUnreadForUser' | 'countUnreadForGroups' | 'markGeneralRead' | 'markGroupRead' | 'subscribeToUserNotifications'>
  trustGroupsRepo: Pick<typeof TrustGroupsRepo, 'getGroupIdsForUser' | 'listPendingInvitationsForUser' | 'findManyByIdSimple'>
  usersRepo: Pick<typeof UsersRepo, 'findByIds'>
}

export function createNotificationService({ notificationsRepo, trustGroupsRepo, usersRepo }: NotificationDependencies) {
const getUserGeneralNotifications = async (
  userId: number
): Promise<GeneralNotification[]> => {
  const rows = await notificationsRepo.listForUser(userId)
  return rows.map((row) => ({
    id: row.id,
    usuario_id: row.usuario_id,
    incidente_id: row.incidente_id ?? 0,
    mensaje: row.mensaje,
    leido: row.leido,
    fecha: row.fecha,
  }))
}

const getUserGroupIds = async (userId: number): Promise<number[]> => {
  return await trustGroupsRepo.getGroupIdsForUser(userId)
}

const getUserGroupNotifications = async (
  userId: number
): Promise<GroupNotification[]> => {
  const grupoIds = await getUserGroupIds(userId)
  if (grupoIds.length === 0) return []
  return await notificationsRepo.listForGroups(grupoIds, userId)
}

const getPendingInvitesForUser = async (
  userId: number
): Promise<GroupRequest[]> => {
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
}

const getNotificationSummary = async (
  userId: number
): Promise<NotificationSummary> => {
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
}

const markGeneralNotificationRead = async (
  notificationId: number
): Promise<boolean> => {
  return await notificationsRepo.markGeneralRead(notificationId)
}

const markGroupNotificationRead = async (
  notificationId: number
): Promise<boolean> => {
  return await notificationsRepo.markGroupRead(notificationId)
}

const subscribeToNotificationChannels = (
  userId: number,
  callback: () => void
): { unsubscribe: () => Promise<void> } => {
  return notificationsRepo.subscribeToUserNotifications(userId, callback)
}

  return { getUserGeneralNotifications, getUserGroupNotifications, getPendingInvitesForUser, getNotificationSummary, markGeneralNotificationRead, markGroupNotificationRead, subscribeToNotificationChannels }
}
