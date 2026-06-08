import { useEffect, useRef } from 'react'
import { emergencySocket } from '../services/emergencySocket'

type Role = 'guard' | 'affected'

type SocketPayload = {
  type: string
  [key: string]: any
}

type UseEmergencySocketParams = {
  role: Role
  userId: string
  onNewIncident?: (incident: any) => void
  onIncidentTaken?: (payload: SocketPayload) => void
  onIncidentClosed?: (payload: SocketPayload) => void
  onGuardBusy?: (payload: SocketPayload) => void
  onIncidentUpdated?: (payload: SocketPayload) => void
  onTrustedGroupAlert?: (payload: SocketPayload) => void
}

export function useEmergencySocket({
  role,
  userId,
  onNewIncident,
  onIncidentTaken,
  onIncidentClosed,
  onGuardBusy,
  onIncidentUpdated,
  onTrustedGroupAlert,
}: UseEmergencySocketParams) {
  const handlersRef = useRef({
    onNewIncident,
    onIncidentTaken,
    onIncidentClosed,
    onGuardBusy,
    onIncidentUpdated,
    onTrustedGroupAlert,
  })

  useEffect(() => {
    handlersRef.current = {
      onNewIncident,
      onIncidentTaken,
      onIncidentClosed,
      onGuardBusy,
      onIncidentUpdated,
      onTrustedGroupAlert,
    }
  }, [onNewIncident, onIncidentTaken, onIncidentClosed, onGuardBusy, onIncidentUpdated, onTrustedGroupAlert])

  useEffect(() => {
    if (!userId) return

    emergencySocket.connect(role, String(userId))

    const unsubscribe = emergencySocket.subscribe((message) => {
      const {
        onNewIncident,
        onIncidentTaken,
        onIncidentClosed,
        onGuardBusy,
        onIncidentUpdated,
      } = handlersRef.current

      switch (message.type) {
        case 'NEW_INCIDENT':
          onNewIncident?.(message.incident)
          break

        case 'INCIDENT_TAKEN':
          onIncidentTaken?.(message)
          break

        case 'INCIDENT_CLOSED':
          onIncidentClosed?.(message)
          break

        case 'GUARD_BUSY':
          onGuardBusy?.(message)
          break

        case 'INCIDENT_UPDATED':
          onIncidentUpdated?.(message)
          break

        case 'TRUSTED_GROUP_ALERT':
          onTrustedGroupAlert?.(message)
          break

        default:
          break
      }
    })

    return () => {
      unsubscribe()
    }
  }, [role, userId])
}