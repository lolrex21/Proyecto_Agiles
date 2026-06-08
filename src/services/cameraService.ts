import { supabase } from './supabaseClient'
import type { Camera } from '../types/camera'

export const getCameras = async (): Promise<Camera[]> => {
  console.log('[CAMERA_SERVICE] Fetching cameras from Supabase...')

  const { data, error } = await supabase
    .from('camaras')
    .select('id, nombre, latitud, longitud, estado_conectividad, fecha_instalacion, created_at')
    .order('nombre', { ascending: true })

  console.log('[CAMERA_SERVICE] Supabase response:', { data, error })

  if (error) {
    console.error('[CAMERA_SERVICE] Supabase Fetch Error:', error)
    return []
  }

  if (!data || data.length === 0) {
    console.warn('[CAMERA_SERVICE] No cameras found in database')
    return []
  }

  console.log('[CAMERA_SERVICE] Raw camera data:', data)

  return data.map((row: any) => ({
    id: row.id,
    nombre: row.nombre,
    latitud: Number(row.latitud),
    longitud: Number(row.longitud),
    estado_conectividad: row.estado_conectividad,
    fecha_instalacion: row.fecha_instalacion,
    created_at: row.created_at,
  }))
}

export const createCamera = async (data: {
  nombre: string
  latitud: number
  longitud: number
}): Promise<boolean> => {
  const { error } = await supabase
    .from('camaras')
    .insert({
      nombre: data.nombre.trim(),
      latitud: data.latitud,
      longitud: data.longitud,
      estado_conectividad: 'Activa',
    })

  if (error) {
    console.error('[CAMERA_SERVICE] Create error:', error)
    return false
  }

  return true
}

export const updateCamera = async (
  id: number,
  updates: { nombre?: string; estado_conectividad?: 'Activa' | 'Inactiva' }
): Promise<boolean> => {
  const { error } = await supabase
    .from('camaras')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('[CAMERA_SERVICE] Update error:', error)
    return false
  }

  return true
}

export const deleteCamera = async (id: number): Promise<boolean> => {
  const { error } = await supabase
    .from('camaras')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[CAMERA_SERVICE] Delete error:', error)
    return false
  }

  return true
}
