import type { Incident } from '../../types/incident'
import IncidentCard from '../IncidentCard'

interface IncidentListProps {
  incidents: Incident[]
  loading: boolean
  onSelect: (incident: Incident) => void
  onMap?: (incident: Incident) => void
  onStatusUpdate?: (
    id: number,
    status: 'Pendiente' | 'Atendido' | 'Cerrado'
  ) => Promise<boolean>
  showActions?: boolean
  emptyMessage?: string
}

export default function IncidentList({
  incidents,
  loading,
  onSelect,
  onMap,
  onStatusUpdate,
  showActions = true,
  emptyMessage = 'No hay incidentes reportados.',
}: IncidentListProps) {
  if (loading) {
    return <div className="bg-white rounded-lg p-4">Cargando...</div>
  }

  return (
    <div className="incident-list-panel bg-white rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4 text-gray-900">
        Incidentes ({incidents.length})
      </h3>

      {incidents.length === 0 ? (
        <p className="text-gray-600 text-center py-8">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onSelect={() => onSelect(incident)}
              onMap={() => onMap?.(incident)}
              onStatusUpdate={onStatusUpdate}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}