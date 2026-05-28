import { supabase } from './supabaseClient'

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

// 📌 OBTENER TODAS LAS ZONAS DEL CAMPUS HUACHI
export const getZonePolygons = async (): Promise<ZonePolygon[]> => {
  const { data, error } = await supabase
    .from('zonas')
    .select('*')
    .eq('campus', 'Huachi')
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching zones:', error)
    return []
  }

  return (data || []).map((zone: any) => ({
    id: zone.id,
    nombre: zone.nombre,
    descripcion: zone.descripcion,
    coordenadas: zone.coordenadas,
    color: zone.color,
    zona_tipo: zone.zona_tipo,
    campus: zone.campus,
  }))
}

// 📌 OBTENER UNA ZONA ESPECÍFICA
export const getZoneById = async (id: number): Promise<ZonePolygon | null> => {
  const { data, error } = await supabase
    .from('zonas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching zone:', error)
    return null
  }

  return {
    id: data.id,
    nombre: data.nombre,
    descripcion: data.descripcion,
    coordenadas: data.coordenadas,
    color: data.color,
    zona_tipo: data.zona_tipo,
    campus: data.campus,
  }
}

// 🎯 FUNCIÓN CRÍTICA: RAY CASTING - Saber si un punto está dentro de un polígono
export const isPointInPolygon = (
  point: CoordinatesPoint,
  polygon: CoordinatesPoint[]
): boolean => {
  const { lat, lng } = point
  let inside = false

  // Algoritmo Ray Casting
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

// 📍 FUNCIÓN PRINCIPAL: Determinar en qué zona está un incidente
export const getZoneByPoint = async (
  lat: number,
  lng: number
): Promise<ZonePolygon | null> => {
  try {
    const zones = await getZonePolygons()
    const point: CoordinatesPoint = { lat, lng }

    // Buscar en cuál zona está el punto
    for (const zone of zones) {
      if (isPointInPolygon(point, zone.coordenadas)) {
        console.log(`Incidente en: ${zone.nombre}`)
        return zone
      }
    }

    console.warn(`Punto (${lat}, ${lng}) no está en ninguna zona`)
    return null
  } catch (error) {
    console.error('Error getting zone by point:', error)
    return null
  }
}

// ⚠️ ACTUALIZAR ZONA DE INCIDENTE EN BD
export const updateIncidentZone = async (
  incidentId: number,
  zoneId: number
): Promise<boolean> => {
  const { error } = await supabase
    .from('incidentes')
    .update({ zona_id: zoneId })
    .eq('id', incidentId)

  if (error) {
    console.error('Error updating incident zone:', error)
    return false
  }
  return true
}