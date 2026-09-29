import {
  polygonsRepo,
  type CoordinatesPoint,
  type ZonePolygon,
} from '../db/polygonsRepo'
import { incidentsRepo } from '../db/incidentsRepo'

export type { CoordinatesPoint, ZonePolygon }

/**
 * Obtiene todos los polígonos de zonas del Campus Huachi.
 */
export const getZonePolygons = async (): Promise<ZonePolygon[]> => {
  try {
    return await polygonsRepo.listByCampus('Huachi')
  } catch (error) {
    console.error('Error fetching zones:', error)
    return []
  }
}

/**
 * Obtiene una zona específica por su identificador.
 */
export const getZoneById = async (id: number): Promise<ZonePolygon | null> => {
  try {
    return await polygonsRepo.findById(id)
  } catch (error) {
    console.error('Error fetching zone:', error)
    return null
  }
}

/**
 * Ray Casting: algoritmo puro para determinar si un punto coordenado está contenido
 * dentro del límite de un polígono cerrado.
 */
export const isPointInPolygon = (
  point: CoordinatesPoint,
  polygon: CoordinatesPoint[]
): boolean => {
  const { lat, lng } = point
  let inside = false

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

/**
 * Búsqueda pura en memoria de la zona correspondiente a un punto para evitar llamadas N+1 a la red.
 */
export const findZoneByCoordinates = (
  point: CoordinatesPoint,
  zones: ZonePolygon[]
): ZonePolygon | null => {
  for (const zone of zones) {
    if (isPointInPolygon(point, zone.coordenadas)) {
      return zone
    }
  }
  return null
}

/**
 * Determina en qué zona se encuentra una coordenada geográfica.
 * Acepta zonas precargadas opcionales para evitar consultas redundantes a la base de datos.
 */
export const getZoneByPoint = async (
  lat: number,
  lng: number,
  preloadedZones?: ZonePolygon[]
): Promise<ZonePolygon | null> => {
  try {
    const point: CoordinatesPoint = { lat, lng }

    if (preloadedZones && preloadedZones.length > 0) {
      return findZoneByCoordinates(point, preloadedZones)
    }

    const zones = await getZonePolygons()
    return findZoneByCoordinates(point, zones)
  } catch (error) {
    console.error('Error getting zone by point:', error)
    return null
  }
}

/**
 * Actualiza la zona asignada a un incidente.
 */
export const updateIncidentZone = async (
  incidentId: number,
  zoneId: number
): Promise<boolean> => {
  try {
    return await incidentsRepo.updateZone(incidentId, zoneId)
  } catch (error) {
    console.error('Error updating incident zone:', error)
    return false
  }
}
