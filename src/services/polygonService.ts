import {
  polygonsRepo,
  type CoordinatesPoint,
  type ZonePolygon,
} from '../db/polygonsRepo'
import { incidentsRepo } from '../db/incidentsRepo'

export type { CoordinatesPoint, ZonePolygon }

// 📌 OBTENER TODAS LAS ZONAS DEL CAMPUS HUACHI
export const getZonePolygons = async (): Promise<ZonePolygon[]> => {
  try {
    return await polygonsRepo.listByCampus('Huachi')
  } catch (error) {
    console.error('Error fetching zones:', error)
    return []
  }
}

// 📌 OBTENER UNA ZONA ESPECÍFICA
export const getZoneById = async (id: number): Promise<ZonePolygon | null> => {
  try {
    return await polygonsRepo.findById(id)
  } catch (error) {
    console.error('Error fetching zone:', error)
    return null
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
    const zones = await polygonsRepo.listByCampus('Huachi')
    const point: CoordinatesPoint = { lat, lng }

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
  try {
    return await incidentsRepo.updateZone(incidentId, zoneId)
  } catch (error) {
    console.error('Error updating incident zone:', error)
    return false
  }
}