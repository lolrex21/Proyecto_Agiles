// src/components/IncidentCard/IncidentCard.tsx

// src/components/IncidentCard/IncidentCard.tsx
import type { Incident } from '../../types/incident';
import './IncidentCard.css';

interface IncidentCardProps {
  incident: Incident;
  onSelect?: (incident: Incident) => void;
  onStatusUpdate?: (id: string, status: string) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onSelect,
  onStatusUpdate
}) => {
  const getStatusClass = (status: string) => {
    return `status status-${status.toLowerCase()}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Robo':
        return '🔓';
      case 'Emergencia Médica':
        return '🏥';
      case 'Incendio':
        return '🔥';
      default:
        return '⚠️';
    }
  };

  return (
    <div className="incident-card" onClick={() => onSelect?.(incident)}>
      <div className="card-header">
        <span className="card-icon">{getTypeIcon(incident.type)}</span>
        <h3 className="card-title">{incident.title}</h3>
        <span className={getStatusClass(incident.status)}>
          {incident.status}
        </span>
      </div>

      <div className="card-content">
        <p className="location">📍 {incident.location}</p>
        <p className="description">{incident.description}</p>

        <div className="card-meta">
          <div className="meta-item">
            <span className="meta-label">Reportado por:</span>
            <span className="meta-value">{incident.reportedBy}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Tiempo estimado:</span>
            <span className="meta-value">{incident.estimatedTime}</span>
          </div>
        </div>
      </div>

      {onStatusUpdate && incident.status !== 'Cerrado' && (
        <div className="card-actions">
          <button
            className="action-btn next"
            onClick={(e) => {
              e.stopPropagation();
              const nextStatus = incident.status === 'Activo' ? 'Atendido' : 'Cerrado';
              onStatusUpdate(incident.id, nextStatus);
            }}
          >
            {incident.status === 'Activo' ? 'Marcar Atendido' : 'Cerrar'}
          </button>
        </div>
      )}
    </div>
  );
};