import { supabase } from './supabaseClient'
import type { Incident } from '../types/incident'

// Relación con zonas reutilizable en los selects
const INCIDENT_SELECT = `
  *,
  usuario:usuarios(nombre),
  zona:zonas(id,nombre,zona_tipo,campus)
`

// Normaliza un tipo de incidente: minúsculas y sin acentos
export const normalizeIncidentType = (tipo?: string): string => {
  if (!tipo) return ''
  return tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Obtener todos los incidentes
export const getIncidents = async (): Promise<Incident[]> => {
  const { data, error } = await supabase
    .from('incidentes')
    .select(INCIDENT_SELECT)
    .order('id', { ascending: false })

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
    .select(INCIDENT_SELECT)
    .eq('estado', status)
    .order('id', { ascending: false })

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
    .select(INCIDENT_SELECT)
    .or(`tipo_incidente.ilike.%${query}%,descripcion.ilike.%${query}%`)
    .order('id', { ascending: false })

  if (error) return []
  return data || []
}

// ─────────────────────────────────────────────────────────────
// A-10: Filtro de estadísticas por tipo, zona, fecha y estado.
// Construye la consulta directamente en Supabase/PostgreSQL.
// ─────────────────────────────────────────────────────────────
export interface IncidentQueryFilters {
  fechaDesde?: string // 'YYYY-MM-DD'
  fechaHasta?: string // 'YYYY-MM-DD'
  tipo?: string // 'robo' | 'pelea' | 'accidente' | 'otro' | ...
  zonaId?: string | number
  estado?: string // 'Pendiente' | 'Atendido' | 'Cerrado'
  texto?: string // lugar específico / descripción / zona
}

export const getFilteredIncidents = async (
  filters: IncidentQueryFilters = {}
): Promise<Incident[]> => {
  let query = supabase
    .from('incidentes')
    .select(INCIDENT_SELECT)
    .order('id', { ascending: false })

  // Fecha desde / hasta. Incluimos todo el día final hasta las 23:59:59.
  if (filters.fechaDesde) {
    query = query.gte('fecha', `${filters.fechaDesde}T00:00:00`)
  }
  if (filters.fechaHasta) {
    query = query.lte('fecha', `${filters.fechaHasta}T23:59:59`)
  }

  // Tipo de incidente normalizado (minúscula sin acentos)
  const tipo = normalizeIncidentType(filters.tipo)
  if (tipo) {
    query = query.eq('tipo_incidente', tipo)
  }

  // Zona del campus
  if (filters.zonaId !== undefined && filters.zonaId !== null && `${filters.zonaId}` !== '') {
    query = query.eq('zona_id', Number(filters.zonaId))
  }

  // Estado
  if (filters.estado) {
    query = query.eq('estado', filters.estado)
  }

  // Lugar específico: busca en la descripción del incidente.
  const texto = filters.texto?.trim()
  if (texto) {
    query = query.ilike('descripcion', `%${texto}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error filtrando incidentes:', error)
    return []
  }

  return data || []
}