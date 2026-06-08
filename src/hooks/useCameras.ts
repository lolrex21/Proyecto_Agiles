import { useState, useEffect, useCallback } from 'react'
import { getCameras } from '../services/cameraService'
import type { Camera } from '../types/camera'

export function useCameras() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCameras = useCallback(async () => {
    console.log('[USE_CAMERAS] Fetching cameras...')
    setLoading(true)
    const data = await getCameras()
    setCameras(data)
    setLoading(false)
    console.log('[USE_CAMERAS] cameras.length:', data.length)
  }, [])

  useEffect(() => {
    fetchCameras()
  }, [fetchCameras])

  return { cameras, loading, refetch: fetchCameras }
}
