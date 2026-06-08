import { useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

// ─── Tipos ────────────────────────────────────────────────────
export interface UserLocation {
  lat: number
  lng: number
  accuracy?: number  // metros de precisión
}

export type LocationStatus =
  | 'idle'      // nunca se ha solicitado
  | 'loading'   // esperando respuesta del navegador
  | 'success'   // ubicación obtenida
  | 'denied'    // usuario negó el permiso
  | 'error'     // otro error (timeout, no disponible)

// ─── Hook ─────────────────────────────────────────────────────
export const useUserLocation = () => {
  const [location,  setLocation]  = useState<UserLocation | null>(null)
  const [status,    setStatus]    = useState<LocationStatus>('idle')
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)

  // Referencia al watchId para poder cancelar el seguimiento continuo
  const watchIdRef = useRef<number | null>(null)

  // ── A-18.2: Solicitar ubicación puntual ──────────────────────
  const requestLocation = useCallback(async () => {
    setStatus('loading')
    setErrorMsg(null)

    // Camino nativo (APK): usa el plugin de Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions()
        if (perm.location === 'denied') {
          setStatus('denied')
          setErrorMsg('Permiso de ubicación denegado. Actívalo en los ajustes del teléfono.')
          return
        }

        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        })

        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus('success')
      } catch {
        setStatus('error')
        setErrorMsg('No se pudo obtener la ubicación. Verifica el GPS y los permisos.')
      }
      return
    }

    // Camino web (navegador): tu lógica original
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMsg('Tu navegador no soporta geolocalización.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus('success')
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setStatus('denied')
          setErrorMsg('Permiso de ubicación denegado. Actívalo en la configuración del navegador.')
        } else if (err.code === GeolocationPositionError.TIMEOUT) {
          setStatus('error')
          setErrorMsg('Tiempo de espera agotado al obtener la ubicación. Inténtalo de nuevo.')
        } else {
          setStatus('error')
          setErrorMsg('No se pudo obtener la ubicación. Verifica tu conexión o GPS.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }, [])

  // ── Seguimiento continuo (opcional, para tracking en vivo) ───
  const startWatching = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus('success')
      },
      () => { /* ignorar errores de watch silenciosamente */ },
      { enableHighAccuracy: true, maximumAge: 1000 }
    )
  }, [])

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const clearLocation = useCallback(() => {
    stopWatching()
    setLocation(null)
    setStatus('idle')
    setErrorMsg(null)
  }, [stopWatching])

  return {
    location,
    status,
    errorMsg,
    requestLocation,
    startWatching,
    stopWatching,
    clearLocation,
  }
}