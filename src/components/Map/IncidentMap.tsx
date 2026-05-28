import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  Polygon,
} from '@react-google-maps/api'
import { useState, useEffect } from 'react'
import type { Incident } from '../../types/incident'
import { usePolygons } from '../../hooks/usePolygons'
import { getZoneByPoint } from '../../services/polygonService'

interface IncidentMapProps {
  incidents: Incident[]
  loading: boolean
  onMarkerClick?: (incident: Incident) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

// Centro del Campus Huachi
const defaultCenter = {
  lat: -1.2685,
  lng: -78.6245,
}

const defaultZoom = 17

export default function IncidentMap({
  incidents,
  loading,
  onMarkerClick,
}: IncidentMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<Incident | null>(null)
  const { zones } = usePolygons()
  const [incidentsWithZone, setIncidentsWithZone] = useState<Incident[]>([])

  // 🎯 ASIGNAR ZONA A CADA INCIDENTE AUTOMÁTICAMENTE
  useEffect(() => {
    const assignZones = async () => {
      const updated = await Promise.all(
        incidents.map(async (incident) => {
          if (
            incident.latitud &&
            incident.longitud &&
            !incident.zona_id
          ) {
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
      setIncidentsWithZone(updated)
    }

    if (incidents.length > 0) {
      assignZones()
    }
  }, [incidents])

  const handleMarkerClick = (incident: Incident) => {
    setSelectedMarker(incident)
    if (onMarkerClick) {
      onMarkerClick(incident)
    }
  }

  // 🎨 COLORES POR TIPO DE INCIDENTE
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
    return colors[tipo.toLowerCase()] || colors.otro
  }

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
        ⏳ Cargando mapa...
      </div>
    )
  }

  const incidentsWithLocation = incidentsWithZone.filter((incident) => {
    const lat = Number(incident.latitud)
    const lng = Number(incident.longitud)
    return !Number.isNaN(lat) && !Number.isNaN(lng)
  })

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative bg-gray-100">
      {incidentsWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
          <p className="text-gray-600 text-lg">✓ No hay incidentes en el Campus Huachi</p>
        </div>
      )}

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
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
          {/* ========== DIBUJAR POLÍGONOS DE LAS 4 ZONAS ========== */}
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

          {/* ========== DIBUJAR MARCADORES DE INCIDENTES ========== */}
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

          {/* ========== INFO WINDOW CON INFORMACIÓN CLARA ========== */}
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
                  {/* Tipo de incidente - Título grande */}
                  <h3 className="font-bold text-base mb-2 uppercase text-gray-900">
                    {selectedMarker.tipo_incidente}
                  </h3>

                  {/* Zona - Información importante */}
                  {selectedMarker.zona_id != null && (
                    <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                      📍{' '}
                      {zones.find((z) => z.id === selectedMarker.zona_id)
                        ?.nombre || 'Zona desconocida'}
                    </p>
                  )}

                  {/* Estado - Badge coloreado */}
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
                      {selectedMarker.estado === 'Pendiente' && '🔴'}{' '}
                      {selectedMarker.estado === 'Atendido' && '🟠'}{' '}
                      {selectedMarker.estado === 'Cerrado' && '🟢'}{' '}
                      {selectedMarker.estado}
                    </span>
                  </div>

                  {/* Descripción */}
                  <p className="text-sm text-gray-700 mb-2 border-t pt-2">
                    {selectedMarker.descripcion}
                  </p>

                  {/* Reportado por */}
                  <p className="text-xs text-gray-600 mb-1">
                    👤 <strong>Reportado por:</strong>{' '}
                    {selectedMarker.usuario?.nombre || 'Usuario'}
                  </p>

                  {/* Fecha y hora */}
                  <p className="text-xs text-gray-500">
                    🕐{' '}
                    {selectedMarker.created_at
                      ? new Date(selectedMarker.created_at).toLocaleString(
                          'es-ES'
                        )
                      : 'Fecha no disponible'}
                  </p>
                </div>
              </InfoWindow>
            )}
        </GoogleMap>
      </LoadScript>
    </div>
  )
}