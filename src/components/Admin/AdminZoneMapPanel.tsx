import { useMemo, useState } from 'react'
import {
  GoogleMap,
  Polygon,
  useJsApiLoader,
} from '@react-google-maps/api'

type AdminZoneMapPanelProps = {
  zones: any[]
  onEditZone?: (zone: any) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const defaultCenter = {
  lat: -1.2685,
  lng: -78.6245,
}

export default function AdminZoneMapPanel({
  zones,
  onEditZone,
}: AdminZoneMapPanelProps) {
  const [selectedZone, setSelectedZone] = useState<any | null>(zones[0] || null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  })

  const selectedZoneId = selectedZone?.id

  const validZones = useMemo(() => {
    return zones.filter((zone) => Array.isArray(zone.coordenadas))
  }, [zones])

  if (!isLoaded) {
    return (
      <article className="dashboard-card admin-zone-map-section">
        <div className="section-header compact-header">
          <div>
            <h2>Mapa de zonas</h2>
            <p>Cargando mapa del campus...</p>
          </div>
        </div>

        <div className="p-4 text-sm text-gray-600">Cargando...</div>
      </article>
    )
  }

  return (
    <article className="dashboard-card admin-zone-map-section">
      <div className="section-header compact-header">
        <div>
          <h2>Mapa de zonas</h2>
        </div>
      </div>

      <div className="admin-zone-map-layout">
        <div className="admin-zone-map-box">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={17}
            options={{
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: true,
              zoomControl: true,
            }}
          >
           {validZones.map((zone: any) => {
              const isSelected = selectedZoneId === zone.id

              return (
                <Polygon
                  key={zone.id}
                  paths={zone.coordenadas}
                  options={{
                    strokeColor: zone.color || '#2563eb',
                    strokeOpacity: isSelected ? 1 : 0.65,
                    strokeWeight: isSelected ? 5 : 2,
                    fillColor: zone.color || '#2563eb',
                    fillOpacity: isSelected ? 0.32 : 0.12,
                    clickable: true,
                  }}
                  onClick={() => setSelectedZone(zone)}
                />
              )
            })}
          </GoogleMap>
        </div>

        <aside className="admin-zone-map-sidebar">
          <div className="admin-zone-map-sidebar-header">
          </div>

          {selectedZone && (
            <div className="admin-zone-selected-card">
              <div className="admin-zone-selected-title">
                <span
                  className="admin-zone-color"
                  style={{
                    backgroundColor: selectedZone.color || '#94a3b8',
                  }}
                />

                <div>
                  <h4>{selectedZone.nombre}</h4>
                  <p>{selectedZone.campus || 'Campus no especificado'}</p>
                </div>
              </div>

              <p>{selectedZone.descripcion || 'Sin descripción registrada.'}</p>

              <div className="admin-zone-selected-meta">
                <span>Tipo: {selectedZone.zona_tipo || 'No definido'}</span>
                <span>
                  Coordenadas:{' '}
                  {Array.isArray(selectedZone.coordenadas)
                    ? selectedZone.coordenadas.length
                    : 'Registradas'}
                </span>
              </div>

              <button
                type="button"
                className="admin-zone-edit-btn full"
                onClick={() => onEditZone?.(selectedZone)}
              >
                Editar esta zona
              </button>
            </div>
          )}

          <div className="admin-zone-map-list">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`admin-zone-map-item ${
                  selectedZoneId === zone.id ? 'active' : ''
                }`}
                onClick={() => setSelectedZone(zone)}
              >
                <span
                  className="admin-zone-map-dot"
                  style={{ backgroundColor: zone.color || '#94a3b8' }}
                />

                <div>
                  <strong>{zone.nombre}</strong>
                  <small>{zone.zona_tipo || 'Sin tipo'}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </article>
  )
}