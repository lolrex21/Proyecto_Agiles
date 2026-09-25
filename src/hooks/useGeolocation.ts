export interface CurrentLocation {
  latitud: number
  longitud: number
}

export function getCurrentLocation(): Promise<CurrentLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no permite obtener la ubicación.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Debes permitir el acceso a tu ubicación para enviar la emergencia.'))
          return
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error('No se pudo obtener tu ubicación a tiempo. Intenta nuevamente.'))
          return
        }
        reject(new Error('No se pudo obtener tu ubicación actual.'))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}
