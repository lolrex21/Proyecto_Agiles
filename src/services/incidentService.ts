import { supabase } from './supabaseClient'
import type { Incident } from '../types/incident'

// Obtener todos los incidentes
export const getIncidents = async (): Promise<Incident[]> => {
  const { data, error } = await supabase
    .from('incidentes')
    .select(`
      *,
      usuario:usuarios(nombre)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return []
  }
  return data || []
}

// Obtener incidentes por estado
export const getIncidentsByStatus = async (status: string): Promise<Incident[]> => {
  const { data, error } = await supabase
    .from('incidentes')
    .select(`
      *,
      usuario:usuarios(nombre)
    `)
    .eq('estado', status)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

// Actualizar estado
export const updateIncidentStatus = async (
  id: number,
  status: 'Pendiente' | 'Atendido' | 'Cerrado'
): Promise<boolean> => {
  const { error } = await supabase
    .from('incidentes')
    .update({ estado: status })
    .eq('id', id)

  return !error
}

// Buscar incidentes
export const searchIncidents = async (query: string): Promise<Incident[]> => {
  const { data, error } = await supabase
    .from('incidentes')
    .select(`
      *,
      usuario:usuarios(nombre)
    `)
    .or(`tipo_incidente.ilike.%${query}%,descripcion.ilike.%${query}%`)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}