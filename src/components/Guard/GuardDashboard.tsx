import { useState, useEffect, useMemo, useCallback } from 'react'
import Header from '../Header'
import SearchBar from '../SearchBar'
import IncidentMap from '../Map/IncidentMap'
import IncidentList from '../IncidentList'
import Toast from '../Toast'
import AssignedGuardsList from './AssignedGuardsList'
import ConfirmAttendanceButton from './ConfirmAttendanceButton'
import { useIncidents } from '../../hooks/useIncidents'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'
import { useAudioAlert } from '../../hooks/useAudioAlert'
import { useIncidentGuards } from '../../hooks/useIncidentGuards'
import { emergencySocket } from '../../services/emergencySocket'
import { supabase } from '../../services/supabaseClient'
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
  const [activeAlerts, setActiveAlerts] = useState<any[]>([])
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null)
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)
  const [alertToast, setAlertToast] = useState<{ message: string } | null>(null)
  const [alertedIncidentIds, setAlertedIncidentIds] = useState<Set<string>>(new Set())

  const { soundEnabled, toggleSound, playAlert } = useAudioAlert()

  const guardIdNum = user?.id ? Number(user.id) : 0
  const selectedIncidentId = selectedIncident ? Number(selectedIncident.id) : null
  const { guards: assignedGuards, loading: guardsLoading } = useIncidentGuards(selectedIncidentId)

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

  const sanitizeIncident = useCallback((incident: any) => {
    const { usuario, user, ...rest } = incident
    return rest
  }, [])

  const upsertLocalIncident = useCallback((incident: any) => {
    const cleanIncident = sanitizeIncident(incident)

    setActiveAlerts((prev) => {
      const incidentId = String(cleanIncident.id)
      const exists = prev.some((item) => String(item.id) === incidentId)

      if (exists) {
        return prev.map((item) =>
          String(item.id) === incidentId ? cleanIncident : item
        )
      }

      return [cleanIncident, ...prev]
    })
  }, [sanitizeIncident])

  const getIncidentById = useCallback(async (incidentId: number) => {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*')
      .eq('id', incidentId)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return data
  }, [])

  const checkActiveIncidentForGuard = useCallback(async () => {
    if (!guardId) return

    try {
      const { data, error } = await supabase
        .from('incidentes')
        .select('*')
        .eq('guardia_id', guardId)
        .eq('estado', 'Atendido')
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)

      if (data) {
        setCurrentIncidentId(String(data.id))
        upsertLocalIncident(data)
      } else {
        setCurrentIncidentId(null)
      }
    } catch (error) {
      console.error('No se pudo verificar el caso activo del guardia:', error)
    }
  }, [guardId, upsertLocalIncident])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    checkActiveIncidentForGuard()
  }, [checkActiveIncidentForGuard])

  const handleTakeIncident = useCallback(
    async (incident: any): Promise<boolean> => {
      if (!guardId) {
        alert('No se encontró el ID del guardia logueado.')
        return false
      }

      const incidentId = Number(incident.id)
      const incidentIdText = String(incident.id)

      if (!incident.id || Number.isNaN(incidentId)) {
        alert('El incidente no tiene un ID válido.')
        return false
      }

      if (incident.estado !== 'Pendiente') {
        alert(`Este incidente ya fue tomado o cerrado. Estado actual: ${incident.estado}`)
        return false
      }

      try {
        const { data: activeIncident, error: activeError } = await supabase
          .from('incidentes')
          .select('*')
          .eq('guardia_id', guardId)
          .eq('estado', 'Atendido')
          .neq('id', incidentId)
          .limit(1)
          .maybeSingle()

        if (activeError) throw new Error(activeError.message)

        if (activeIncident) {
          setCurrentIncidentId(String(activeIncident.id))
          upsertLocalIncident(activeIncident)
          alert(
            `Ya tienes un caso activo. Debes cerrar el incidente #${activeIncident.id} antes de tomar otro.`
          )
          return false
        }

        const existingIncident = await getIncidentById(incidentId)

        if (!existingIncident) {
          alert(`No existe ningún incidente con id ${incidentId}.`)
          return false
        }

        if (existingIncident.estado !== 'Pendiente') {
          alert(
            `No se puede tomar este incidente porque su estado actual es "${existingIncident.estado}".`
          )
          return false
        }

        const { error: updateError } = await supabase
          .from('incidentes')
          .update({
            estado: 'Atendido',
            guardia_id: guardId,
          })
          .eq('id', incidentId)
          .eq('estado', 'Pendiente')

        if (updateError) throw new Error(updateError.message)

        const updatedIncident = await getIncidentById(incidentId)

        if (
          !updatedIncident ||
          updatedIncident.estado !== 'Atendido' ||
          String(updatedIncident.guardia_id) !== guardId
        ) {
          alert('No se pudo confirmar la actualización del incidente.')
          return false
        }

        setCurrentIncidentId(incidentIdText)
        upsertLocalIncident(updatedIncident)
        setSelectedIncident(updatedIncident)

        // Register Primary Guard in junction table for multi-guard tracking
        await supabase
          .from('incidente_guardias')
          .insert({
            incidente_id: incidentId,
            guardia_id: Number(guardId),
            estado_asistencia: 'confirmado',
          })

        emergencySocket.takeIncident(incidentIdText, guardId, updatedIncident)
        emergencySocket.updateIncident(incidentIdText, 'Atendido', guardId)

        return true
      } catch (error) {
        console.error('Error tomando incidente:', error)
        alert('No se pudo tomar el incidente.')
        return false
      }
    },
    [guardId, getIncidentById, setSelectedIncident, upsertLocalIncident]
  )

  const handleCloseIncident = useCallback(
    async (incident: any): Promise<boolean> => {
      if (!guardId) {
        alert('No se encontró el ID del guardia logueado.')
        return false
      }

      const incidentId = Number(incident.id)
      const incidentIdText = String(incident.id)

      if (!incident.id || Number.isNaN(incidentId)) {
        alert('El incidente no tiene un ID válido.')
        return false
      }

      if (incident.estado !== 'Atendido') {
        alert('Solo puedes cerrar un caso que esté Atendido.')
        return false
      }

      if (String(incident.guardia_id) !== guardId) {
        alert('Solo el guardia que tomó este caso puede cerrarlo.')
        return false
      }

      try {
        const { error: closeError } = await supabase
          .from('incidentes')
          .update({
            estado: 'Cerrado',
          })
          .eq('id', incidentId)
          .eq('guardia_id', guardId)
          .eq('estado', 'Atendido')

        if (closeError) throw new Error(closeError.message)

        const closedIncident = await getIncidentById(incidentId)

        if (!closedIncident || closedIncident.estado !== 'Cerrado') {
          alert('No se pudo confirmar el cierre del incidente.')
          return false
        }

        setCurrentIncidentId(null)
        upsertLocalIncident(closedIncident)
        setSelectedIncident(closedIncident)

        emergencySocket.closeIncident(
          incidentIdText,
          guardId,
          'Caso cerrado',
          closedIncident
        )

        emergencySocket.updateIncident(incidentIdText, 'Cerrado', guardId)

        return true
      } catch (error) {
        console.error('Error cerrando incidente:', error)
        alert('No se pudo cerrar el incidente.')
        return false
      }
    },
    [guardId, getIncidentById, setSelectedIncident, upsertLocalIncident]
  )

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

      upsertLocalIncident(cleanIncident)

      if (cleanIncident.estado === 'Pendiente' && !alertedIncidentIds.has(incidentId)) {
        setAlertedIncidentIds((prev) => new Set(prev).add(incidentId))
        playAlert()

        const tipo = cleanIncident.tipo_incidente || 'Emergencia'
        const ubicacion = cleanIncident.ubicacion || 'Ubicación no especificada'
        setAlertToast({
          message: `ALERTA DE INCIDENTE — ${tipo} — ${ubicacion}`,
        })
        setTimeout(() => setAlertToast(null), 5000)

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Nueva emergencia', {
            body: cleanIncident.descripcion || 'Se ha reportado una nueva emergencia',
          })
        }
      }
    },
    [alertedIncidentIds, sanitizeIncident, upsertLocalIncident, playAlert]
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
      {alertToast && (
        <Toast
          message={alertToast.message}
          type="info"
          onClose={() => setAlertToast(null)}
        />
      )}

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

          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs font-semibold text-gray-600">Alertas de sonido</span>
            <button
              onClick={toggleSound}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                soundEnabled ? 'bg-uta-navy' : 'bg-gray-300'
              }`}
              aria-label="Toggle sound alerts"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
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
                    {selectedIncident.ubicacion || 'No especificada'}
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
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Guardia Principal</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {selectedIncident.guardia_id ? `Guardia #${selectedIncident.guardia_id}` : 'Sin asignar'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-uta-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Guardias de Apoyo</span>
                  </div>
                  <AssignedGuardsList
                    guards={assignedGuards}
                    loading={guardsLoading}
                    primaryGuardId={String(selectedIncident.guardia_id)}
                  />
                  {selectedIncident.estado !== 'Cerrado' &&
                    String(selectedIncident.guardia_id) !== guardId && (
                      <div className="mt-3">
                        <ConfirmAttendanceButton
                          incidentId={Number(selectedIncident.id)}
                          guardId={guardIdNum}
                          isAlreadyAssigned={assignedGuards.some((g) => g.guardia_id === guardIdNum)}
                          onConfirm={() => {}}
                        />
                      </div>
                    )}
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
                      Solo el Guardia Principal puede cerrar este caso.
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