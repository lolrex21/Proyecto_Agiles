// src/components/Map/IncidentMap.tsx

import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';
import type { Incident } from '../../types/incident';
import './IncidentMap.css';

interface IncidentMapProps {
  incidents: Incident[];
  loading: boolean;
  onMarkerClick?: (incident: Incident) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -1.2345, // Coordenadas UTA Ambato
  lng: -78.6234,
};

const zoomLevel = 16;

export const IncidentMap: React.FC<IncidentMapProps> = ({
  incidents,
  loading,
  onMarkerClick
}) => {
  const [selectedMarker, setSelectedMarker] = useState<Incident | null>(null);

  const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: mapApiKey ?? '',
  });

  const getMarkerColor = (status: string): string => {
    switch (status) {
      case 'Activo':
        return '#ff0000'; // Rojo
      case 'Atendido':
        return '#ffa500'; // Naranja
      case 'Cerrado':
        return '#00aa00'; // Verde
      default:
        return '#0066cc'; // Azul
    }
  };

  const handleMarkerClick = (incident: Incident) => {
    setSelectedMarker(incident);
    if (onMarkerClick) {
      onMarkerClick(incident);
    }
  };

  if (!mapApiKey) {
    return (
      <div className="map-container error">
        <div className="error-message">
          <p>❌ Error al cargar el mapa</p>
          <small>No se encontró la clave de Google Maps. Revisa tu archivo .env.</small>
        </div>
      </div>
    );
  }

  if (loading || !isLoaded) {
    return (
      <div className="map-container loading">
        <div className="map-loader">
          <div className="spinner"></div>
          <p>Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="map-container error">
        <div className="error-message">
          <p>❌ Error al cargar el mapa</p>
          <small>{loadError.message || 'No se pudo cargar Google Maps.'}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      {incidents.length === 0 ? (
        <div className="no-incidents">
          <p>✓ No hay incidentes reportados</p>
          <small>El mapa se muestra sin marcadores</small>
        </div>
      ) : null}

      <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={zoomLevel}
          options={{
            styles: [
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#c9c9c9' }],
              },
              {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#f3f3f3' }],
              },
            ],
          }}
        >
          {/* Marcadores de incidentes */}
          {incidents.map((incident) => (
            <Marker
              key={incident.id}
              position={{
                lat: incident.latitude,
                lng: incident.longitude,
              }}
              title={incident.title}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: getMarkerColor(incident.status),
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              onClick={() => handleMarkerClick(incident)}
            />
          ))}

          {/* Ventana de información */}
          {selectedMarker && (
            <InfoWindow
              position={{
                lat: selectedMarker.latitude,
                lng: selectedMarker.longitude,
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="info-window">
                <h4>{selectedMarker.title}</h4>
                <p className={`status status-${selectedMarker.status.toLowerCase()}`}>
                  {selectedMarker.status}
                </p>
                <p className="location">📍 {selectedMarker.location}</p>
                <p className="time">⏱️ {selectedMarker.estimatedTime}</p>
                <p className="description">{selectedMarker.description}</p>
                <small>Reportado por: {selectedMarker.reportedBy}</small>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
    </div>
  );
};