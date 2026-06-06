import { useState, useEffect, useMemo, useCallback } from 'react'
import SearchBar from '../SearchBar'
import IncidentMap from '../Map/IncidentMap'
import IncidentList from '../IncidentList'
import NotificationBell from '../NotificationBell'
import { useIncidents } from '../../hooks/useIncidents'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'
import { emergencySocket } from '../../services/emergencySocket'
import { supabase } from '../../services/supabaseClient'
import { getCurrentUser, logout } from '../../services/authService'
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
  const userName = user?.nombre || user?.name || 'Usuario'
  const userEmail = user?.email || user?.correo || 'Correo no disponible'
  const userRole = user?.rol || user?.role || user?.tipo_usuario || 'estudiante'
  const isGuard = userRole === 'guardia' || userRole === 'guard'

  const handleLogout = async () => {
    await logout()
    window.location.replace('/')
  }

  const [viewMode] = useState<'split' | 'map' | 'list'>('split')
  const [activeAlerts, setActiveAlerts] = useState<any[]>([])
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null)
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

      {/* ── Contenido principal: mapa full-height + panel lateral ── */}
      <main
        className={`dashboard-main${listCollapsed ? ' panel-collapsed' : ''}${viewMode === 'map' ? ' view-map' : ''}${viewMode === 'list' ? ' view-list' : ''}`}
      >
        {/* ═══ MAPA (ocupa toda la pantalla de arriba a abajo) ═══ */}
        {viewMode !== 'list' && (
          <section className={`map-section${mapFullscreen ? ' map-fullscreen' : ''}`}>

            {/* Brand flotante sobre el mapa (esquina superior izquierda) */}
            <div className="map-brand-overlay">
              <div className="map-brand-icon">🛡️</div>
              <div className="map-brand-text">
                <span className="map-brand-title">UTA CampusSeguro</span>
                <span className="map-brand-sub">Sistema de alertas universitarias</span>
              </div>
            </div>

            {/* Controles flotantes (esquina superior derecha del mapa) — ocultos en mobile via CSS */}
            <div className="map-floating-controls">
              {viewMode === 'split' && (
                <button
                  className={`map-floating-btn${listCollapsed ? ' active' : ''}`}
                  onClick={() => setListCollapsed(v => !v)}
                  title={listCollapsed ? 'Mostrar panel lateral' : 'Colapsar panel lateral'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {listCollapsed ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
                  </svg>
                </button>
              )}
              <button
                className={`map-floating-btn${mapFullscreen ? ' active' : ''}`}
                onClick={() => setMapFullscreen(v => !v)}
                title={mapFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {mapFullscreen
                    ? <><polyline points="8 3 3 3 3 8"/><polyline points="21 8 21 3 16 3"/><polyline points="3 16 3 21 8 21"/><polyline points="16 21 21 21 21 16"/></>
                    : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
                  }
                </svg>
              </button>
            </div>

            <div className="map-wrapper">
              <IncidentMap
                incidents={visibleIncidents}
                loading={loading}
                onMarkerClick={setSelectedIncident}
              />
              <ZoneLegend zones={zones} />
            </div>
          </section>
        )}

        {/* ═══ OVERLAY – solo mobile, cierra el drawer al tocar fuera ═══ */}
        <div
          className={`drawer-overlay${drawerOpen ? ' visible' : ''}`}
          onClick={() => setDrawerOpen(false)}
        />

        {/* ═══ PANEL LATERAL / BOTTOM SHEET DRAWER ═══ */}
        <aside
          className={[
            'lateral-panel',
            listCollapsed ? 'collapsed' : '',
            drawerOpen   ? 'drawer-open' : '',
          ].filter(Boolean).join(' ')}
        >

          {/* ── Tarjeta de usuario ── */}
          {/* En mobile: tappable en toda la franja para abrir/cerrar el drawer */}
          <div
            className="panel-user-card"
            onClick={() => setDrawerOpen(v => !v)}
            style={{ cursor: 'pointer' }}
          >
            <div className="panel-user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="panel-user-info">
              <span className="panel-user-role">
                {isGuard ? 'Guardia de seguridad' : 'Estudiante'}
              </span>
              <strong className="panel-user-name">{userName}</strong>
              <span className="panel-user-email">{userEmail}</span>
              {isGuard && (
                <span className="panel-user-zone">
                  Zona: {user?.zona_id || 'Sin asignar'}
                </span>
              )}
            </div>
            {/* stopPropagation: campana y botón Salir no abren/cierran el drawer */}
            <div
              className="panel-user-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <NotificationBell />
              <button onClick={handleLogout} className="panel-logout-btn">
                Salir
              </button>
            </div>
          </div>

          {/* ── Cabecera: colapsar + buscador ── */}
          <div className="panel-header">
            <div className="panel-top-row">
              <button
                className="panel-collapse-btn"
                onClick={() => setListCollapsed(v => !v)}
                title={listCollapsed ? 'Expandir panel' : 'Colapsar panel'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {listCollapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
                </svg>
              </button>
              <div className="panel-search">
                <SearchBar onSearch={handleSearch} />
              </div>
            </div>

            <div className="panel-alerts-info">
              <h2>Alertas activas</h2>
              <p>{activeIncidents.length} incidente(s)</p>
              {activeIncidents.length > 0 && (
                <span className="alert-badge">{activeIncidents.length}</span>
              )}
            </div>
          </div>

          <span className="collapsed-label">{activeIncidents.length} alertas</span>

          <div className="incident-list-scroll">
            <IncidentList
              incidents={activeIncidents}
              loading={loading}
              onSelect={setSelectedIncident}
              onStatusUpdate={handleIncidentStatusUpdate}
            />
          </div>
        </aside>

        {selectedIncident && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-9999 flex items-center justify-center p-4">
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
                    {selectedIncident.zona?.nombre || 'No especificada'}
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

                {/* ── Zona del incidente ── */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-uta-red"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Zona del campus
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {selectedIncident.zona_id
                      ? zones.find(z => z.id === selectedIncident.zona_id)?.nombre
                        ?? `Zona #${selectedIncident.zona_id}`
                      : 'Zona no identificada'}
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