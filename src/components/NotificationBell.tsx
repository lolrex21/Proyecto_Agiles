import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import type {
  GeneralNotification,
  GroupNotification,
  GroupRequest,
} from '../types/trustGroup'

type GuardNotificationsConfig = {
  enabled: boolean
  pendingCount: number
  takenIncident: any | null
  onOpenTakenIncident?: (incident: any) => void
}

type NotificationBellProps = {
  guardNotifications?: GuardNotificationsConfig
}

export default function NotificationBell({ guardNotifications }: NotificationBellProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [summary, setSummary] = useState({
    pendingInvites: 0,
    unreadGeneral: 0,
    unreadGroup: 0,
  })
  const [pendingInvites, setPendingInvites] = useState<GroupRequest[]>([])
  const [generalNotifications, setGeneralNotifications] = useState<GeneralNotification[]>([])
  const [groupNotifications, setGroupNotifications] = useState<GroupNotification[]>([])
  const [loading, setLoading] = useState(true)
  const bellButtonRef = useRef<HTMLButtonElement | null>(null)

  const isMountedRef = useRef(true)
  const user = getCurrentUser()
  const userId = user?.id ? Number(user.id) : null

  const isGuardMode = Boolean(guardNotifications?.enabled)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    if (isGuardMode) {
      setLoading(false)
      return
    }

    if (!userId) {
      if (isMountedRef.current) {
        setLoading(false)
      }
      return
    }

    try {
      if (isMountedRef.current) {
        setLoading(true)
      }

      const [summaryResult, invites, general, group] = await Promise.all([
        getNotificationSummary(userId),
        getPendingInvitesForUser(userId),
        getUserGeneralNotifications(userId),
        getUserGroupNotifications(userId),
      ])

      if (!isMountedRef.current) return

      setSummary(summaryResult)
      setPendingInvites(invites)
      setGeneralNotifications(general)
      setGroupNotifications(group)
    } catch (error) {
      console.error('[NOTIFICATION_BELL] Error cargando notificaciones:', error)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [userId, isGuardMode])

  useEffect(() => {
    if (isGuardMode) return
    if (!userId) return

    let isSubscribed = true

    void loadNotifications()

    const subscription = subscribeToNotificationChannels(userId, () => {
      if (isSubscribed) {
        void loadNotifications()
      }
    })

    return () => {
      isSubscribed = false
      void subscription.unsubscribe()
    }
  }, [loadNotifications, userId, isGuardMode])

  const handleTogglePanel = () => {
    setPanelOpen((prev) => !prev)
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
        setGroupNotifications((prev) =>
          prev.filter((item) => Number(item.id) !== Number(notificationId))
        )

        setSummary((prev) => ({
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

  const pendingCount = guardNotifications?.pendingCount ?? 0
const takenIncident = guardNotifications?.takenIncident ?? null
const guardBadgeCount = pendingCount + (takenIncident ? 1 : 0)

const guardNotificationPanel =
  panelOpen && isGuardMode
    ? createPortal(
        <div
          className="guard-notification-portal-backdrop"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="guard-notification-portal-panel"
            style={
              bellButtonRef.current
                ? {
                    top: `${bellButtonRef.current.getBoundingClientRect().bottom + 10}px`,
                    right: `${Math.max(
                      window.innerWidth -
                        bellButtonRef.current.getBoundingClientRect().right,
                      12
                    )}px`,
                  }
                : undefined
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                    Incidentes pendientes
                  </span>

                  <strong className="mt-1 block text-3xl leading-none text-uta-navy">
                    {pendingCount}
                  </strong>
                </div>

                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[0.68rem] font-black text-uta-red">
                  Pendientes
                </span>
              </div>
            </div>

            <div className="mt-2 rounded-xl bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="block text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                  Caso tomado
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${
                    takenIncident
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {takenIncident ? 'En atención' : 'Sin caso'}
                </span>
              </div>

              {takenIncident ? (
                <button
                  type="button"
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:bg-gray-50"
                  onClick={() => {
                    guardNotifications?.onOpenTakenIncident?.(takenIncident)
                    setPanelOpen(false)
                  }}
                >
                  <strong className="block text-sm leading-tight text-uta-navy">
                    #{takenIncident.id} · {takenIncident.tipo_incidente || 'Incidente'}
                  </strong>

                  <span className="mt-1 block text-xs leading-snug text-slate-600">
                    {takenIncident.zona?.nombre ||
                      takenIncident.ubicacion ||
                      'Ubicación no especificada'}
                  </span>

                  <small className="mt-1 block text-[0.7rem] font-bold text-uta-red">
                    Estado: {takenIncident.estado || 'Atendido'}
                  </small>
                </button>
              ) : (
                <p className="m-0 text-xs leading-snug text-slate-500">
                  Todavía no has tomado ningún caso.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null

 if (isGuardMode) {
  return (
    <div className="relative">
      <button
        ref={bellButtonRef}
        type="button"
        onClick={handleTogglePanel}
        className="relative rounded-full border border-gray-200 bg-white p-2 text-uta-navy shadow-sm transition hover:bg-gray-50"
        aria-label="Abrir notificaciones de guardia"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>

        {guardBadgeCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.2rem] items-center justify-center rounded-full bg-uta-red px-1.5 text-[0.65rem] font-bold text-white">
            {guardBadgeCount}
          </span>
        )}
      </button>

      {guardNotificationPanel}
    </div>
  )
}

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleTogglePanel}
        className="relative rounded-full border border-gray-200 bg-white p-2 text-uta-navy shadow-sm transition hover:bg-gray-50"
        aria-label="Abrir notificaciones"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
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
        <div className="notification-bubble-responsive">
    <div className="notification-bubble-arrow" />
        <NotificationPanel
          pendingInvites={pendingInvites}
          generalNotifications={generalNotifications}
          groupNotifications={groupNotifications}
          onClose={handleClose}
          onRespondInvite={handleRespondInvite}
          onMarkGeneralRead={handleMarkGeneralRead}
          onMarkGroupRead={handleMarkGroupRead}
        />
         </div>
      )}
    </div>
  )
}