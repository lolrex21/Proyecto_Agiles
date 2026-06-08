import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Polygon,
  Circle,
} from '@react-google-maps/api'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Incident } from '../../types/incident'
import type { Camera } from '../../types/camera'
import { usePolygons } from '../../hooks/usePolygons'
import { useCameras } from '../../hooks/useCameras'
import { getZoneByPoint } from '../../services/polygonService'
import { createCamera, updateCamera, deleteCamera } from '../../services/cameraService'
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
  incidents: Incident[]
  loading: boolean
  onMarkerClick?: (incident: Incident) => void
  isAdmin?: boolean
  onLocationDetected?: (lat: number, lng: number) => void
}

const mapContainerStyle = { width: '100%', height: '100%' }
const defaultCenter     = { lat: -1.2685, lng: -78.6245 }
const defaultZoom       = 17

const defaultCenter = {
  lat: -1.2685,
  lng: -78.6245,
}
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

// ─── Colores de incidente ─────────────────────────────────────
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
  isAdmin = false,
}: IncidentMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const [selectedGuardPost, setSelectedGuardPost] = useState<GuardPost | null>(null)
  const [hoveredZone,       setHoveredZone]       = useState<ZonePolygon | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<Incident | null>(null)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [showCameras, setShowCameras] = useState(false)
  const [isAddCameraMode, setIsAddCameraMode] = useState(false)
  const [newCameraCoords, setNewCameraCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cameraName, setCameraName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [cameraToDelete, setCameraToDelete] = useState<Camera | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null)
  const [editCameraName, setEditCameraName] = useState('')
  const [editCameraStatus, setEditCameraStatus] = useState<'Activa' | 'Inactiva'>('Activa')
  const [isUpdating, setIsUpdating] = useState(false)
  const { zones } = usePolygons()
  const { cameras, loading: camerasLoading, refetch: refetchCameras } = useCameras()
  const [incidentsWithZone, setIncidentsWithZone] = useState<Incident[]>([])
  const [guardPosts,        setGuardPosts]        = useState<GuardPost[]>([])

  // ── Carga la API de Google Maps UNA SOLA VEZ (no se remonta al re-renderizar) ──
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    id: 'google-map-script',
  })

  // A-18: hook de ubicación del usuario
  const { location, status, errorMsg, requestLocation, startWatching, stopWatching } = useUserLocation()

  const { zones } = usePolygons()

  // ── Cargar puestos de guardia ─────────────────────────────
  useEffect(() => {
    getGuardPostsFromDB().then(setGuardPosts)
  }, [])

  // ── Iniciar seguimiento continuo al montar ────────────────
  useEffect(() => {
    startWatching()
    return () => stopWatching()
  }, [startWatching, stopWatching])

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
    } else if (status === 'success' && location) {
    // Solo notifica al padre sin mover el mapa
    onLocationDetected?.(location.lat, location.lng)
  }
  }, [status, location, onLocationDetected])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  // ── Handlers de clic ──────────────────────────────────────
  const handleMarkerClick = (incident: Incident) => {
    setSelectedCamera(null)
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
    }
  const handleGuardPostClick = (post: GuardPost) => {
    setSelectedMarker(null)
    setSelectedGuardPost(post)
    if (mapRef.current) {
      mapRef.current.panTo({ lat: post.lat, lng: post.lng })
      mapRef.current.setZoom(20)
    }
  }

  const handleCreateCamera = async () => {
    if (!newCameraCoords || !cameraName.trim()) return

    setIsCreating(true)
    const success = await createCamera({
      nombre: cameraName.trim(),
      latitud: newCameraCoords.lat,
      longitud: newCameraCoords.lng,
    })
    setIsCreating(false)

    if (success) {
      await refetchCameras()
      setNewCameraCoords(null)
      setCameraName('')
      setIsAddCameraMode(false)
    } else {
      alert('No se pudo crear la cámara. Intenta nuevamente.')
    }
  }

  const handleCancelCamera = useCallback(() => {
    setNewCameraCoords(null)
    setCameraName('')
    setIsAddCameraMode(false)
  }, [])

  const handleDeleteCamera = async (camera: Camera) => {
    if (!camera) return

    setIsDeleting(true)
    const success = await deleteCamera(camera.id)
    setIsDeleting(false)

    if (success) {
      setSelectedCamera(null)
      setCameraToDelete(null)
      await refetchCameras()
    } else {
      alert('No se pudo eliminar la cámara. Intenta nuevamente.')
    }
  }

  const handleCancelDelete = useCallback(() => {
    setCameraToDelete(null)
  }, [])

  const handleEditCamera = (camera: Camera) => {
    setEditingCamera(camera)
    setEditCameraName(camera.nombre)
    setEditCameraStatus(camera.estado_conectividad)
    setSelectedCamera(null)
  }

  const handleUpdateCamera = async () => {
    if (!editingCamera || !editCameraName.trim()) return

    setIsUpdating(true)
    const success = await updateCamera(editingCamera.id, {
      nombre: editCameraName.trim(),
      estado_conectividad: editCameraStatus,
    })
    setIsUpdating(false)

    if (success) {
      await refetchCameras()
      setEditingCamera(null)
      setEditCameraName('')
      setEditCameraStatus('Activa')
    } else {
      alert('No se pudo actualizar la cámara. Intenta nuevamente.')
    }
  }

  const handleCancelEdit = useCallback(() => {
    setEditingCamera(null)
    setEditCameraName('')
    setEditCameraStatus('Activa')
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (newCameraCoords) {
          handleCancelCamera()
        } else if (editingCamera) {
          handleCancelEdit()
        } else if (cameraToDelete) {
          handleCancelDelete()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [newCameraCoords, editingCamera, cameraToDelete, handleCancelCamera, handleCancelEdit, handleCancelDelete])

  // ── Guards de carga ───────────────────────────────────────
  if (loadError) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-red-600">
        ❌ Error al cargar Google Maps. Verifica tu API key.
      </div>
    )
  }

  if (!isLoaded || loading) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <div className="map-loader">
          <div className="spinner" />
          <p>Cargando mapa...</p>
        </div>
      </div>
    )
  }

  // ── Filtrar incidentes cerrados ───────────────────────────
  const incidentsOnMap = incidentsWithZone.filter((inc) => {
    const lat = Number(inc.latitud)
    const lng = Number(inc.longitud)
    return !Number.isNaN(lat) && !Number.isNaN(lng) && inc.estado !== 'Cerrado'
  })

  // ── Botón de ubicación: título ────────────────────────────
  const locationBtnTitle =
    status === 'loading' ? 'Obteniendo ubicación…' :
    status === 'success' ? 'Centrar en mi ubicación' :
    status === 'denied'  ? 'Permiso denegado' :
    'Mostrar mi ubicación'

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative bg-gray-100">
      {incidentsWithLocation.length === 0 && !showCameras && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
          <p className="text-gray-600 text-lg">✓ No hay incidentes en el Campus Huachi</p>
        </div>
      )}

      {/* Toggle para cámaras */}
      <button
        onClick={() => {
          setShowCameras((prev) => !prev)
          if (showCameras) setSelectedCamera(null)
        }}
        className={`absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold shadow-lg transition-all ${
          showCameras
            ? 'bg-uta-navy text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        {showCameras ? 'Ocultar Cámaras' : 'Mostrar Cámaras'}
      </button>

      {/* Toggle Modo Añadir Cámara (Admin only) */}
      {isAdmin && (
        <button
          onClick={() => {
            setIsAddCameraMode((prev) => !prev)
            setNewCameraCoords(null)
            setCameraName('')
          }}
          className={`absolute top-3 right-48 z-20 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold shadow-lg transition-all ${
            isAddCameraMode
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {isAddCameraMode ? 'Cancelar' : 'Añadir Cámara'}
        </button>
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
          onClick={(event) => {
            if (isAddCameraMode && event.latLng) {
              setNewCameraCoords({
                lat: event.latLng.lat(),
                lng: event.latLng.lng(),
              })
            }
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
                clickable: !isAddCameraMode,
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

          {/* ========== MARCADORES DE CÁMARAS ========== */}
          {showCameras && cameras.map((camera) => (
            <Marker
              key={camera.id}
              position={{ lat: camera.latitud, lng: camera.longitud }}
              title={camera.nombre}
              icon={{
                url: '/camara-de-seguridad.png',
                scaledSize: { width: 32, height: 32 } as google.maps.Size,
                anchor: { x: 16, y: 16 } as google.maps.Point,
              }}
              onClick={() => {
                setSelectedCamera(camera)
                setSelectedMarker(null)
              }}
            />
          ))}

          {/* ========== MARCADOR TEMPORAL DE NUEVA CÁMARA ========== */}
          {newCameraCoords && (
            <Marker
              position={newCameraCoords}
              icon={{
                path: 'M 0,-1 A 1,1 0 0,1 0,1 A 1,1 0 0,1 0,-1',
                fillColor: '#DC2626',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2.5,
                scale: 11,
              }}
              label={{
                text: '+',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#fff',
              }}
            />
          )}

          {/* ========== INFO WINDOW CON INFORMACIÓN CLARA ========== */}
          { &&
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
                      {selectedMarker.estado === 'Pendiente' && '🔴'}{' '}
                      {selectedMarker.estado === 'Atendido' && '🟠'}{' '}
                      {selectedMarker.estado === 'Cerrado' && '🟢'}{' '}
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
                      ? new Date(selectedMarker.created_at).toLocaleString(
                          'es-ES'
                        )
                      : 'Fecha no disponible'}
                  </p>
                </div>
              </InfoWindow>
            )}

          {/* ========== INFO WINDOW DE CÁMARA ========== */}
          {selectedCamera && (
            <InfoWindow
              position={{ lat: selectedCamera.latitud, lng: selectedCamera.longitud }}
              onCloseClick={() => setSelectedCamera(null)}
            >
              <div className="min-w-[220px] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <h3 className="font-semibold text-sm text-gray-800 truncate">
                      {selectedCamera.nombre}
                    </h3>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      {selectedCamera.estado_conectividad === 'Activa' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        selectedCamera.estado_conectividad === 'Activa'
                          ? 'bg-green-500'
                          : 'bg-red-400'
                      }`} />
                    </span>
                    <span className="text-xs font-medium text-gray-700">
                      {selectedCamera.estado_conectividad}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 px-4 pb-3">
                    <button
                      onClick={() => handleEditCamera(selectedCamera)}
                      className="flex-1 py-1.5 px-3 bg-uta-navy text-white text-xs font-bold rounded hover:bg-uta-navy/90 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setCameraToDelete(selectedCamera)}
                      className="flex-1 py-1.5 px-3 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>

      {/* ========== MODAL: CREAR CÁMARA ========== */}
      {newCameraCoords && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-fade-in">
            <div className="bg-uta-navy px-5 py-3">
              <h3 className="text-white font-bold text-sm">Nueva Cámara de Seguridad</h3>
              <p className="text-white/70 text-xs mt-0.5">
                Lat: {newCameraCoords.lat.toFixed(6)}, Lng: {newCameraCoords.lng.toFixed(6)}
              </p>
            </div>

            <div className="p-5">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nombre de la cámara
              </label>
              <input
                type="text"
                value={cameraName}
                onChange={(e) => setCameraName(e.target.value)}
                placeholder="Ej: Cámara Entrada Principal"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-uta-navy focus:outline-none focus:ring-2 focus:ring-uta-navy/20 transition"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && cameraName.trim()) handleCreateCamera()
                }}
              />
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleCancelCamera}
                className="flex-1 py-2.5 px-4 border-2 border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCamera}
                disabled={!cameraName.trim() || isCreating}
                className="flex-1 py-2.5 px-4 bg-uta-navy text-white text-sm font-bold rounded-lg hover:bg-uta-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isCreating ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: EDITAR CÁMARA ========== */}
      {editingCamera && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-fade-in">
            <div className="bg-uta-navy px-5 py-3">
              <h3 className="text-white font-bold text-sm">Editar Cámara</h3>
              <p className="text-white/70 text-xs mt-0.5">
                ID: {editingCamera.id}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nombre de la cámara
                </label>
                <input
                  type="text"
                  value={editCameraName}
                  onChange={(e) => setEditCameraName(e.target.value)}
                  placeholder="Ej: Cámara Entrada Principal"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-uta-navy focus:outline-none focus:ring-2 focus:ring-uta-navy/20 transition"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editCameraName.trim()) handleUpdateCamera()
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Estado de conectividad
                </label>
                <select
                  value={editCameraStatus}
                  onChange={(e) => setEditCameraStatus(e.target.value as 'Activa' | 'Inactiva')}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-uta-navy focus:outline-none focus:ring-2 focus:ring-uta-navy/20 transition bg-white"
                >
                  <option value="Activa">Activa</option>
                  <option value="Inactiva">Inactiva</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleCancelEdit}
                className="flex-1 py-2.5 px-4 border-2 border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateCamera}
                disabled={!editCameraName.trim() || isUpdating}
                className="flex-1 py-2.5 px-4 bg-uta-navy text-white text-sm font-bold rounded-lg hover:bg-uta-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isUpdating ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: CONFIRMAR ELIMINACIÓN ========== */}
      {cameraToDelete && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-fade-in">
            <div className="bg-red-600 px-5 py-3">
              <h3 className="text-white font-bold text-sm">Eliminar Cámara</h3>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-700">
                ¿Estás seguro de que deseas eliminar la cámara{' '}
                <strong className="text-gray-900">"{cameraToDelete.nombre}"</strong>?
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleCancelDelete}
                className="flex-1 py-2.5 px-4 border-2 border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteCamera(cameraToDelete)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Botón flotante "Mi ubicación" ─────────────────── */}
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

      {/* ── Toast de error de ubicación ───────────────────── */}
      {(status === 'denied' || status === 'error') && errorMsg && (
        <div className="location-error-toast">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* ── GoogleMap SIN LoadScript ──────────────────────── */}
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

        {/* ══ MARCADOR + CÍRCULO DE PRECISIÓN (ubicación del usuario) ══ */}
        {status === 'success' && location && (
          <>
            {location.accuracy && location.accuracy < 200 && (
              <Circle
                center={{ lat: location.lat, lng: location.lng }}
                radius={Math.min(location.accuracy, 50)}
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
            <Marker
              position={{ lat: location.lat, lng: location.lng }}
              title="Tu ubicación actual"
              icon={userIconUrl}
              zIndex={20}
            />
          </>
        )}
      </GoogleMap>
    </div>
  )
}
