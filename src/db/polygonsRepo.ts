import { supabase } from './supabaseClient'
import type { Tables } from '../types/database'

export type Zona = Tables<'zonas'>

export interface CoordinatesPoint {
  lat: number
  lng: number
}

export interface ZonePolygon {
  id: number
  nombre: string
  descripcion?: string
  coordenadas: CoordinatesPoint[]
  color: string
  zona_tipo?: string
  campus?: string
}

const mapRow = (row: Zona): ZonePolygon => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion ?? undefined,
  coordenadas: (row.coordenadas as unknown as CoordinatesPoint[]) ?? [],
  color: row.color,
  zona_tipo: row.zona_tipo ?? undefined,
  campus: row.campus ?? undefined,
})

export const polygonsRepo = {
  async listByCampus(campus: string): Promise<ZonePolygon[]> {
    const { data, error } = await supabase
      .from('zonas')
      .select('*')
      .eq('campus', campus)
      .order('id', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapRow)
  },

  async findById(id: number): Promise<ZonePolygon | null> {
    const { data, error } = await supabase
      .from('zonas')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? mapRow(data) : null
  },
}