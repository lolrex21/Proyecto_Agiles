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
    // Necesitamos usar supabase directamente aquí o agregarlo a incidentsRepo
    // Por simplicidad, importaremos supabase si no está en incidentsRepo, pero 
    // mejor lo llamamos vía incidentsRepo si es posible. Dado que incidentsRepo 
    // no tiene este método, lo haremos aquí temporalmente o podemos asumir que
    // implementaremos una consulta básica.
    const { supabase } = await import('../db/supabaseClient')
    const { data, error } = await supabase
      .from('incidentes')
      .select('*')
      .eq('guardia_id', guardId)
      .eq('estado', 'Atendido')
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data ? (data as unknown as Incident) : null
  } catch (error) {
    console.error('Error in getActiveIncidentForGuard:', error)
    return null
  }
}

export const takeIncident = async (incidentId: number, guardId: string): Promise<Incident | null> => {
  try {
    const { supabase } = await import('../db/supabaseClient')
    const { error: updateError } = await supabase
      .from('incidentes')
      .update({
        estado: 'Atendido',
        guardia_id: guardId,
      })
      .eq('id', incidentId)
      .eq('estado', 'Pendiente')

    if (updateError) throw updateError
    
    return await getIncidentById(incidentId)
  } catch (error) {
    console.error('Error taking incident:', error)
    throw error
  }
}

export const closeIncident = async (incidentId: number, guardId: string): Promise<Incident | null> => {
  try {
    const { supabase } = await import('../db/supabaseClient')
    const { error: closeError } = await supabase
      .from('incidentes')
      .update({ estado: 'Cerrado' })
      .eq('id', incidentId)
      .eq('guardia_id', guardId)
      .eq('estado', 'Atendido')

    if (closeError) throw closeError

    return await getIncidentById(incidentId)
  } catch (error) {
    console.error('Error closing incident:', error)
    throw error
  }
}

export type { Incidente }