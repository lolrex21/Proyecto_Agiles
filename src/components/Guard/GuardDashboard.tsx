import { useState, useEffect, useMemo, useCallback } from 'react'
import SearchBar from '../SearchBar'
import IncidentMap from '../Map/IncidentMap'
import IncidentList from '../IncidentList'
import Toast from '../Toast'
import AssignedGuardsList from './AssignedGuardsList'
import ConfirmAttendanceButton from './ConfirmAttendanceButton'
import NotificationBell from '../NotificationBell'
import { useIncidents } from '../../hooks/useIncidents'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'
import { useAudioAlert } from '../../hooks/useAudioAlert'
import { useIncidentGuards } from '../../hooks/useIncidentGuards'
import { emergencySocket } from '../../services/emergencySocket'
import { supabase } from '../../services/supabaseClient'
import { getCurrentUser, logout } from '../../services/authService'
import './GuardDashboard.css'
import { usePolygons } from '../../hooks/usePolygons'
import ZoneLegend from '../Map/ZoneLegend'
import AdminUsersPanel from '../Admin/AdminUsersPanel'
import AdminZonesPanel from '../Admin/AdminZonesPanel'  
import AdminStatsPanel from '../Admin/AdminStatsPanel'
import ZoneEditorMap from '../Admin/ZoneEditorMap'
import AdminZoneMapPanel from '../Admin/AdminZoneMapPanel'

type IncidentStatus = 'Pendiente' | 'Atendido' | 'Cerrado'

type IncidentFilters = {
  text: string
  dateFrom: string
  dateTo: string
  timeFrom: string
  timeTo: string
  zone: string
  estado: string
  tipo: string
}

type GuardDashboardProps = {
  role?: string
}

export default function GuardDashboard({ role }: GuardDashboardProps) {
  const {
    incidents,
    loading,
    selectedIncident,
    setSelectedIncident,
  } = useIncidents()

  const user = getCurrentUser()
  const guardId = user?.id ? String(user.id) : ''
  const userName = user?.nombre || user?.name || 'Usuario'
  const userEmail = user?.email || user?.correo || 'Correo no disponible'
  const userRole = user?.rol || user?.role || user?.tipo_usuario || 'estudiante'
  const isGuard = userRole === 'guardia' || userRole === 'guard'

  const currentRole =
    role?.toLowerCase() === 'guardia' || role?.toLowerCase() === 'guard'
      ? 'guardia'
      : 'administrador'

  const isGuard = currentRole === 'guardia'
  const isAdmin = !isGuard

  const menuItems = isGuard
    ? ['Dashboard', 'Mis asignaciones', 'Historial']
    : ['Incidentes', 'Usuarios', 'Zonas', 'Historial general', 'Estadísticas']

  const [activeMenu, setActiveMenu] = useState(menuItems[0])
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [focusedMapIncident, setFocusedMapIncident] = useState<any | null>(null)

  const [selectedZone, setSelectedZone] = useState<any | null>(null)
  const [zoneEditorMode, setZoneEditorMode] = useState(false)

  const [isOnDuty, setIsOnDuty] = useState(false)
  const [checkingDuty, setCheckingDuty] = useState(true)
const [showDutyOptions, setShowDutyOptions] = useState(false)
  const [filters, setFilters] = useState<IncidentFilters>({
    text: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '',
    timeTo: '',
    zone: '',
    estado: '',
    tipo: '',
  })

  const handleLogout = async () => {
    await logout()
    window.location.replace('/')
  }

  const [activeAlerts, setActiveAlerts] = useState<any[]>([])
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null)
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const guardIdNum = user?.id ? Number(user.id) : 0
  const selectedIncidentId = selectedIncident ? Number(selectedIncident.id) : null
  const { guards: assignedGuards, loading: guardsLoading } = useIncidentGuards(selectedIncidentId)

  const { zones } = usePolygons()

  const clearFilters = () => {
    setFilters({
      text: '',
      dateFrom: '',
      dateTo: '',
      timeFrom: '',
      timeTo: '',
      zone: '',
      estado: '',
      tipo: '',
    })
  }

  const loadDutyStatus = useCallback(async () => {
    if (!isGuard) {
      setCheckingDuty(false)
      return
    }

    if (!guardId) {
      setCheckingDuty(false)
      return
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('en_servicio')
      .eq('id', guardId)
      .maybeSingle()

    if (error) {
      console.error('Error cargando estado de servicio:', error)
      setCheckingDuty(false)
      return
    }

    setIsOnDuty(Boolean(data?.en_servicio))
    setCheckingDuty(false)
  }, [guardId, isGuard])

  useEffect(() => {
    loadDutyStatus()
  }, [loadDutyStatus])

  const handleToggleDuty = async () => {
    if (!guardId || !isGuard) return

    const newStatus = !isOnDuty

    const { error } = await supabase
      .from('usuarios')
      .update({ en_servicio: newStatus })
      .eq('id', guardId)

    if (error) {
      console.error('Error actualizando servicio:', error)
      alert('No se pudo cambiar tu estado de servicio.')
      return
    }

    setIsOnDuty(newStatus)

    if (!newStatus) {
      setSelectedIncident(null)
      setFocusedMapIncident(null)
      setConfirmCloseId(null)
      setActiveMenu('Dashboard')
      setViewMode('split')
      setActiveAlerts([])
    }
  }

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
    return visibleIncidents.filter((inc: any) => inc.estado === 'Pendiente')
  }, [visibleIncidents])

  const assignedIncidents = useMemo(() => {
    return visibleIncidents.filter(
      (inc: any) =>
        String(inc.guardia_id) === guardId && inc.estado === 'Atendido'
    )
  }, [visibleIncidents, guardId])

const guardHistoryIncidents = useMemo(() => {
  return visibleIncidents.filter(
    (inc: any) =>
      String(inc.guardia_id) === guardId &&
      inc.estado !== 'Pendiente' &&
      inc.estado !== 'Atendido'
  )
}, [visibleIncidents, guardId])

const menuIncidents = useMemo(() => {
  if (isGuard) {
    // GUARDIA - Dashboard: solo casos activos
    if (activeMenu === 'Dashboard') {
      return visibleIncidents.filter(
        (inc: any) =>
          inc.estado === 'Pendiente' || inc.estado === 'Atendido'
      )
    }

    // GUARDIA - Mis asignaciones: solo casos que tomó este guardia y siguen atendiendo
    if (activeMenu === 'Mis asignaciones') {
      return assignedIncidents
    }

    // GUARDIA - Historial: casos que ya atendió este guardia
    if (activeMenu === 'Historial') {
      return guardHistoryIncidents
    }

    return visibleIncidents.filter(
      (inc: any) =>
        inc.estado === 'Pendiente' || inc.estado === 'Atendido'
    )
  }

  // ADMIN - Incidentes: solo pendientes y atendiendo
  if (activeMenu === 'Incidentes') {
    return visibleIncidents.filter(
      (inc: any) =>
        inc.estado === 'Pendiente' || inc.estado === 'Atendido'
    )
  }

  // ADMIN - Historial general: cerrados, cancelados o finalizados
  if (activeMenu === 'Historial general') {
    return visibleIncidents.filter(
      (inc: any) =>
        inc.estado !== 'Pendiente' && inc.estado !== 'Atendido'
    )
  }

  return visibleIncidents
}, [
  isGuard,
  activeMenu,
  assignedIncidents,
  guardHistoryIncidents,
  visibleIncidents,
])

  const filteredIncidents = useMemo(() => {
    return menuIncidents.filter((incident: any) => {
      const textValue = filters.text.trim().toLowerCase()

      const incidentText = [
        incident.tipo_incidente,
        incident.descripcion,
        incident.usuario?.nombre,
        incident.zona?.nombre,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (textValue && !incidentText.includes(textValue)) return false

      const incidentDateValue = incident.fecha || incident.created_at

      if (
        filters.dateFrom ||
        filters.dateTo ||
        filters.timeFrom ||
        filters.timeTo
      ) {
        if (!incidentDateValue) return false

        const incidentDate = new Date(incidentDateValue)

        if (Number.isNaN(incidentDate.getTime())) return false

        const incidentDateOnly = `${incidentDate.getFullYear()}-${String(
          incidentDate.getMonth() + 1
        ).padStart(2, '0')}-${String(incidentDate.getDate()).padStart(2, '0')}`

        const incidentTimeOnly = `${String(incidentDate.getHours()).padStart(
          2,
          '0'
        )}:${String(incidentDate.getMinutes()).padStart(2, '0')}`

        if (filters.dateFrom && incidentDateOnly < filters.dateFrom) {
          return false
        }

        if (filters.dateTo && incidentDateOnly > filters.dateTo) {
          return false
        }

        if (filters.timeFrom && incidentTimeOnly < filters.timeFrom) {
          return false
        }

        if (filters.timeTo && incidentTimeOnly > filters.timeTo) {
          return false
        }
      }

      if (filters.zone && Number(incident.zona_id) !== Number(filters.zone)) {
        return false
      }

      if (filters.estado && incident.estado !== filters.estado) {
        return false
      }

      if (
        filters.tipo &&
        incident.tipo_incidente?.toLowerCase() !== filters.tipo.toLowerCase()
      ) {
        return false
      }

      return true
    })
  }, [filters, menuIncidents])

  const mapIncidents = filteredIncidents
  const listIncidents = filteredIncidents

  const totalIncidents = visibleIncidents.length

  const attendedCount = visibleIncidents.filter(
    (inc: any) => inc.estado === 'Atendido'
  ).length

  const pendingCount = visibleIncidents.filter(
    (inc: any) => inc.estado === 'Pendiente'
  ).length

  const emergenciesCount = visibleIncidents.filter((inc: any) => {
    const tipo = inc.tipo_incidente?.toLowerCase() || ''

    return (
      inc.estado === 'Pendiente' ||
      tipo.includes('incendio') ||
      tipo.includes('accidente') ||
      tipo.includes('agresion') ||
      tipo.includes('agresión')
    )
  }).length

  const listSectionTitle = isGuard
    ? activeMenu === 'Mis asignaciones'
      ? 'Mis incidentes asignados'
      : activeMenu === 'Historial'
      ? 'Mi historial de incidentes'
      : 'Alertas pendientes'
    : activeMenu === 'Incidentes'
    ? 'Gestión de incidentes'
    : activeMenu === 'Historial general'
    ? 'Historial general'
    : 'Alertas pendientes'

  const listSectionSubtitle = isGuard
    ? activeMenu === 'Mis asignaciones'
      ? `${filteredIncidents.length} incidente(s) asignado(s)`
      : activeMenu === 'Historial'
      ? `${filteredIncidents.length} incidente(s) atendido(s) por este guardia`
      : `${filteredIncidents.length} alerta(s) pendiente(s)`
    : activeMenu === 'Incidentes'
    ? `${filteredIncidents.length} incidente(s) registrados`
    : activeMenu === 'Historial general'
    ? `${filteredIncidents.length} incidente(s) cerrado(s)`
    : `${filteredIncidents.length} alerta(s) pendiente(s)`

  const mapTitle =
    activeMenu === 'Mis asignaciones'
      ? 'Mapa - Mis asignaciones'
      : activeMenu === 'Historial' || activeMenu === 'Historial general'
      ? 'Mapa histórico'
      : activeMenu === 'Incidentes'
      ? 'Mapa de incidentes'
      : 'Mapa de incidentes'

  const mapSubtitle =
    activeMenu === 'Mis asignaciones'
      ? `${assignedIncidents.length} caso(s) asignado(s)`
      : activeMenu === 'Historial'
      ? `${guardHistoryIncidents.length} caso(s) atendido(s) por este guardia`
      : activeMenu === 'Historial general'
      ? `${filteredIncidents.length} caso(s) cerrado(s)`
      : 'Ubicación de las alertas y zonas del campus'

  const isManagementSection =
    isAdmin &&
    (activeMenu === 'Usuarios' ||
      activeMenu === 'Zonas' ||
      activeMenu === 'Estadísticas')

  const showMapSection =
    !isManagementSection && activeMenu !== 'Estadísticas' && viewMode !== 'list'

  const showSummaryCards = showMapSection && viewMode === 'split'

  const showListSection =
    !isManagementSection && activeMenu !== 'Mapa' && viewMode !== 'map'

  const showListActions = isGuard && isOnDuty && activeMenu !== 'Historial'

  const sanitizeIncident = useCallback((incident: any) => {
    const { usuario, user, ...rest } = incident
    return rest
  }, [])

  const upsertLocalIncident = useCallback(
    (incident: any) => {
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
    },
    [sanitizeIncident]
  )

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
    if (!guardId || !isGuard) return

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
  }, [guardId, isGuard, upsertLocalIncident])

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
      if (!isGuard) return false

      if (!isOnDuty) {
        alert('No puedes tomar casos porque estás fuera de servicio.')
        return false
      }

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
        alert(
          `Este incidente ya fue tomado o cerrado. Estado actual: ${incident.estado}`
        )
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
    [
      isGuard,
      isOnDuty,
      guardId,
      getIncidentById,
      setSelectedIncident,
      upsertLocalIncident,
    ]
  )

  const handleCloseIncident = useCallback(
    async (incident: any): Promise<boolean> => {
      if (!isGuard) return false

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

        setActiveMenu('Dashboard')
        setViewMode('split')
        setFocusedMapIncident(null)
        setSelectedIncident(null)
        setConfirmCloseId(null)

        setFilters({
          text: '',
          dateFrom: '',
          dateTo: '',
          timeFrom: '',
          timeTo: '',
          zone: '',
          estado: '',
          tipo: '',
        })

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
    [
      isGuard,
      guardId,
      getIncidentById,
      setSelectedIncident,
      upsertLocalIncident,
    ]
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
      if (isGuard && !isOnDuty) return

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
          body:
            cleanIncident.descripcion ||
            'Se ha reportado una nueva emergencia',
        })
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
    [
      isGuard,
      isOnDuty,
      activeAlerts,
      incidents,
      sanitizeIncident,
      upsertLocalIncident,
      playAlert,
      alertedIncidentIds,
    ]
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
    role: isGuard && isOnDuty ? 'guard' : 'affected',
    userId: guardId,
    onNewIncident: handleNewSocketIncident,
    onIncidentTaken: handleSocketIncidentTaken,
    onIncidentClosed: handleSocketIncidentClosed,
    onGuardBusy: handleGuardBusy,
  })

  const { zones } = usePolygons()

  const handleShowIncidentOnMap = useCallback(
    (incident: any) => {
      setFocusedMapIncident(incident)
      setSelectedIncident(null)
      setViewMode('map')
    },
    [setSelectedIncident]
  )

  const handleEditZoneOnMap = useCallback(
    (zone: any) => {
      setSelectedZone(zone)
      setZoneEditorMode(true)
      setActiveMenu('Zonas')
      setViewMode('map')
      setSelectedIncident(null)
      setFocusedMapIncident(null)
    },
    [setSelectedIncident]
  )

  if (isGuard && checkingDuty) {
    return (
      <div className="guard-dashboard guard-view">
        <Header />

        <main className="dashboard-main">
          <div className="off-duty-panel">
            <h2>Verificando estado de servicio...</h2>
            <p>Un momento, estamos cargando tu disponibilidad.</p>
          </div>
        </main>
      </div>
    )
  }

  if (isGuard && !isOnDuty) {
    return (
      <div className="guard-dashboard guard-view">
        <Header />

        <main className="dashboard-main">
          <div className="off-duty-panel">
            <h2>Estás fuera de servicio</h2>
            <p>
              No recibirás alertas ni podrás tomar emergencias mientras estés en
              descanso, vacaciones o fuera de turno.
            </p>

            <button type="button" onClick={handleToggleDuty}>
              Entrar en servicio
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={`guard-dashboard ${isGuard ? 'guard-view' : 'admin-view'}`}>
      <Header />

      <main
        className={`dashboard-main${listCollapsed ? ' panel-collapsed' : ''}${
          viewMode === 'map' ? ' view-map' : ''
        }${viewMode === 'list' ? ' view-list' : ''}`}
      >
        {viewMode !== 'list' && (
          <section
            className={`map-section${mapFullscreen ? ' map-fullscreen' : ''}`}
          >
            <div className="map-brand-overlay">
              <div className="map-brand-icon">🛡️</div>
              <div className="map-brand-text">
                <span className="map-brand-title">UTA CampusSeguro</span>
                <span className="map-brand-sub">
                  Sistema de alertas universitarias
                </span>
              </div>
            </div>

            <div className="map-floating-controls">
              {viewMode === 'split' && (
                <button
                  className={`map-floating-btn${
                    listCollapsed ? ' active' : ''
                  }`}
                  onClick={() => setListCollapsed((v) => !v)}
                  title={
                    listCollapsed
                      ? 'Mostrar panel lateral'
                      : 'Colapsar panel lateral'
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {listCollapsed ? (
                      <polyline points="15 18 9 12 15 6" />
                    ) : (
                      <polyline points="9 18 15 12 9 6" />
                    )}
                  </svg>
                </button>
              )}

              <button
                className={`map-floating-btn${
                  mapFullscreen ? ' active' : ''
                }`}
                onClick={() => setMapFullscreen((v) => !v)}
                title={
                  mapFullscreen
                    ? 'Salir de pantalla completa'
                    : 'Pantalla completa'
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {mapFullscreen ? (
                    <>
                      <polyline points="8 3 3 3 3 8" />
                      <polyline points="21 8 21 3 16 3" />
                      <polyline points="3 16 3 21 8 21" />
                      <polyline points="16 21 21 21 21 16" />
                    </>
                  ) : (
                    <>
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            <div className="map-wrapper">
              <IncidentMap
                incidents={visibleIncidents}
                loading={loading}
                onMarkerClick={setSelectedIncident}
                isAdmin={user?.rol === 'administrador'}
              />
              <ZoneLegend zones={zones} />
            </div>
          </section>
        )}

        <div
          className={`drawer-overlay${drawerOpen ? ' visible' : ''}`}
          onClick={() => setDrawerOpen(false)}
        />

        <aside
          className={[
            'lateral-panel',
            listCollapsed ? 'collapsed' : '',
            drawerOpen ? 'drawer-open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div
            className="panel-user-card"
            onClick={() => setDrawerOpen((v) => !v)}
            style={{ cursor: 'pointer' }}
          >
            <div className="panel-user-avatar">
              {(userName || 'U').charAt(0).toUpperCase()}
            </div>

            <div className="panel-user-info">
              <span className="panel-user-role">
                {isGuard ? 'Guardia de seguridad' : 'Estudiante'}
              </span>
              <strong className="panel-user-name">
                {userName || 'Usuario'}
              </strong>
              <span className="panel-user-email">
                {userEmail || 'sin correo'}
              </span>

              {isGuard && (
                <span className="panel-user-zone">
                  Zona: {user?.zona_id || 'Sin asignar'}
                </span>
              )}
            </div>

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

          <div className="panel-header">
            <div className="panel-top-row">
              <button
                className="panel-collapse-btn"
                onClick={() => setListCollapsed((v) => !v)}
                title={listCollapsed ? 'Expandir panel' : 'Colapsar panel'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {listCollapsed ? (
                    <polyline points="9 18 15 12 9 6" />
                  ) : (
                    <polyline points="15 18 9 12 15 6" />
                  )}
                </svg>
              </button>

              <div className="panel-search">
                <SearchBar onSearch={handleSearch} />
              </div>
            </div>
          </div>

          {/* Aquí continúa el contenido que ya tengas dentro del panel:
              lista de incidentes, menús, botones, filtros, etc. */}
        </aside>
      </main>
    </div>
  )
              </div>
            </div>

          {isGuard && (
            <div className="duty-card duty-collapsible">
              <button
                type="button"
                className="duty-header-btn"
                onClick={() => setShowDutyOptions((prev) => !prev)}
              >
                <div>
                  <p className="duty-label">Estado de servicio</p>
                  <strong className={isOnDuty ? 'duty-on' : 'duty-off'}>
                    {isOnDuty ? 'En servicio' : 'Fuera de servicio'}
                  </strong>
                </div>

                <span className={`duty-arrow ${showDutyOptions ? 'open' : ''}`}>
                  ▾
                </span>
              </button>

              {showDutyOptions && (
                <div className="duty-options">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleToggleDuty()
                      setShowDutyOptions(false)
                    }}
                    className={isOnDuty ? 'duty-btn off' : 'duty-btn on'}
                  >
                    {isOnDuty ? 'Salir de servicio' : 'Entrar en servicio'}
                  </button>
                </div>
              )}
            </div>
          )}

          <span className="collapsed-label">
            {activeIncidents.length} alertas
          </span>

          <nav className="sidebar-menu">
            {menuItems.map((item) => (
              <button
                key={item}
                type="button"
                className={`sidebar-item ${
                  activeMenu === item ? 'active' : ''
                }`}
                onClick={() => {
                  setActiveMenu(item)
                  setFocusedMapIncident(null)
                  setSelectedIncident(null)
                  setConfirmCloseId(null)

                  if (item !== 'Zonas') {
                    setZoneEditorMode(false)
                    setSelectedZone(null)
                    setViewMode('split')
                  }
                }}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div className="dashboard-body">
          <section className="dashboard-toolbar">
            <div className="mobile-search-toggle">
              <button
                type="button"
                onClick={() => setShowMobileFilters((prev) => !prev)}
                className="mobile-search-btn"
              >
                {showMobileFilters ? 'Ocultar filtros' : 'Buscar filtros'}
              </button>
            </div>

            <div
              className={`dashboard-search ${
                showMobileFilters ? 'filters-open' : 'filters-closed'
              }`}
            >
              <SearchBar
                filters={filters}
                zones={zones}
                onChange={setFilters}
              />
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="clear-filters-btn"
            >
              Limpiar
            </button>

            <div className="view-toggle compact">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`toggle-btn ${
                  viewMode === 'split' ? 'active' : ''
                }`}
                title="Vista dividida"
              >
                Dividida
              </button>

              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`toggle-btn ${
                  viewMode === 'map' ? 'active' : ''
                }`}
                title="Ver solo mapa"
              >
                Mapa
              </button>
            </div>
          </section>

          <section className={`dashboard-content ${viewMode}`}>
            {isAdmin && activeMenu === 'Usuarios' && <AdminUsersPanel />}

            {isAdmin &&
              activeMenu === 'Zonas' &&
              !zoneEditorMode &&
              viewMode === 'split' && (
                <AdminZonesPanel onEditZone={handleEditZoneOnMap} />
              )}

            {isAdmin &&
              activeMenu === 'Zonas' &&
              !zoneEditorMode &&
              viewMode === 'map' && (
                <AdminZoneMapPanel
                  zones={zones}
                  onEditZone={handleEditZoneOnMap}
                />
              )}

            {isAdmin &&
              activeMenu === 'Zonas' &&
              zoneEditorMode &&
              selectedZone && (
                <article className="dashboard-card map-section admin-zone-map-editor">
                  <div className="section-header compact-header">
                    <div>
                      <h2>Editar zona: {selectedZone.nombre}</h2>
                      <p>
                        Modifica la información visual y territorial de esta
                        zona.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="clear-filters-btn"
                      onClick={() => {
                        setZoneEditorMode(false)
                        setSelectedZone(null)
                        setViewMode('split')
                      }}
                    >
                      Volver a zonas
                    </button>
                  </div>

                  <div className="map-wrapper">
                    <ZoneEditorMap
                      zone={selectedZone}
                      zones={zones}
                      onZoneUpdated={(updatedZone) => {
                        setSelectedZone(updatedZone)
                      }}
                      onCancel={() => {
                        setZoneEditorMode(false)
                        setSelectedZone(null)
                        setViewMode('split')
                      }}
                    />
                  </div>
                </article>
              )}

            {isAdmin && activeMenu === 'Estadísticas' && (
              <AdminStatsPanel incidents={filteredIncidents} />
            )}

            {showMapSection && (
              <article className="dashboard-card map-section">
                <div className="section-header compact-header">
                  <div>
                    <h2>{mapTitle}</h2>
                    <p>{mapSubtitle}</p>
                  </div>
                </div>

                <div className="map-wrapper">
                  <IncidentMap
                    incidents={mapIncidents}
                    loading={loading}
                    selectedIncident={focusedMapIncident || selectedIncident}
                    onMarkerClick={(incident) => {
                      setFocusedMapIncident(incident)
                      setSelectedIncident(incident)
                    }}
                    isAdmin={user?.rol === 'administrador'}
                  />

                  <ZoneLegend zones={zones} />
                </div>
              </article>
            )}

            {showListSection && (
              <article className="dashboard-card list-section">
                <div className="section-header compact-header">
                  <div>
                    <h2>{listSectionTitle}</h2>
                    <p>{listSectionSubtitle}</p>
                  </div>
                </div>

                <div className="incident-list-scroll">
                  <IncidentList
                    incidents={listIncidents}
                    loading={loading}
                    onSelect={setSelectedIncident}
                    onMap={handleShowIncidentOnMap}
                    onStatusUpdate={
                      showListActions
                        ? handleIncidentStatusUpdate
                        : undefined
                    }
                    showActions={showListActions}
                    emptyMessage={
                      isGuard && activeMenu === 'Mis asignaciones'
                        ? 'No tienes incidentes asignados aún.'
                        : isGuard && activeMenu === 'Historial'
                        ? 'Todavía no tienes casos cerrados en tu historial.'
                        : isAdmin && activeMenu === 'Historial general'
                        ? 'Todavía no hay incidentes cerrados en el sistema.'
                        : 'No hay incidentes reportados.'
                    }
                  />
                </div>
              </article>
            )}

            {showSummaryCards && (
              <section className="dashboard-cards bottom-cards">
                <article className="summary-card bg-white shadow-sm">
                  <span className="summary-label">
                    {isGuard ? 'Activos' : 'Total incidentes'}
                  </span>
                  <p className="summary-number">
                    {isGuard ? activeIncidents.length : totalIncidents}
                  </p>
                </article>

                <article className="summary-card bg-white shadow-sm">
                  <span className="summary-label">Atendiendo</span>
                  <p className="summary-number">{attendedCount}</p>
                </article>

                <article className="summary-card bg-white shadow-sm">
                  <span className="summary-label">
                    {isGuard ? 'Mis Asignaciones' : 'Pendientes'}
                  </span>
                  <p className="summary-number">
                    {isGuard ? assignedIncidents.length : pendingCount}
                  </p>
                </article>

                {isAdmin && (
                  <article className="summary-card bg-white shadow-sm">
                    <span className="summary-label">Emergencias</span>
                    <p className="summary-number">{emergenciesCount}</p>
                  </article>
                )}
              </section>
            )}
          </section>
        </div>
      </div>

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
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-5">
                <div>
<div>
  <div className="flex items-center gap-2 mb-1">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 text-uta-red"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>

    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
      Ubicación
    </span>
  </div>

  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
    {(selectedIncident as any).ubicacion ||
      selectedIncident.zona?.nombre ||
      'No especificada'}
  </div>
</div>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Descripción
                  </span>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 mt-1">
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 text-uta-red"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>

    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
      Guardia asignado
    </span>
  </div>

  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
    {selectedIncident.guardia_id
      ? `Guardia #${selectedIncident.guardia_id}`
      : 'Sin asignar'}
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
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Estado:
                  </span>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedIncident.estado === 'Cerrado'
                        ? 'bg-gray-100 text-gray-600'
                        : selectedIncident.estado === 'Atendido'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedIncident.estado === 'Atendido'
                      ? 'Atendiendo'
                      : selectedIncident.estado}
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

                {isGuard && selectedIncident.estado === 'Pendiente' && (
                  <button
                    onClick={() => handleTakeIncident(selectedIncident)}
                    className="py-2 px-4 bg-uta-navy hover:bg-uta-navy/90 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Tomar caso
                  </button>
                )}

                {isGuard &&
                  selectedIncident.estado === 'Atendido' &&
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

                {isGuard &&
                  selectedIncident.estado === 'Atendido' &&
                  String(selectedIncident.guardia_id) === guardId &&
                  confirmCloseId !== selectedIncident.id && (
                    <button
                      onClick={() => setConfirmCloseId(selectedIncident.id)}
                      className="py-2 px-4 bg-uta-navy hover:bg-uta-navy/90 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Cerrar caso
                    </button>
                  )}

                {isGuard &&
                  selectedIncident.estado === 'Atendido' &&
                  String(selectedIncident.guardia_id) !== guardId && (
                    <span className="text-xs text-gray-500 italic">
                      Solo el Guardia Principal puede cerrar este caso.
                    </span>
                  )}

                {isGuard &&
                  !!currentIncidentId &&
                  selectedIncident.estado === 'Pendiente' &&
                  currentIncidentId !== String(selectedIncident.id) && (
                    <span className="text-xs text-gray-500 italic">
                      Ya tienes una alerta activa. Cierra ese caso antes de
                      tomar otro.
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