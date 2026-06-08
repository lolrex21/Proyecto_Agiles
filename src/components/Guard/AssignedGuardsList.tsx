import type { AssignedGuard } from '../../services/incidentGuardService'

interface AssignedGuardsListProps {
  guards: AssignedGuard[]
  loading: boolean
  primaryGuardId?: string
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmado', color: 'text-green-700', bg: 'bg-green-100' },
  en_camino: { label: 'En camino', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  llego: { label: 'En el lugar', color: 'text-blue-700', bg: 'bg-blue-100' },
}

export default function AssignedGuardsList({ guards, loading, primaryGuardId }: AssignedGuardsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-uta-navy/30 border-t-uta-navy rounded-full animate-spin" />
      </div>
    )
  }

  if (guards.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic text-center py-3">
        No hay guardias asignados adicionalmente
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {guards.map((guard) => {
        const isPrimary = String(guard.guardia_id) === primaryGuardId
        const status = statusConfig[guard.estado_asistencia] || statusConfig.confirmado

        return (
          <div
            key={guard.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
              isPrimary ? 'border-uta-navy/30 bg-uta-navy/5' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
              isPrimary ? 'bg-uta-navy' : 'bg-gray-500'
            }`}>
              {guard.usuario?.nombre?.charAt(0).toUpperCase() || 'G'}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {guard.usuario?.nombre || `Guardia #${guard.guardia_id}`}
                {isPrimary && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-uta-navy/70">
                    Principal
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {guard.usuario?.correo || 'Correo no disponible'}
              </p>
            </div>

            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
