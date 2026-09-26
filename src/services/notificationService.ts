import { notificationsRepo } from '../db/notificationsRepo'
import { trustGroupsRepo } from '../db/trustGroupsRepo'
import { usersRepo } from '../db/usersRepo'
import { createNotificationService } from './createNotificationService'

export { createNotificationService } from './createNotificationService'

export const {
  getUserGeneralNotifications,
  getUserGroupNotifications,
  getPendingInvitesForUser,
  getNotificationSummary,
  markGeneralNotificationRead,
  markGroupNotificationRead,
  subscribeToNotificationChannels
} = createNotificationService({ notificationsRepo, trustGroupsRepo, usersRepo })
