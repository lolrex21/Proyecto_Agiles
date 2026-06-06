import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  Polygon,
} from '@react-google-maps/api'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Incident } from '../../types/incident'
import { usePolygons } from '../../hooks/usePolygons'
import {
  getZoneByPoint,
  getPolygonCenter,
  getGuardPostsFromDB,
  type ZonePolygon,
  type GuardPost,
} from '../../services/polygonService'
import './IncidentMap.css'

interface IncidentMapProps {
  incidents: Incident[]
  loading: boolean
  onMarkerClick?: (incident: Incident) => void
}

const mapContainerStyle = { width: '100%', height: '100%' }

// Centro del Campus Huachi
const defaultCenter = { lat: -1.2685, lng: -78.6245 }
const defaultZoom   = 17

// ── Icono SVG de escudo para puestos de guardia ────────────────
const GUARD_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#1a56db" stroke="#ffffff" stroke-width="3"/><path d="M20 8 L28 12 L28 22 C28 27 20 32 20 32 C20 32 12 27 12 22 L12 12 Z" fill="#ffffff" fill-opacity="0.9"/><path d="M17 20 L19 22 L23 17" stroke="#1a56db" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'

const guardIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(GUARD_ICON_SVG)}`

export default function IncidentMap({
  incidents,
  loading,
  onMarkerClick,
}: IncidentMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null)

  const [selectedMarker,    setSelectedMarker]    = useState<Incident | null>(null)
  const [selectedGuardPost, setSelectedGuardPost] = useState<GuardPost | null>(null)
  const [hoveredZone,       setHoveredZone]       = useState<ZonePolygon | null>(null)
  const [incidentsWithZone, setIncidentsWithZone] = useState<Incident[]>([])
  const [guardPosts,        setGuardPosts]        = useState<GuardPost[]>([])

  const { zones } = usePolygons()

  // ── Cargar puestos de guardia ──────────────────────────────────
  useEffect(() => {
    getGuardPostsFromDB().then(setGuardPosts)
  }, [])

  // ── A-12.4: Asignar zona automáticamente a cada incidente ──────
  useEffect(() => {
    if (incidents.length === 0) { setIncidentsWithZone([]); return }

    const assignZones = async () => {
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
      setIncidentsWithZone(updated)
    }

    assignZones()
  }, [incidents])

  // ── Guardar referencia al mapa ─────────────────────────────────
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  // ── Pan + zoom suave al hacer clic en un incidente ─────────────
  const handleMarkerClick = (incident: Incident) => {
    setSelectedGuardPost(null)
    setSelectedMarker(incident)

    if (mapRef.current) {
      mapRef.current.panTo({
        lat: Number(incident.latitud),
        lng: Number(incident.longitud),
      })
      mapRef.current.setZoom(21)
    }

    onMarkerClick?.(incident)
  }

  // ── Pan + zoom al hacer clic en un polígono de zona ───────────
  const handleZoneClick = (zone: ZonePolygon) => {
    setSelectedMarker(null)
    setSelectedGuardPost(null)

    if (mapRef.current && zone.coordenadas.length > 0) {
      const center = getPolygonCenter(zone.coordenadas)
      mapRef.current.panTo(center)
      mapRef.current.setZoom(20)
    }
  }

  // ── Pan + zoom al hacer clic en un puesto de guardia ──────────
  const handleGuardPostClick = (post: GuardPost) => {
    setSelectedMarker(null)
    setSelectedGuardPost(post)

    if (mapRef.current) {
      mapRef.current.panTo({ lat: post.lat, lng: post.lng })
      mapRef.current.setZoom(20)
    }
  }

  // ── Colores por tipo de incidente ─────────────────────────────
  const getIncidentColor = (tipo: string): string => {
    const colors: Record<string, string> = {
      robo:        '#FF0000',
      agresion:    '#FF6600',
      vandalismo:  '#FFAA00',
      sospechoso:  '#9900FF',
      accidente:   '#0066FF',
      incendio:    '#FF3300',
      otro:        '#666666',
    }
    return colors[tipo.toLowerCase()] ?? colors.otro
  }

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
        ⏳ Cargando mapa...
      </div>
    )
  }

  // A-12: Filtrar incidentes cerrados del mapa (Escenario 1 — solo activos)
  const incidentsOnMap = incidentsWithZone.filter((incident) => {
    const lat = Number(incident.latitud)
    const lng = Number(incident.longitud)
    return (
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      incident.estado !== 'Cerrado'   // ← incidentes cerrados desaparecen
    )
  })

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative bg-gray-100">
      {/* Chip de zona al hacer hover */}
      {hoveredZone && (
        <div className="zone-hover-chip">
          <span className="zone-hover-swatch" style={{ backgroundColor: hoveredZone.color }} />
          <span className="zone-hover-text">
            <strong>{hoveredZone.nombre}</strong>
            {hoveredZone.descripcion && <small>{hoveredZone.descripcion}</small>}
          </span>
        </div>
      )}

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onMapLoad}
          options={{
            mapTypeControl:      true,
            streetViewControl:   false,
            fullscreenControl:   true,
            zoomControl:         true,
          }}
        >
          {/* ══════════ POLÍGONOS DE ZONAS (A-12.3) ══════════ */}
          {zones.map((zone) => (
            <Polygon
              key={zone.id}
              paths={zone.coordenadas}
              options={{
                strokeColor:   zone.color,
                strokeOpacity: 0.9,
                strokeWeight:  3,
                fillColor:     zone.color,
                fillOpacity:   hoveredZone?.id === zone.id ? 0.28 : 0.12,
              }}
              onMouseOver={() => setHoveredZone(zone)}
              onMouseOut={()  => setHoveredZone(null)}
              onClick={()     => handleZoneClick(zone)}   // ← pan/zoom a la zona
            />
          ))}

          {/* ══════════ PUESTOS DE GUARDIA (A-12.1 / A-12.3) ══════════ */}
          {guardPosts.map((post) => (
            <Marker
              key={`guard-${post.id}`}
              position={{ lat: post.lat, lng: post.lng }}
              title={post.nombre}
              icon={guardIconUrl}
              zIndex={10}
              onClick={() => handleGuardPostClick(post)}
            />
          ))}

          {/* InfoWindow del puesto de guardia */}
          {selectedGuardPost && (
            <InfoWindow
              position={{ lat: selectedGuardPost.lat, lng: selectedGuardPost.lng }}
              onCloseClick={() => setSelectedGuardPost(null)}
            >
              <div className="p-3 max-w-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🛡️</span>
                  <h3 className="font-bold text-sm text-gray-900">{selectedGuardPost.nombre}</h3>
                </div>
                {selectedGuardPost.descripcion && (
                  <p className="text-xs text-gray-500">{selectedGuardPost.descripcion}</p>
                )}
                <p className="text-xs text-blue-600 mt-1 font-semibold">
                  Puesto de Seguridad Activo
                </p>
              </div>
            </InfoWindow>
          )}

          {/* ══════════ MARCADORES DE INCIDENTES (solo no cerrados) ══════════ */}
          {incidentsOnMap.map((incident) => (
            <Marker
              key={incident.id}
              position={{
                lat: Number(incident.latitud),
                lng: Number(incident.longitud),
              }}
              title={incident.tipo_incidente}
              icon={{
                path:        'M 0,-1 A 1,1 0 0,1 0,1 A 1,1 0 0,1 0,-1',
                fillColor:   getIncidentColor(incident.tipo_incidente),
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2.5,
                scale: 11,
              }}
              onClick={() => handleMarkerClick(incident)}
            />
          ))}

          {/* ══════════ INFO WINDOW DEL INCIDENTE ══════════ */}
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

                  {/* A-12.5: Nombre exacto del lugar */}
                  {selectedMarker.zona_id != null && (
                    <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                      📍{' '}
                      {zones.find((z) => z.id === selectedMarker.zona_id)?.nombre ||
                        'Zona desconocida'}
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
                      {selectedMarker.estado === 'Pendiente' && '🔴 '}
                      {selectedMarker.estado === 'Atendido'  && '🟠 '}
                      {selectedMarker.estado === 'Cerrado'   && '🟢 '}
                      {selectedMarker.estado}
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
                    🕐{' '}
                    {selectedMarker.created_at
                      ? new Date(selectedMarker.created_at).toLocaleString('es-ES')
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