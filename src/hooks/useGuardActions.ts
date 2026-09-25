import { useState, useCallback, useEffect } from 'react'
import {
  getIncidentById,
  getActiveIncidentForGuard,
  takeIncident,
  closeIncident,
} from '../services/incidentService'
import { emergencySocket } from '../services/emergencySocket'

export function useGuardActions(guardId: string, setSelectedIncident: (incident: any) => void) {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([])
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null)
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)

  const sanitizeIncident = useCallback((incident: any) => {
    const { usuario, user, ...rest } = incident
    return rest
  }, [])

  const upsertLocalIncident = useCallback((incident: any) => {
    const cleanIncident = sanitizeIncident(incident)
    setActiveAlerts((prev) => {
      const incidentId = String(cleanIncident.id)
      const exists = prev.some((item) => String(item.id) === incidentId)

      if (exists) {
        return prev.map((item) => (String(item.id) === incidentId ? cleanIncident : item))
      }
      return [cleanIncident, ...prev]
    })
  }, [sanitizeIncident])

  const checkActiveIncidentForGuard = useCallback(async () => {
    if (!guardId) return
    try {
      const data = await getActiveIncidentForGuard(guardId)
      if (data) {
        setCurrentIncidentId(String(data.id))
        upsertLocalIncident(data)
      } else {
        setCurrentIncidentId(null)
      }
    } catch (error) {
      console.error('No se pudo verificar el caso activo del guardia:', error)
    }
  }, [guardId, upsertLocalIncident])

  useEffect(() => {
    checkActiveIncidentForGuard()
  }, [checkActiveIncidentForGuard])

  const handleTakeIncident = useCallback(
    async (incident: any): Promise<boolean> => {
      if (!guardId) {
        alert('No se encontró el ID del guardia logueado.')
        return false
      }

      const incidentId = Number(incident.id)
      const incidentIdText = String(incident.id)

      if (!incident.id || Number.isNaN(incidentId)) {
        alert('El incidente no tiene un ID válido.')
        return false
      }

      if (incident.estado !== 'Pendiente') {
        alert(`Este incidente ya fue tomado o cerrado. Estado actual: ${incident.estado}`)
        return false
      }

      try {
        const activeIncident = await getActiveIncidentForGuard(guardId)
        if (activeIncident && String(activeIncident.id) !== incidentIdText) {
          setCurrentIncidentId(String(activeIncident.id))
          upsertLocalIncident(activeIncident)
          alert(`Ya tienes un caso activo. Debes cerrar el incidente #${activeIncident.id} antes de tomar otro.`)
          return false
        }

        const existingIncident = await getIncidentById(incidentId)
        if (!existingIncident) {
          alert(`No existe ningún incidente con id ${incidentId}.`)
          return false
        }

        if (existingIncident.estado !== 'Pendiente') {
          alert(`No se puede tomar este incidente porque su estado actual es "${existingIncident.estado}".`)
          return false
        }

        const updatedIncident = await takeIncident(incidentId, guardId)
        if (!updatedIncident || updatedIncident.estado !== 'Atendido' || String(updatedIncident.guardia_id) !== guardId) {
          alert('No se pudo confirmar la actualización del incidente.')
          return false
        }

        setCurrentIncidentId(incidentIdText)
        upsertLocalIncident(updatedIncident)
        setSelectedIncident(updatedIncident)

        emergencySocket.takeIncident(incidentIdText, guardId, updatedIncident)
        emergencySocket.updateIncident(incidentIdText, 'Atendido', guardId)

        return true
      } catch (error) {
        console.error('Error tomando incidente:', error)
        alert('No se pudo tomar el incidente.')
        return false
      }
    },
    [guardId, setSelectedIncident, upsertLocalIncident]
  )

  const handleCloseIncident = useCallback(
    async (incident: any): Promise<boolean> => {
      if (!guardId) {
        alert('No se encontró el ID del guardia logueado.')
        return false
      }

      const incidentId = Number(incident.id)
      const incidentIdText = String(incident.id)

      if (!incident.id || Number.isNaN(incidentId)) {
        alert('El incidente no tiene un ID válido.')
        return false
      }

      if (incident.estado !== 'Atendido') {
        alert('Solo puedes cerrar un caso que esté Atendido.')
        return false
      }

      if (String(incident.guardia_id) !== guardId) {
        alert('Solo el guardia que tomó este caso puede cerrarlo.')
        return false
      }

      try {
        const closedIncident = await closeIncident(incidentId, guardId)
        if (!closedIncident || closedIncident.estado !== 'Cerrado') {
          alert('No se pudo confirmar el cierre del incidente.')
          return false
        }

        setCurrentIncidentId(null)
        upsertLocalIncident(closedIncident)
        setSelectedIncident(closedIncident)

        emergencySocket.closeIncident(incidentIdText, guardId, 'Caso cerrado', closedIncident)
        emergencySocket.updateIncident(incidentIdText, 'Cerrado', guardId)

        return true
      } catch (error) {
        console.error('Error cerrando incidente:', error)
        alert('No se pudo cerrar el incidente.')
        return false
      }
    },
    [guardId, setSelectedIncident, upsertLocalIncident]
  )

  return {
    activeAlerts,
    currentIncidentId,
    confirmCloseId,
    setConfirmCloseId,
    setCurrentIncidentId,
    upsertLocalIncident,
    sanitizeIncident,
    handleTakeIncident,
    handleCloseIncident,
  }
}
