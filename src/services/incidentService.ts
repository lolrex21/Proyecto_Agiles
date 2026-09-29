import { incidentsRepo, type Incidente } from '../db/incidentsRepo'
import type { Incident } from '../types/incident'

// Obtener todos los incidentes
export const getIncidents = async (): Promise<Incident[]> => {
  try {
    const rows = await incidentsRepo.listAll()
    return rows as unknown as Incident[]
  } catch (error) {
    console.error('Error:', error)
    return []
  }
}

// Obtener incidentes por estado
export const getIncidentsByStatus = async (
  status: 'Pendiente' | 'Atendido' | 'Cerrado' | 'Cancelado'
): Promise<Incident[]> => {
  try {
    const rows = await incidentsRepo.listByStatus(status)
    return rows as unknown as Incident[]
  } catch {
    return []
  }
}

// Actualizar estado
export const updateIncidentStatus = async (
  id: number,
  status: 'Pendiente' | 'Atendido' | 'Cerrado' | 'Cancelado'
): Promise<boolean> => {
  return incidentsRepo.updateStatus(id, status)
}

// Buscar incidentes
export const searchIncidents = async (query: string): Promise<Incident[]> => {
  try {
    const rows = await incidentsRepo.search(query)
    return rows as unknown as Incident[]
  } catch {
    return []
  }
}

export const getIncidentById = async (id: number): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.findById(id)
    return row ? (row as unknown as Incident) : null
  } catch (error) {
    console.error('Error in getIncidentById:', error)
    return null
  }
}

export const reportIncident = async (input: Omit<Incidente, 'id' | 'created_at' | 'updated_at'>): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.create(input as any)
    return row as unknown as Incident
  } catch (error) {
    console.error('Error reporting incident:', error)
    throw error
  }
}

export const updateIncidentDetails = async (id: number, changes: Partial<Incidente>): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.update(id, changes as any)
    return row as unknown as Incident
  } catch (error) {
    console.error('Error updating incident details:', error)
    throw error
  }
}

export const cancelIncident = async (id: number): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.update(id, { estado: 'Cancelado' })
    return row as unknown as Incident
  } catch (error) {
    console.error('Error cancelling incident:', error)
    throw error
  }
}

export const getActiveIncidentForGuard = async (guardId: string): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.findActiveForGuard(guardId)
    return row ? (row as unknown as Incident) : null
  } catch (error) {
    console.error('Error in getActiveIncidentForGuard:', error)
    return null
  }
}

export const takeIncident = async (incidentId: number, guardId: string): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.takeByGuard(incidentId, guardId)
    if (!row) return await getIncidentById(incidentId)
    return row as unknown as Incident
  } catch (error) {
    console.error('Error taking incident:', error)
    throw error
  }
}

export const closeIncident = async (incidentId: number, guardId: string): Promise<Incident | null> => {
  try {
    const row = await incidentsRepo.closeByGuard(incidentId, guardId)
    if (!row) return await getIncidentById(incidentId)
    return row as unknown as Incident
  } catch (error) {
    console.error('Error closing incident:', error)
    throw error
  }
}

export type { Incidente }
