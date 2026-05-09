// src/components/IncidentList/IncidentList.tsx

// src/components/IncidentList/IncidentList.tsx
import type { Incident } from '../../types/incident';
import { IncidentCard } from '../IncidentCard';
import './IncidentList.css';

interface IncidentListProps {
  incidents: Incident[];
  loading: boolean;
  onSelectIncident?: (incident: Incident) => void;
  onStatusUpdate?: (id: string, status: string) => void;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  incidents,
  loading,
  onSelectIncident,
  onStatusUpdate
}) => {
  if (loading) {
    return (
      <div className="incident-list loading">
        <div className="loader">Cargando incidentes...</div>
      </div>
    );
  }

  return (
    <div className="incident-list">
      <div className="list-header">
        <h3 className="list-title">
          Incidentes cercanos ({incidents.length})
        </h3>
      </div>

      {incidents.length === 0 ? (
        <div className="empty-state">
          <p>✓ No hay incidentes reportados</p>
        </div>
      ) : (
        <div className="incident-list-container">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onSelect={onSelectIncident}
              onStatusUpdate={onStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
};