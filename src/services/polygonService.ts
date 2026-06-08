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
// ============================================================
// A-12: PUESTOS DE GUARDIA
// ============================================================

export interface GuardPost {
  id: number
  nombre: string
  descripcion?: string
  lat: number
  lng: number
}

// Coordenadas hardcodeadas como respaldo rápido
// (también se cargan de Supabase vía getGuardPostsFromDB)
export const GUARD_POSTS_LOCAL: GuardPost[] = [
  { id: 1, nombre: 'Puesto de Guardia 1 – Entrada Principal',  lat: -1.270662, lng: -78.624326 },
  { id: 2, nombre: 'Puesto de Guardia 2 – Facultad Ingeniería', lat: -1.268654, lng: -78.625860 },
  { id: 3, nombre: 'Puesto de Guardia 3 – Zona Central',        lat: -1.268250, lng: -78.625761 },
  { id: 4, nombre: 'Puesto de Guardia 4 – Campus Occidental',   lat: -1.266477, lng: -78.644764 },
]

/** Carga los puestos de guardia desde Supabase (zona_tipo = 'puesto_guardia').
 *  Cada registro tiene coordenadas = [{"lat": X, "lng": Y}] — un solo punto. */
export const getGuardPostsFromDB = async (): Promise<GuardPost[]> => {
  try {
    const { data, error } = await supabase
      .from('zonas')
      .select('id, nombre, descripcion, coordenadas')
      .eq('zona_tipo', 'puesto_guardia')
      .eq('campus', 'Huachi')

    if (error || !data || data.length === 0) {
      // Fallback: usar las coordenadas locales si la BD aún no tiene datos
      return GUARD_POSTS_LOCAL
    }

    return data.map((z: any) => {
      // coordenadas[0] es el punto exacto del puesto
      const point = z.coordenadas?.[0] ?? { lat: 0, lng: 0 }
      return {
        id:          z.id,
        nombre:      z.nombre,
        descripcion: z.descripcion,
        lat:         Number(point.lat),
        lng:         Number(point.lng),
      }
    })
  } catch {
    return GUARD_POSTS_LOCAL
  }
}

/** Calcula el centroide de un polígono (para pan/zoom al hacer clic) */
export const getPolygonCenter = (
  coords: CoordinatesPoint[]
): CoordinatesPoint => {
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length
  return { lat, lng }
}