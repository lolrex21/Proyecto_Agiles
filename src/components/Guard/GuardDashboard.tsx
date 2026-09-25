import { useState, useMemo, useCallback } from 'react'
import Header from '../Header'
import SearchBar from '../SearchBar'
import IncidentMap from '../Map/IncidentMap'
import IncidentList from '../IncidentList'
import { useIncidents } from '../../hooks/useIncidents'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'
import { useGuardActions } from '../../hooks/useGuardActions'
import { useNotificationPermission } from '../../hooks/useNotificationPermission'
import { getCurrentUser } from '../../services/authService'
import './GuardDashboard.css'
import { usePolygons } from '../../hooks/usePolygons'
import ZoneLegend from '../Map/ZoneLegend'

type IncidentStatus = 'Pendiente' | 'Atendido' | 'Cerrado'

export default function GuardDashboard() {
  const {
    incidents,
    loading,
    selectedIncident,
    setSelectedIncident,
    handleSearch,
  } = useIncidents()

  const user = getCurrentUser()
  const guardId = user?.id ? String(user.id) : ''

  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split')
  useNotificationPermission()

  const {
    activeAlerts,
    currentIncidentId,
    confirmCloseId,
    setConfirmCloseId,
    setCurrentIncidentId,
    upsertLocalIncident,
    sanitizeIncident,
    handleTakeIncident,
    handleCloseIncident,
  } = useGuardActions(guardId, setSelectedIncident)

  const visibleIncidents = useMemo(() => {
    const map = new Map<string, any>()

    incidents.forEach((incident: any) => {
      map.set(String(incident.id), incident)
    })

    activeAlerts.forEach((incident: any) => {
      map.set(String(incident.id), {
        ...map.get(String(incident.id)),
        ...incident,
      })
    })

    return Array.from(map.values())
  }, [incidents, activeAlerts])

  const activeIncidents = useMemo(() => {
    return visibleIncidents.filter(
      (inc: any) => inc.estado !== 'Cerrado' && inc.estado !== 'Cancelado'
    )
  }, [visibleIncidents])



  const handleIncidentStatusUpdate = useCallback(
    async (id: number, status: IncidentStatus): Promise<boolean> => {
      const incident = visibleIncidents.find(
        (item: any) => String(item.id) === String(id)
      )

      if (!incident) {
        alert('No se encontró el incidente seleccionado.')
        return false
      }

      if (status === 'Atendido') {
        return handleTakeIncident(incident)
      }

      if (status === 'Cerrado') {
        return handleCloseIncident(incident)
      }

      return false
    },
    [visibleIncidents, handleTakeIncident, handleCloseIncident]
  )

  const handleNewSocketIncident = useCallback(
    (incident: any) => {
      const cleanIncident = sanitizeIncident({
        ...incident,
        estado: incident.estado || 'Pendiente',
      })

      const incidentId = String(cleanIncident.id)
      const yaConocido =
        activeAlerts.some((i) => String(i.id) === incidentId) ||
        incidents.some((i: any) => String(i.id) === incidentId)

      upsertLocalIncident(cleanIncident)

      if (
        cleanIncident.estado === 'Pendiente' &&
        !yaConocido &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Nueva emergencia', {
          body: cleanIncident.descripcion || 'Se ha reportado una nueva emergencia',
        })
      }
    },
    [activeAlerts, incidents, sanitizeIncident, upsertLocalIncident]
  )

const handleSocketIncidentTaken = useCallback(
  ({ incidentId, guardId: assignedGuardId, incident }: any) => {
    const normalizedIncidentId = String(incidentId)
    const cleanIncident = sanitizeIncident({
      ...incident,
      estado: 'Atendido',
      guardia_id: assignedGuardId,
    })

    upsertLocalIncident(cleanIncident)

    if (String(assignedGuardId) === String(guardId)) {
      setCurrentIncidentId(normalizedIncidentId)
    }

    setSelectedIncident((prev: any) => {
      if (!prev || String(prev.id) !== normalizedIncidentId) return prev
      return { ...prev, ...cleanIncident }
    })
  },
  [guardId, sanitizeIncident, setSelectedIncident, upsertLocalIncident]
)

const handleSocketIncidentClosed = useCallback(
  ({ incidentId, incident }: any) => {
    const normalizedIncidentId = String(incidentId)
    const cleanIncident = sanitizeIncident({
      ...incident,
      estado: 'Cerrado',
    })

    upsertLocalIncident(cleanIncident)

    setCurrentIncidentId((prev) =>
      prev === normalizedIncidentId ? null : prev
    )

    setSelectedIncident((prev: any) => {
      if (!prev || String(prev.id) !== normalizedIncidentId) return prev
      return { ...prev, ...cleanIncident }
    })
  },
  [sanitizeIncident, setSelectedIncident, upsertLocalIncident]
)

const handleGuardBusy = useCallback((payload: any) => {
  alert(payload.message)
}, [])

  useEmergencySocket({
  role: 'guard',
  userId: guardId,
  onNewIncident: handleNewSocketIncident,
  onIncidentTaken: handleSocketIncidentTaken,
  onIncidentClosed: handleSocketIncidentClosed,
  onGuardBusy: handleGuardBusy,
})

const { zones } = usePolygons()

  return (
    <div className="guard-dashboard">
      <Header />

      <main className="dashboard-main">
        <section className="dashboard-toolbar">
          <div className="dashboard-search">
            <SearchBar onSearch={handleSearch} />
          </div>

          <div className="view-toggle compact">
            <button
              onClick={() => setViewMode('split')}
              className={`toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
              title="Vista dividida"
            >
              Dividida
            </button>

            <button
              onClick={() => setViewMode('map')}
              className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
              title="Ver solo mapa"
            >
              Mapa
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="Ver solo lista"
            >
              Lista
            </button>
          </div>
        </section>

        <section className={`dashboard-content ${viewMode}`}>
          {(viewMode === 'split' || viewMode === 'map') && (
            <article className="dashboard-card map-section">
              <div className="section-header compact-header">
                <div>
                  <h2>Mapa de emergencias</h2>
                  <p>Ubicación de las alertas reportadas</p>
                </div>
              </div>

              <div className="map-wrapper">
                <IncidentMap
                  incidents={visibleIncidents}
                  loading={loading}
                  onMarkerClick={setSelectedIncident}
                />
                <ZoneLegend zones={zones} />
              </div>
            </article>
          )}

          {(viewMode === 'split' || viewMode === 'list') && (
            <article className="dashboard-card list-section">
              <div className="section-header compact-header">
                <div>
                  <h2>Alertas activas</h2>
                  <p>{activeIncidents.length} incidente(s) activos</p>
                </div>
              </div>

              <div className="incident-list-scroll">
                <IncidentList
                  incidents={activeIncidents}
                  loading={loading}
                  onSelect={setSelectedIncident}
                  onStatusUpdate={handleIncidentStatusUpdate}
                />
              </div>
            </article>
          )}
        </section>

        {selectedIncident && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                <h3 className="text-lg font-bold text-uta-navy">
                  Detalles del Incidente: {selectedIncident.tipo_incidente}
                </h3>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-uta-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Ubicación</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {selectedIncident.descripcion || 'No especificada'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-uta-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Descripción</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {selectedIncident.descripcion}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-uta-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Guardia Asignado</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {selectedIncident.guardia_id ? `Guardia #${selectedIncident.guardia_id}` : 'Sin asignar'}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Estado:</span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                    selectedIncident.estado === 'Cerrado'
                      ? 'bg-gray-100 text-gray-600'
                      : selectedIncident.estado === 'Atendido'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedIncident.estado}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="py-2 px-4 border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Volver
                </button>

                {selectedIncident.estado === 'Pendiente' && (
                  <button
                    onClick={() => handleTakeIncident(selectedIncident)}
                    className="py-2 px-4 bg-uta-navy hover:bg-uta-navy/90 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Tomar caso
                  </button>
                )}

                {selectedIncident.estado === 'Atendido' &&
                  String(selectedIncident.guardia_id) === guardId &&
                  confirmCloseId === selectedIncident.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmCloseId(null)}
                        className="py-2 px-4 border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          await handleCloseIncident(selectedIncident)
                          setConfirmCloseId(null)
                        }}
                        className="py-2 px-4 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Confirmar cierre
                      </button>
                    </div>
                  )}

                {selectedIncident.estado === 'Atendido' &&
                  String(selectedIncident.guardia_id) === guardId &&
                  confirmCloseId !== selectedIncident.id && (
                    <button
                      onClick={() => setConfirmCloseId(selectedIncident.id)}
                      className="py-2 px-4 bg-uta-navy hover:bg-uta-navy/90 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Cerrar caso
                    </button>
                  )}

                {selectedIncident.estado === 'Atendido' &&
                  String(selectedIncident.guardia_id) !== guardId && (
                    <span className="text-xs text-gray-500 italic">
                      Este caso ya fue tomado por otro guardia.
                    </span>
                  )}

                {!!currentIncidentId &&
                  selectedIncident.estado === 'Pendiente' &&
                  currentIncidentId !== String(selectedIncident.id) && (
                    <span className="text-xs text-gray-500 italic">
                      Ya tienes una alerta activa. Cierra ese caso antes de tomar otro.
                    </span>
                  )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}