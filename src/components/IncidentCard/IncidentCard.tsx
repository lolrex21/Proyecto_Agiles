import type { Incident } from '../../types/incident'

interface IncidentCardProps {
  incident: Incident
  onSelect: () => void
  onMap?: () => void
  onStatusUpdate?: (
    id: number,
    status: 'Pendiente' | 'Atendido' | 'Cerrado'
  ) => Promise<boolean>
  showActions?: boolean
}

export default function IncidentCard({
  incident,
  onSelect,
  onMap,
  onStatusUpdate,
  showActions = true,
}: IncidentCardProps) {
  const getIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      robo: '',
      agresion: '',
      vandalismo: '',
      sospechoso: '',
      accidente: '',
      incendio: '',
      otro: '',
    }

    return icons[tipo?.toLowerCase()] || ''
  }

  const statusColors: Record<string, string> = {
    Pendiente: 'bg-red-100 text-red-800',
    Atendido: 'bg-yellow-100 text-yellow-800',
    Cerrado: 'bg-green-100 text-green-800',
  }

  const formatDate = (fecha?: string) => {
    if (!fecha) return 'Fecha no disponible'

    return new Date(fecha).toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const handleTakeIncident = async () => {
    if (!onStatusUpdate) return
    await onStatusUpdate(incident.id, 'Atendido')
  }

  const handleCloseIncident = async () => {
    if (!onStatusUpdate) return
    await onStatusUpdate(incident.id, 'Cerrado')
  }

  return (
    <div className="bg-white border-l-4 border-red-500 rounded p-4 mb-3 hover:shadow-md transition">
      <div className="cursor-pointer" onClick={onSelect}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-2">
            <span className="text-2xl">
              {getIcon(incident.tipo_incidente)}
            </span>

            <div>
              <h4 className="font-bold text-sm text-gray-900">
                {incident.tipo_incidente.toUpperCase()}
              </h4>

              <p className="text-xs text-gray-500">
                {formatDate(incident.fecha)}
              </p>
            </div>
          </div>

          <span
            className={`px-2 py-1 text-xs font-bold rounded ${
              statusColors[incident.estado] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {incident.estado === 'Atendido' ? 'Atendiendo' : incident.estado}
          </span>
        </div>

        <p className="text-sm text-gray-700 mb-2">
          {incident.descripcion}
        </p>

        <p className="text-xs text-gray-500 mb-3">
          Por: {incident.usuario?.nombre || 'Usuario no identificado'}
        </p>
      </div>

      <div className="incident-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className="incident-action-btn secondary"
        >
          Ver detalles
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMap?.()
          }}
          className="incident-action-btn map"
        >
          Mapa
        </button>

        {showActions && incident.estado === 'Pendiente' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleTakeIncident()
            }}
            className="incident-action-btn primary"
          >
            Atender
          </button>
        )}

        {showActions && incident.estado === 'Atendido' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleCloseIncident()
            }}
            className="incident-action-btn danger"
          >
            Cerrar caso
          </button>
        )}
      </div>
    </div>
  )
}