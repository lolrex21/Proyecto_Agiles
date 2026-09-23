import { supabase } from './supabaseClient'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export type Incidente = Tables<'incidentes'>
export type IncidenteInsert = TablesInsert<'incidentes'>
export type IncidenteUpdate = TablesUpdate<'incidentes'>

export type EstadoIncidente = 'Pendiente' | 'Atendido' | 'Cerrado' | 'Cancelado'

export type IncidenteConUsuario = Incidente & {
  usuario: { nombre: string } | null
}

export const incidentsRepo = {
  async listAll(): Promise<IncidenteConUsuario[]> {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*, usuario:usuarios(nombre)')
      .order('id', { ascending: false })

    if (error) throw error
    return (data ?? []) as IncidenteConUsuario[]
  },

  async listByStatus(status: EstadoIncidente): Promise<IncidenteConUsuario[]> {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*, usuario:usuarios(nombre)')
      .eq('estado', status)
      .order('id', { ascending: false })

    if (error) throw error
    return (data ?? []) as IncidenteConUsuario[]
  },

  async search(query: string): Promise<IncidenteConUsuario[]> {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*, usuario:usuarios(nombre)')
      .or(`tipo_incidente.ilike.%${query}%,descripcion.ilike.%${query}%`)
      .order('id', { ascending: false })

    if (error) throw error
    return (data ?? []) as IncidenteConUsuario[]
  },

  async findById(id: number): Promise<Incidente | null> {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async create(input: IncidenteInsert): Promise<Incidente> {
    const { data, error } = await supabase
      .from('incidentes')
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: number, changes: IncidenteUpdate): Promise<Incidente> {
    const { data, error } = await supabase
      .from('incidentes')
      .update(changes)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateStatus(id: number, status: EstadoIncidente): Promise<boolean> {
    const { error } = await supabase
      .from('incidentes')
      .update({ estado: status })
      .eq('id', id)

    return !error
  },

  async updateZone(incidentId: number, zoneId: number): Promise<boolean> {
    const { error } = await supabase
      .from('incidentes')
      .update({ zona_id: zoneId })
      .eq('id', incidentId)

    return !error
  },
}