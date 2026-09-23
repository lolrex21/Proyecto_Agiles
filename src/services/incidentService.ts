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

export type { Incidente }