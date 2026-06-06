import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  Polygon,
  Circle,
} from '@react-google-maps/api'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Incident } from '../../types/incident'
import { usePolygons } from '../../hooks/usePolygons'
import { useUserLocation } from '../../hooks/useUserLocation'
import {
  getZoneByPoint,
  getPolygonCenter,
  getGuardPostsFromDB,
  type ZonePolygon,
  type GuardPost,
} from '../../services/polygonService'
import './IncidentMap.css'

// ─── Props ────────────────────────────────────────────────────
interface IncidentMapProps {
  incidents:           Incident[]
  loading:             boolean
  onMarkerClick?:      (incident: Incident) => void
  /** A-18.4: notifica la ubicación al componente padre para usarla al reportar */
  onLocationDetected?: (lat: number, lng: number) => void
}

const mapContainerStyle = { width: '100%', height: '100%' }
const defaultCenter     = { lat: -1.2685, lng: -78.6245 }
const defaultZoom       = 17

// ── Icono SVG escudo (puestos de guardia) ─────────────────────
const GUARD_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">' +
  '<circle cx="20" cy="20" r="18" fill="#1a56db" stroke="#ffffff" stroke-width="3"/>' +
  '<path d="M20 8 L28 12 L28 22 C28 27 20 32 20 32 C20 32 12 27 12 22 L12 12 Z" fill="#ffffff" fill-opacity="0.9"/>' +
  '<path d="M17 20 L19 22 L23 17" stroke="#1a56db" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>'
const guardIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(GUARD_ICON_SVG)}`

// ── Icono SVG punto azul (ubicación del usuario) ──────────────
const USER_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">' +
  '<circle cx="20" cy="20" r="14" fill="#4285F4" stroke="#ffffff" stroke-width="4"/>' +
  '<circle cx="20" cy="20" r="5" fill="#ffffff"/>' +
  '</svg>'
const userIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(USER_ICON_SVG)}`

// ─── Colores de incidente ────────────────────────────────────
const INCIDENT_COLORS: Record<string, string> = {
  robo:       '#FF0000',
  agresion:   '#FF6600',
  vandalismo: '#FFAA00',
  sospechoso: '#9900FF',
  accidente:  '#0066FF',
  incendio:   '#FF3300',
  otro:       '#666666',
}
const getIncidentColor = (tipo: string) =>
  INCIDENT_COLORS[tipo.toLowerCase()] ?? INCIDENT_COLORS.otro

// ─────────────────────────────────────────────────────────────
export default function IncidentMap({
  incidents,
  loading,
  onMarkerClick,
  onLocationDetected,
}: IncidentMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null)

  const [selectedMarker,    setSelectedMarker]    = useState<Incident | null>(null)
  const [selectedGuardPost, setSelectedGuardPost] = useState<GuardPost | null>(null)
  const [hoveredZone,       setHoveredZone]       = useState<ZonePolygon | null>(null)
  const [incidentsWithZone, setIncidentsWithZone] = useState<Incident[]>([])
  const [guardPosts,        setGuardPosts]        = useState<GuardPost[]>([])

  // A-18: hook de ubicación del usuario
  const { location, status, errorMsg, requestLocation } = useUserLocation()

  const { zones } = usePolygons()

  // ── Cargar puestos de guardia ─────────────────────────────
  useEffect(() => {
    getGuardPostsFromDB().then(setGuardPosts)
  }, [])

  // ── Asignar zona a cada incidente automáticamente ─────────
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
              zona:    zone ? { id: zone.id, nombre: zone.nombre } : undefined,
            }
          }
          return incident
        })
      )
      setIncidentsWithZone(updated)
    }

    assignZones()
  }, [incidents])

  // ── A-18.3 + A-18.4: cuando se obtiene ubicación, centrar mapa y notificar ──
  useEffect(() => {
    if (status === 'success' && location && mapRef.current) {
      mapRef.current.panTo({ lat: location.lat, lng: location.lng })
      mapRef.current.setZoom(19)
      onLocationDetected?.(location.lat, location.lng)
    }
  }, [status, location, onLocationDetected])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  // ── Handlers de clic ──────────────────────────────────────
  const handleMarkerClick = (incident: Incident) => {
    setSelectedGuardPost(null)
    setSelectedMarker(incident)
    if (mapRef.current) {
      mapRef.current.panTo({ lat: Number(incident.latitud), lng: Number(incident.longitud) })
      mapRef.current.setZoom(21)
    }
    onMarkerClick?.(incident)
  }

  const handleZoneClick = (zone: ZonePolygon) => {
    setSelectedMarker(null)
    setSelectedGuardPost(null)
    if (mapRef.current && zone.coordenadas.length > 0) {
      mapRef.current.panTo(getPolygonCenter(zone.coordenadas))
      mapRef.current.setZoom(20)
    }
  }

  const handleGuardPostClick = (post: GuardPost) => {
    setSelectedMarker(null)
    setSelectedGuardPost(post)
    if (mapRef.current) {
      mapRef.current.panTo({ lat: post.lat, lng: post.lng })
      mapRef.current.setZoom(20)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        ⏳ Cargando mapa...
      </div>
    )
  }

  // Filtrar incidentes cerrados (no se muestran en mapa)
  const incidentsOnMap = incidentsWithZone.filter((inc) => {
    const lat = Number(inc.latitud)
    const lng = Number(inc.longitud)
    return !Number.isNaN(lat) && !Number.isNaN(lng) && inc.estado !== 'Cerrado'
  })

  // ── Botón de ubicación: estado del título ─────────────────
  const locationBtnTitle =
    status === 'loading' ? 'Obteniendo ubicación…' :
    status === 'success' ? 'Centrar en mi ubicación' :
    status === 'denied'  ? 'Permiso denegado' :
    'Mostrar mi ubicación'

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative bg-gray-100">

      {/* ── Chip de zona al hover ─────────────────────────── */}
      {hoveredZone && (
        <div className="zone-hover-chip">
          <span className="zone-hover-swatch" style={{ backgroundColor: hoveredZone.color }} />
          <span className="zone-hover-text">
            <strong>{hoveredZone.nombre}</strong>
            {hoveredZone.descripcion && <small>{hoveredZone.descripcion}</small>}
          </span>
        </div>
      )}

      {/* ── A-18.1: Botón flotante "Mi ubicación" ─────────── */}
      <button
        className={`location-fab${status === 'loading' ? ' loading' : ''}${status === 'denied' || status === 'error' ? ' error' : ''}${status === 'success' ? ' active' : ''}`}
        onClick={requestLocation}
        title={locationBtnTitle}
        disabled={status === 'loading'}
      >
        {status === 'loading'
          ? <span className="location-fab-spinner" />
          : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="8" strokeDasharray="2 3"/>
            </svg>
          )
        }
      </button>

      {/* ── A-18.5: Toast de error de ubicación ───────────── */}
      {(status === 'denied' || status === 'error') && errorMsg && (
        <div className="location-error-toast">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onMapLoad}
          options={{
            mapTypeControl:    true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl:       true,
          }}
        >
          {/* ══ POLÍGONOS DE ZONAS ══ */}
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
              onClick={()     => handleZoneClick(zone)}
            />
          ))}

          {/* ══ PUESTOS DE GUARDIA ══ */}
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

          {/* InfoWindow puesto de guardia */}
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
                <p className="text-xs text-blue-600 mt-1 font-semibold">Puesto de Seguridad Activo</p>
              </div>
            </InfoWindow>
          )}

          {/* ══ MARCADORES DE INCIDENTES ══ */}
          {incidentsOnMap.map((incident) => (
            <Marker
              key={incident.id}
              position={{ lat: Number(incident.latitud), lng: Number(incident.longitud) }}
              title={incident.tipo_incidente}
              icon={{
                path:         'M 0,-1 A 1,1 0 0,1 0,1 A 1,1 0 0,1 0,-1',
                fillColor:    getIncidentColor(incident.tipo_incidente),
                fillOpacity:  1,
                strokeColor:  '#fff',
                strokeWeight: 2.5,
                scale:        11,
              }}
              onClick={() => handleMarkerClick(incident)}
            />
          ))}

          {/* InfoWindow incidente */}
          {selectedMarker && Number(selectedMarker.latitud) && Number(selectedMarker.longitud) && (
            <InfoWindow
              position={{ lat: Number(selectedMarker.latitud), lng: Number(selectedMarker.longitud) }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-4 max-w-sm bg-white rounded-lg">
                <h3 className="font-bold text-base mb-2 uppercase text-gray-900">
                  {selectedMarker.tipo_incidente}
                </h3>

                {selectedMarker.zona_id != null && (
                  <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    📍 {zones.find((z) => z.id === selectedMarker.zona_id)?.nombre || 'Zona desconocida'}
                  </p>
                )}

                <div className="mb-2">
                  <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                    selectedMarker.estado === 'Pendiente' ? 'bg-red-200 text-red-900'
                    : selectedMarker.estado === 'Atendido' ? 'bg-yellow-200 text-yellow-900'
                    : 'bg-green-200 text-green-900'
                  }`}>
                    {selectedMarker.estado === 'Pendiente' && '🔴 '}
                    {selectedMarker.estado === 'Atendido'  && '🟠 '}
                    {selectedMarker.estado === 'Cerrado'   && '🟢 '}
                    {selectedMarker.estado}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2 border-t pt-2">{selectedMarker.descripcion}</p>
                <p className="text-xs text-gray-600 mb-1">
                  👤 <strong>Reportado por:</strong> {selectedMarker.usuario?.nombre || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500">
                  🕐 {selectedMarker.created_at
                    ? new Date(selectedMarker.created_at).toLocaleString('es-ES')
                    : 'Fecha no disponible'}
                </p>
              </div>
            </InfoWindow>
          )}

          {/* ══ A-18.3: MARCADOR + CÍRCULO DE PRECISIÓN (ubicación del usuario) ══ */}
          {status === 'success' && location && (
            <>
              {/* Círculo de precisión GPS */}
              {location.accuracy && location.accuracy < 200 && (
                <Circle
                  center={{ lat: location.lat, lng: location.lng }}
                  radius={location.accuracy}
                  options={{
                    strokeColor:   '#4285F4',
                    strokeOpacity: 0.4,
                    strokeWeight:  1,
                    fillColor:     '#4285F4',
                    fillOpacity:   0.08,
                    zIndex:        5,
                  }}
                />
              )}

              {/* Punto azul de posición actual */}
              <Marker
                position={{ lat: location.lat, lng: location.lng }}
                title="Tu ubicación actual"
                icon={userIconUrl}
                zIndex={20}
              />
            </>
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  )
}