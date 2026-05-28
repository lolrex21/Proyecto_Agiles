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
}

export function useEmergencySocket({
  role,
  userId,
  onNewIncident,
  onIncidentTaken,
  onIncidentClosed,
  onGuardBusy,
}: UseEmergencySocketParams) {
  const handlersRef = useRef({
    onNewIncident,
    onIncidentTaken,
    onIncidentClosed,
    onGuardBusy,
  })

  useEffect(() => {
    handlersRef.current = {
      onNewIncident,
      onIncidentTaken,
      onIncidentClosed,
      onGuardBusy,
    }
  }, [onNewIncident, onIncidentTaken, onIncidentClosed, onGuardBusy])

  useEffect(() => {
    if (!userId) return

    emergencySocket.connect(role, String(userId))

    const unsubscribe = emergencySocket.subscribe((message) => {
      const {
        onNewIncident,
        onIncidentTaken,
        onIncidentClosed,
        onGuardBusy,
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

        default:
          break
      }
    })

    return () => {
      unsubscribe()
    }
  }, [role, userId])
}