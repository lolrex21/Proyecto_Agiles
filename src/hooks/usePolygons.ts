import { useState, useEffect } from 'react'
import {
  getZonePolygons,
  type ZonePolygon,
} from '../services/polygonService'

export const usePolygons = () => {
  const [zones, setZones] = useState<ZonePolygon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchZones()
  }, [])

  const fetchZones = async () => {
    try {
      setLoading(true)
      const data = await getZonePolygons()
      
      if (data.length === 0) {
        console.warn('No zones loaded. Check database.')
      }
      
      setZones(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching polygons:', err)
      setError('Error al cargar zonas del Campus Huachi')
    } finally {
      setLoading(false)
    }
  }

  return { zones, loading, error, refetch: fetchZones }
}