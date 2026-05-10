import type { Incident } from '../../types/incident'

interface IncidentCardProps {
  incident: Incident
  onSelect: () => void
  onStatusUpdate: (id: number, status: 'Pendiente' | 'Atendido' | 'Cerrado') => Promise<boolean>
}

export default function IncidentCard({
  incident,
  onSelect,
  onStatusUpdate,
}: IncidentCardProps) {
  const getIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      robo: '🔓',
      agresion: '⚠️',
      vandalismo: '🔨',
      sospechoso: '👁️',
      accidente: '🚨',
      otro: '📌',
    }
    return icons[tipo] || '📌'
  }

  const statusColors: Record<string, string> = {
    Pendiente: 'bg-red-100 text-red-800',
    Atendido: 'bg-yellow-100 text-yellow-800',
    Cerrado: 'bg-green-100 text-green-800',
  }

  const handleStatusClick = async () => {
    const nextStatus =
      incident.estado === 'Pendiente'
        ? 'Atendido'
        : incident.estado === 'Atendido'
        ? 'Cerrado'
        : 'Pendiente'

    await onStatusUpdate(incident.id, nextStatus)
  }

  return (
    <div
      className="bg-white border-l-4 border-red-500 rounded p-4 mb-3 cursor-pointer hover:shadow-lg transition"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getIcon(incident.tipo_incidente)}</span>
          <div>
            <h4 className="font-bold text-sm">{incident.tipo_incidente.toUpperCase()}</h4>
            <p className="text-xs text-gray-500">
              {new Date(incident.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-bold rounded ${statusColors[incident.estado]}`}>
          {incident.estado}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-2">{incident.descripcion}</p>
      <p className="text-xs text-gray-500 mb-3">Por: {incident.usuario?.nombre}</p>

      {incident.estado !== 'Cerrado' && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleStatusClick()
          }}
          className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700"
        >
          {incident.estado === 'Pendiente' ? 'Marcar Atendido' : 'Marcar Cerrado'}
        </button>
      )}
    </div>
  )
}