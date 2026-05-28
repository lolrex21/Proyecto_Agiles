import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser } from '../services/authService'
import {
  getNotificationSummary,
  getPendingInvitesForUser,
  getUserGeneralNotifications,
  getUserGroupNotifications,
  markGeneralNotificationRead,
  markGroupNotificationRead,
  subscribeToNotificationChannels,
} from '../services/notificationService'
import { respondToGroupInvitation } from '../services/trustGroupService'
import NotificationPanel from './NotificationPanel'
import type { GeneralNotification, GroupNotification, GroupRequest } from '../types/trustGroup'

export default function NotificationBell() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [summary, setSummary] = useState({ pendingInvites: 0, unreadGeneral: 0, unreadGroup: 0 })
  const [pendingInvites, setPendingInvites] = useState<GroupRequest[]>([])
  const [generalNotifications, setGeneralNotifications] = useState<GeneralNotification[]>([])
  const [groupNotifications, setGroupNotifications] = useState<GroupNotification[]>([])
  const [loading, setLoading] = useState(true)

  const user = getCurrentUser()
  const userId = user?.id ? Number(user.id) : null

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    const [summaryResult, invites, general, group] = await Promise.all([
      getNotificationSummary(userId),
      getPendingInvitesForUser(userId),
      getUserGeneralNotifications(userId),
      getUserGroupNotifications(userId),
    ])

    setSummary(summaryResult)
    setPendingInvites(invites)
    setGeneralNotifications(general)
    setGroupNotifications(group)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return

    void loadNotifications()
    const subscription = subscribeToNotificationChannels(userId, () => {
      void loadNotifications()
    })

    return () => {
      void subscription.unsubscribe()
    }
  }, [loadNotifications, userId])

  const handleTogglePanel = () => {
    setPanelOpen(prev => !prev)
  }

  const handleClose = () => {
    setPanelOpen(false)
  }

  const handleRespondInvite = useCallback(
    async (requestId: number, accept: boolean) => {
      if (!userId) return
      await respondToGroupInvitation(requestId, userId, accept)
      await loadNotifications()
    },
    [loadNotifications, userId]
  )

  const handleMarkGeneralRead = useCallback(
    async (notificationId: number) => {
      await markGeneralNotificationRead(notificationId)
      await loadNotifications()
    },
    [loadNotifications]
  )

const handleMarkGroupRead = useCallback(
  async (notificationId: number) => {
    const ok = await markGroupNotificationRead(Number(notificationId))

    if (ok) {
      setGroupNotifications(prev =>
        prev.filter(item => Number(item.id) !== Number(notificationId))
      )

      setSummary(prev => ({
        ...prev,
        unreadGroup: Math.max(prev.unreadGroup - 1, 0),
      }))
    }

    await loadNotifications()
  },
  [loadNotifications]
)

  const unreadCount = useMemo(
    () => summary.pendingInvites + summary.unreadGeneral + summary.unreadGroup,
    [summary.pendingInvites, summary.unreadGeneral, summary.unreadGroup]
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleTogglePanel}
        className="relative rounded-full border border-white/30 bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.2rem] items-center justify-center rounded-full bg-uta-red px-1.5 text-[0.65rem] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {panelOpen && !loading && (
        <NotificationPanel
          pendingInvites={pendingInvites}
          generalNotifications={generalNotifications}
          groupNotifications={groupNotifications}
          onClose={handleClose}
          onRespondInvite={handleRespondInvite}
          onMarkGeneralRead={handleMarkGeneralRead}
          onMarkGroupRead={handleMarkGroupRead}
        />
      )}
    </div>
  )
}
