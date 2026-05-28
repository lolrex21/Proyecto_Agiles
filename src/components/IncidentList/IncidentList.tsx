import type { Incident } from '../../types/incident'
import IncidentCard from '../IncidentCard'

interface IncidentListProps {
  incidents: Incident[]
  loading: boolean
  onSelect: (incident: Incident) => void
  onStatusUpdate: (
    id: number,
    status: 'Pendiente' | 'Atendido' | 'Cerrado'
  ) => Promise<boolean>
}

export default function IncidentList({
  incidents,
  loading,
  onSelect,
  onStatusUpdate,
}: IncidentListProps) {
  if (loading) {
    return <div className="bg-white rounded-lg p-4">Cargando...</div>
  }

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4 text-gray-900">
        Incidentes cercanos ({incidents.length})
      </h3>

      {incidents.length === 0 ? (
        <p className="text-gray-600 text-center py-8">
          ✓ No hay incidentes reportados
        </p>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onSelect={() => onSelect(incident)}
              onStatusUpdate={onStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}