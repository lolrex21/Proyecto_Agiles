import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCurrentUser, logout } from '../../services/authService'
import NotificationBell from '../NotificationBell'
import './Header.css'

type GuardNotificationsConfig = {
  enabled: boolean
  isOnDuty?: boolean
  pendingCount: number
  takenIncident: any | null
  onToggleDuty?: () => void | Promise<void>
  onOpenTakenIncident?: (incident: any) => void
}

type HeaderProps = {
  guardNotifications?: GuardNotificationsConfig
}

export default function Header({ guardNotifications }: HeaderProps) {
  const user = getCurrentUser()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [changingDuty, setChangingDuty] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const userBadgeButtonRef = useRef<HTMLButtonElement | null>(null)

  const handleLogout = async () => {
    await logout()
    window.location.replace('/')
  }

  const handleToggleDuty = async () => {
    if (!guardNotifications?.onToggleDuty) return

    try {
      setChangingDuty(true)
      await guardNotifications.onToggleDuty()
      setIsUserMenuOpen(false)
    } finally {
      setChangingDuty(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const userName = user?.nombre || user?.name || 'Usuario'
  const userRole = user?.rol || user?.role || user?.tipo_usuario || 'estudiante'

  const isGuard = /guardia|guard/i.test(userRole)
  const isAdmin = /admin|administrador/i.test(userRole)

  const roleLabel = isGuard
    ? 'Guardia'
    : isAdmin
    ? 'Admin'
    : 'Usuario'

  return (
    <header className="app-header">
      <div className="app-header-container">
        <div className="brand-section">
          <div className="brand-icon">
            <span>🛡️</span>
          </div>

          <div className="brand-copy">
            <h1 className="brand-title">UTA CampusSeguro</h1>
            <p className="brand-subtitle">Sistema de alertas universitarias</p>
          </div>
        </div>

        <div className="header-actions">
          {!isAdmin && (
            <div className="notification-slot">
              <NotificationBell guardNotifications={guardNotifications} />
            </div>
          )}

          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              ref={userBadgeButtonRef}
              type="button"
              className={`user-badge ${isUserMenuOpen ? 'user-badge-open' : ''}`}
              onClick={() => setIsUserMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
            >
              <div className="user-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>

              <div className="user-badge-text">
                <span className="user-role">{roleLabel}</span>
                <strong className="user-fullname">{userName}</strong>
              </div>

              <span className={`user-menu-arrow ${isUserMenuOpen ? 'open' : ''}`}>
                ▾
              </span>
            </button>

            {isUserMenuOpen &&
  createPortal(
    <div
      className="user-menu-portal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setIsUserMenuOpen(false)
        }
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.stopPropagation()
        }
      }}
    >
      <div
        className="user-menu-bubble user-menu-bubble-portal"
        role="menu"
        style={
          userBadgeButtonRef.current
            ? {
                top: `${userBadgeButtonRef.current.getBoundingClientRect().bottom + 10}px`,
                right: `${Math.max(
                  window.innerWidth -
                    userBadgeButtonRef.current.getBoundingClientRect().right,
                  12
                )}px`,
              }
            : undefined
        }
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {guardNotifications?.enabled && (
          <div className="user-menu-duty-box">
            <span className="user-menu-duty-label">
              Estado de servicio
            </span>

            <strong
              className={
                guardNotifications.isOnDuty
                  ? 'user-menu-duty-status on'
                  : 'user-menu-duty-status off'
              }
            >
              {guardNotifications.isOnDuty
                ? 'En servicio'
                : 'Fuera de servicio'}
            </strong>

            <button
              type="button"
              className={
                guardNotifications.isOnDuty
                  ? 'user-menu-duty-action off'
                  : 'user-menu-duty-action on'
              }
              onClick={(event) => {
                event.stopPropagation()
                void handleToggleDuty()
              }}
              disabled={changingDuty}
            >
              {changingDuty
                ? 'Actualizando...'
                : guardNotifications.isOnDuty
                ? 'Informar fuera de servicio'
                : 'Entrar en servicio'}
            </button>
          </div>
        )}

        <button
          type="button"
          className="user-menu-logout"
          onClick={(event) => {
            event.stopPropagation()
            void handleLogout()
          }}
          role="menuitem"
        >
          <span>🚪</span>
          <strong>Cerrar sesión</strong>
        </button>
      </div>
    </div>,
    document.body
  )}
          </div>
        </div>
      </div>
    </header>
  )
}