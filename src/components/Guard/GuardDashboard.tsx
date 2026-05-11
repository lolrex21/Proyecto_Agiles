import { useState, useEffect, useMemo, useCallback } from 'react'
import Header from '../Header'
import SearchBar from '../SearchBar'
import IncidentMap from '../Map/IncidentMap'
import IncidentList from '../IncidentList'
import { useIncidents } from '../../hooks/useIncidents'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'
import { emergencySocket } from '../../services/emergencySocket'
import { supabase } from '../../services/supabaseClient'
import { getCurrentUser } from '../../services/authService'
import './GuardDashboard.css'

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

  const upsertLocalIncident = useCallback((incident: any) => {
    setActiveAlerts((prev) => {
      const incidentId = String(incident.id)
      const exists = prev.some((item) => String(item.id) === incidentId)

      if (exists) {
        return prev.map((item) =>
          String(item.id) === incidentId ? incident : item
        )
      }

      return [incident, ...prev]
    })
  }, [])

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

        emergencySocket.takeIncident(incidentIdText, guardId, updatedIncident)

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
    const normalizedIncident = {
      ...incident,
      estado: incident.estado || 'Pendiente',
    }

    upsertLocalIncident(normalizedIncident)

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nueva emergencia', {
        body:
          normalizedIncident.descripcion ||
          'Se ha reportado una nueva emergencia',
      })
    }
  },
  [upsertLocalIncident]
)

const handleSocketIncidentTaken = useCallback(
  ({ incidentId, guardId: assignedGuardId, incident }: any) => {
    const normalizedIncidentId = String(incidentId)

    const updatedIncident = {
      ...incident,
      estado: 'Atendido',
      guardia_id: assignedGuardId,
    }

    upsertLocalIncident(updatedIncident)

    if (String(assignedGuardId) === String(guardId)) {
      setCurrentIncidentId(normalizedIncidentId)
    }

    setSelectedIncident((prev: any) => {
      if (!prev || String(prev.id) !== normalizedIncidentId) return prev
      return { ...prev, ...updatedIncident }
    })
  },
  [guardId, setSelectedIncident, upsertLocalIncident]
)

const handleSocketIncidentClosed = useCallback(
  ({ incidentId, incident }: any) => {
    const normalizedIncidentId = String(incidentId)

    const closedIncident = {
      ...incident,
      estado: 'Cerrado',
    }

    upsertLocalIncident(closedIncident)

    setCurrentIncidentId((prev) =>
      prev === normalizedIncidentId ? null : prev
    )

    setSelectedIncident((prev: any) => {
      if (!prev || String(prev.id) !== normalizedIncidentId) return prev
      return { ...prev, ...closedIncident }
    })
  },
  [setSelectedIncident, upsertLocalIncident]
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
              </div>
            </article>
          )}

          {(viewMode === 'split' || viewMode === 'list') && (
            <article className="dashboard-card list-section">
              <div className="section-header compact-header">
                <div>
                  <h2>Alertas activas</h2>
                  <p>{visibleIncidents.length} incidente(s) registrados</p>
                </div>
              </div>

              <div className="incident-list-scroll">
                <IncidentList
                  incidents={visibleIncidents}
                  loading={loading}
                  onSelect={setSelectedIncident}
                  onStatusUpdate={handleIncidentStatusUpdate}
                />
              </div>
            </article>
          )}
        </section>

        {selectedIncident && (
          <div className="incident-detail-panel">
            <button
              onClick={() => setSelectedIncident(null)}
              className="close-btn"
            >
              ✕
            </button>

            <h3>{selectedIncident.tipo_incidente}</h3>

            <p className="incident-description">
              {selectedIncident.descripcion}
            </p>

            <p>
              Estado:{' '}
              <strong
                className={`status status-${String(selectedIncident.estado)
                  .toLowerCase()
                  .replace(/\s+/g, '-')}`}
              >
                {selectedIncident.estado}
              </strong>
            </p>

            {selectedIncident.guardia_id && (
              <p>
                Guardia asignado:{' '}
                <strong>{selectedIncident.guardia_id}</strong>
              </p>
            )}

            {selectedIncident.estado === 'Pendiente' && (
              <button
                onClick={() => handleTakeIncident(selectedIncident)}
                className="take-case-btn"
              >
                Tomar caso
              </button>
            )}

            {selectedIncident.estado === 'Atendido' &&
              String(selectedIncident.guardia_id) === guardId && (
                <button
                  onClick={() => handleCloseIncident(selectedIncident)}
                  className="take-case-btn"
                >
                  Cerrar caso
                </button>
              )}

            {selectedIncident.estado === 'Atendido' &&
              String(selectedIncident.guardia_id) !== guardId && (
                <p className="busy-message">
                  Este caso ya fue tomado por otro guardia.
                </p>
              )}

            {!!currentIncidentId &&
              selectedIncident.estado === 'Pendiente' &&
              currentIncidentId !== String(selectedIncident.id) && (
                <p className="busy-message">
                  Ya tienes una alerta activa. Cierra ese caso antes de tomar otro.
                </p>
              )}
          </div>
        )}
      </main>
    </div>
  )
}