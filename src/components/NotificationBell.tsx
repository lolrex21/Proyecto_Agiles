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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const user = getCurrentUser()
  const userId = user?.id ? Number(user.id) : null

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      setError('')
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

    } catch {
      setError('No se pudieron actualizar las notificaciones. Revisa tu conexión.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    // Carga inicial asíncrona al suscribirse a la fuente externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setBusy(true)
      setError('')
      try {
        const result = await respondToGroupInvitation(requestId, userId, accept)
        if (!result.success) { setError(result.message); return }
        await loadNotifications()
      } catch {
        setError('No se pudo responder la invitación. Inténtalo de nuevo.')
      } finally { setBusy(false) }
    },
    [loadNotifications, userId]
  )

  const handleMarkGeneralRead = useCallback(
    async (notificationId: number) => {
      setBusy(true)
      setError('')
      try {
        if (!await markGeneralNotificationRead(notificationId)) {
          setError('No se encontró la notificación. Actualiza la lista.'); return
        }
        await loadNotifications()
      } catch { setError('No se pudo marcar la notificación como leída.') }
      finally { setBusy(false) }
    },
    [loadNotifications]
  )

const handleMarkGroupRead = useCallback(
  async (notificationId: number) => {
    setBusy(true)
    setError('')
    try {
      if (!await markGroupNotificationRead(notificationId)) {
        setError('No se encontró la notificación. Actualiza la lista.'); return
      }
      await loadNotifications()
    } catch { setError('No se pudo marcar la notificación como leída.') }
    finally { setBusy(false) }
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
        className="relative rounded-full border border-gray-200 bg-white p-2 text-uta-navy shadow-sm transition hover:bg-gray-50"      >
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

      {panelOpen && (
        <NotificationPanel
          loading={loading}
          error={error}
          busy={busy}
          onRetry={loadNotifications}
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
