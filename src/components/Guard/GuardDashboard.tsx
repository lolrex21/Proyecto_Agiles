// src/components/Guard/GuardDashboard.tsx

import { useState } from 'react';
import { Header } from '../Header';
import { SearchBar } from '../SearchBar';
import { IncidentMap } from '../Map';
import { IncidentList } from '../IncidentList';
import { useIncidents } from '../../hooks/useIncidents';
import './GuardDashboard.css';

export const GuardDashboard: React.FC = () => {
  const {
    incidents,
    loading,
    selectedIncident,
    setSelectedIncident,
    updateIncidentStatus,
    searchIncidents
  } = useIncidents();

  const [displayMode, setDisplayMode] = useState<'split' | 'map' | 'list'>('split');

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      searchIncidents('');
    } else {
      searchIncidents(query);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    const success = await updateIncidentStatus(id, status);
    if (success) {
      alert(`Incidente actualizado a: ${status}`);
    }
  };

  return (
    <div className="guard-dashboard">
      <Header userName="Jonathan Gamboa Guarda" userZone="Zona I" />

      <main className="dashboard-main">
        <SearchBar onSearch={handleSearch} />

        <div className="dashboard-controls">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${displayMode === 'split' ? 'active' : ''}`}
              onClick={() => setDisplayMode('split')}
            >
              📊 Vista Dividida
            </button>
            <button
              className={`toggle-btn ${displayMode === 'map' ? 'active' : ''}`}
              onClick={() => setDisplayMode('map')}
            >
              🗺️ Solo Mapa
            </button>
            <button
              className={`toggle-btn ${displayMode === 'list' ? 'active' : ''}`}
              onClick={() => setDisplayMode('list')}
            >
              📋 Solo Lista
            </button>
          </div>
        </div>

        <div className={`dashboard-content ${displayMode}`}>
          {(displayMode === 'split' || displayMode === 'map') && (
            <div className="map-section">
              <IncidentMap
                incidents={incidents}
                loading={loading}
                onMarkerClick={setSelectedIncident}
              />
            </div>
          )}

          {(displayMode === 'split' || displayMode === 'list') && (
            <div className="list-section">
              <IncidentList
                incidents={incidents}
                loading={loading}
                onSelectIncident={setSelectedIncident}
                onStatusUpdate={handleStatusUpdate}
              />
            </div>
          )}
        </div>

        {selectedIncident && (
          <div className="incident-detail-panel">
            <button
              className="close-btn"
              onClick={() => setSelectedIncident(null)}
            >
              ✕
            </button>
            <h3>{selectedIncident.title}</h3>
            <p><strong>Ubicación:</strong> {selectedIncident.location}</p>
            <p><strong>Descripción:</strong> {selectedIncident.description}</p>
            <p><strong>Reportado por:</strong> {selectedIncident.reportedBy}</p>
            <p><strong>Estado:</strong> <span className={`status status-${selectedIncident.status.toLowerCase()}`}>{selectedIncident.status}</span></p>
          </div>
        )}
      </main>
    </div>
  );
};