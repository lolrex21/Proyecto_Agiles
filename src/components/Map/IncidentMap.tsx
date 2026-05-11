import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api'
import { useState } from 'react'
import type { Incident } from '../../types/incident'

interface IncidentMapProps {
  incidents: Incident[]
  loading: boolean
  onMarkerClick?: (incident: Incident) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const defaultCenter = {
  lat: -1.268083,
  lng: -78.624306,
}

const defaultZoom = 17

export default function IncidentMap({
  incidents,
  loading,
  onMarkerClick,
}: IncidentMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<Incident | null>(null)

  const handleMarkerClick = (incident: Incident) => {
    setSelectedMarker(incident)

    if (onMarkerClick) {
      onMarkerClick(incident)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
        Cargando mapa...
      </div>
    )
  }

  const incidentsWithLocation = incidents.filter((incident) => {
    const lat = Number(incident.latitud)
    const lng = Number(incident.longitud)

    return !Number.isNaN(lat) && !Number.isNaN(lng)
  })

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative bg-gray-100">
      {incidentsWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
          <p className="text-gray-600">✓ No hay incidentes con ubicación</p>
        </div>
      )}

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={defaultZoom}
          options={{
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
          }}
        >
          {incidentsWithLocation.map((incident) => (
            <Marker
              key={incident.id}
              position={{
                lat: Number(incident.latitud),
                lng: Number(incident.longitud),
              }}
              title={incident.tipo_incidente}
              onClick={() => handleMarkerClick(incident)}
            />
          ))}

          {selectedMarker && selectedMarker.latitud && selectedMarker.longitud && (
            <InfoWindow
              position={{
                lat: Number(selectedMarker.latitud),
                lng: Number(selectedMarker.longitud),
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-2 max-w-xs">
                <h4 className="font-bold text-sm mb-1">
                  {selectedMarker.tipo_incidente}
                </h4>

                <p className="text-xs text-gray-600 mb-1">
                  {selectedMarker.estado}
                </p>

                <p className="text-xs">
                  {selectedMarker.descripcion}
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  )
}