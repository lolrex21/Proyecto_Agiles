import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polygon,
  useJsApiLoader,
} from '@react-google-maps/api'
import { useState, useEffect, useRef } from 'react'
import type { Incident } from '../../types/incident'
import { usePolygons } from '../../hooks/usePolygons'
import { getZoneByPoint } from '../../services/polygonService'

interface IncidentMapProps {
  incidents: Incident[]
  loading: boolean
  selectedIncident?: Incident | null
  onMarkerClick?: (incident: Incident) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const defaultCenter = {
  lat: -1.2685,
  lng: -78.6245,
}

const defaultZoom = 17

export default function IncidentMap({
  incidents,
  loading,
  onMarkerClick,
  selectedIncident = null,
}: IncidentMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<Incident | null>(null)
  const [incidentsWithZone, setIncidentsWithZone] = useState<Incident[]>([])

  const mapRef = useRef<google.maps.Map | null>(null)
  const { zones } = usePolygons()

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  })

  useEffect(() => {
    let isMounted = true

    const assignZones = async () => {
      if (incidents.length === 0) {
        setIncidentsWithZone([])
        return
      }

      const updated = await Promise.all(
        incidents.map(async (incident) => {
          if (incident.latitud && incident.longitud && !incident.zona_id) {
            const zone = await getZoneByPoint(
              Number(incident.latitud),
              Number(incident.longitud)
            )

            return {
              ...incident,
              zona_id: zone?.id,
              zona: zone ? { id: zone.id, nombre: zone.nombre } : undefined,
            }
          }

          return incident
        })
      )

      if (isMounted) {
        setIncidentsWithZone(updated)
      }
    }

    void assignZones()

    return () => {
      isMounted = false
    }
  }, [incidents])

  const incidentsWithLocation = incidentsWithZone.filter((incident) => {
    const lat = Number(incident.latitud)
    const lng = Number(incident.longitud)

    return !Number.isNaN(lat) && !Number.isNaN(lng)
  })

  const handleMarkerClick = (incident: Incident) => {
    setSelectedMarker(incident)
    onMarkerClick?.(incident)
  }

  useEffect(() => {
    if (!selectedIncident || !mapRef.current) return

    setSelectedMarker(selectedIncident)

    const lat = Number(selectedIncident.latitud)
    const lng = Number(selectedIncident.longitud)

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      mapRef.current.panTo({ lat, lng })
      mapRef.current.setZoom(18)
    }
  }, [selectedIncident])

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map
  }

  const onMapUnmount = () => {
    mapRef.current = null
  }

  const getIncidentColor = (tipo: string): string => {
    const colors: Record<string, string> = {
      robo: '#FF0000',
      agresion: '#FF6600',
      vandalismo: '#FFAA00',
      sospechoso: '#9900FF',
      accidente: '#0066FF',
      incendio: '#FF3300',
      otro: '#666666',
    }

    return colors[tipo?.toLowerCase()] || colors.otro
  }

  const formatDate = (fecha?: string) => {
    if (!fecha) return 'Fecha no disponible'

    return new Date(fecha).toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  if (loading || !isLoaded) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        Cargando mapa...
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative bg-gray-100">
      <GoogleMap
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={defaultZoom}
        options={{
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {zones.map((zone) => (
          <Polygon
            key={zone.id}
            paths={zone.coordenadas}
            options={{
              strokeColor: zone.color,
              strokeOpacity: 0.9,
              strokeWeight: 3,
              fillColor: zone.color,
              fillOpacity: 0.12,
            }}
          />
        ))}

        {incidentsWithLocation.map((incident) => (
          <Marker
            key={incident.id}
            position={{
              lat: Number(incident.latitud),
              lng: Number(incident.longitud),
            }}
            title={incident.tipo_incidente}
            icon={{
              path: 'M 0,-1 A 1,1 0 0,1 0,1 A 1,1 0 0,1 0,-1',
              fillColor: getIncidentColor(incident.tipo_incidente),
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2.5,
              scale: 11,
            }}
            onClick={() => handleMarkerClick(incident)}
          />
        ))}

        {selectedMarker &&
          Number(selectedMarker.latitud) &&
          Number(selectedMarker.longitud) && (
            <InfoWindow
              position={{
                lat: Number(selectedMarker.latitud),
                lng: Number(selectedMarker.longitud),
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-4 max-w-sm bg-white rounded-lg">
                <h3 className="font-bold text-base mb-2 uppercase text-gray-900">
                  {selectedMarker.tipo_incidente}
                </h3>

                {selectedMarker.zona_id != null && (
                  <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    📍{' '}
                    {zones.find((z) => z.id === selectedMarker.zona_id)
                      ?.nombre || 'Zona desconocida'}
                  </p>
                )}

                <div className="mb-2">
                  <span
                    className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                      selectedMarker.estado === 'Pendiente'
                        ? 'bg-red-200 text-red-900'
                        : selectedMarker.estado === 'Atendido'
                        ? 'bg-yellow-200 text-yellow-900'
                        : 'bg-green-200 text-green-900'
                    }`}
                  >
                    {selectedMarker.estado === 'Atendido' ? 'Atendiendo' : selectedMarker.estado}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2 border-t pt-2">
                  {selectedMarker.descripcion}
                </p>

                <p className="text-xs text-gray-600 mb-1">
                  👤 <strong>Reportado por:</strong>{' '}
                  {selectedMarker.usuario?.nombre || 'Usuario'}
                </p>

                <p className="text-xs text-gray-500">
                  🕐 {formatDate(selectedMarker.fecha)}
                </p>
              </div>
            </InfoWindow>
          )}
      </GoogleMap>
    </div>
  )
}