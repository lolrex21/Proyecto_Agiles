import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import Toast from '../Toast'
import { getZoneByPoint } from '../../services/polygonService'
import { supabase } from '../../services/supabaseClient'
import { getCurrentUser } from '../../services/authService'
import { emergencySocket } from '../../services/emergencySocket'
import {
  getUserTrustGroups,
  getGroupMembers,
  notifyGroupMembers,
} from '../../services/trustGroupService'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'
import { useAudioAlert } from '../../hooks/useAudioAlert'

// Tipo que se reporta desde los botones rápidos (A-15)
type QuickType = 'robo' | 'pelea' | 'accidente' | 'otro'

type IncidentType =
  | ''
  | 'robo'
  | 'pelea'
  | 'accidente'
  | 'vandalismo'
  | 'sospechoso'
  | 'otro'

interface FormData {
  tipo: IncidentType
  ubicacion: string
  descripcion: string
  foto: File | null
}

interface CurrentLocation {
  latitud: number
  longitud: number
}

// Opciones del selector (solo se usa cuando el tipo NO está bloqueado, es decir "Otro")
const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'robo', label: 'Robo / Hurto' },
  { value: 'pelea', label: 'Pelea / Agresión' },
  { value: 'accidente', label: 'Accidente' },
  { value: 'vandalismo', label: 'Vandalismo' },
  { value: 'sospechoso', label: 'Persona Sospechosa' },
  { value: 'otro', label: 'Otro' },
]

const TYPE_LABEL: Record<QuickType, string> = {
  robo: 'Robo',
  pelea: 'Pelea',
  accidente: 'Accidente',
  otro: 'Otro',
}

// Descripción automática inicial por tipo (el usuario completa el resto en el formulario)
const AUTO_DESCRIPTION: Record<QuickType, string> = {
  robo: 'Reporte rápido: Robo / hurto.',
  pelea: 'Reporte rápido: Pelea / agresión física.',
  accidente: 'Reporte rápido: Accidente.',
  otro: 'Emergencia reportada (sin detalles aún)',
}

const INITIAL_FORM_DATA: FormData = {
  tipo: '',
  ubicacion: '',
  descripcion: '',
  foto: null,
}

const HOLD_DURATION = 2000

// ─── Geolocalización optimizada para velocidad (emergencias) ──
// Envoltorio en promesa
function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

// Códigos: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
const isPermissionDenied = (err: any) => err && err.code === 1

// Pre-calienta la ubicación al abrir la pantalla, para que al presionar
// el botón el sistema ya tenga una lectura en caché (respuesta casi instantánea).
function prewarmLocation() {
  if (!navigator.geolocation) return
  console.log('[GEO] 0) Pre-calentando ubicación...')
  navigator.geolocation.getCurrentPosition(
    (pos) =>
      console.log('[GEO] 0) Pre-calentado OK', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    (err) => console.log('[GEO] 0) Pre-calentado falló (no bloquea):', err?.code, err?.message),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
  )
}

async function getCurrentLocation(): Promise<CurrentLocation> {
  console.log('[GEO] 1) Iniciando obtención de ubicación...')

  if (!navigator.geolocation) {
    console.error('[GEO] navigator.geolocation NO está disponible en este navegador/contexto')
    throw new Error('Tu navegador no permite obtener la ubicación.')
  }

  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => console.log('[GEO] 2) Estado del permiso:', status.state))
      .catch(() => {})
  }

  const startedAt = Date.now()

  // 1) Intento RÁPIDO: baja precisión (red/wifi) + acepta caché de hasta 2 min.
  //    Suele responder en 1-3 s (o al instante si hay caché del pre-calentado).
  try {
    console.log('[GEO] 3a) Intento rápido (baja precisión, timeout 7s, cache 2min)...')
    const pos = await getPosition({
      enableHighAccuracy: false,
      timeout: 7000,
      maximumAge: 120000,
    })
    console.log(`[GEO] ✅ 4a) Rápido OK en ${Date.now() - startedAt} ms`, {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    })
    return { latitud: pos.coords.latitude, longitud: pos.coords.longitude }
  } catch (fastErr: any) {
    console.warn(`[GEO] ⚠️ 4a) Intento rápido falló -> code=${fastErr?.code} message="${fastErr?.message}"`)
    if (isPermissionDenied(fastErr)) {
      throw new Error('Debes permitir el acceso a tu ubicación para enviar la emergencia.')
    }
  }

  // 2) Fallback: alta precisión (GPS), con un poco más de tiempo.
  try {
    console.log('[GEO] 3b) Fallback (alta precisión, timeout 15s)...')
    const pos = await getPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    })
    console.log(`[GEO] ✅ 4b) Fallback OK en ${Date.now() - startedAt} ms`, {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    })
    return { latitud: pos.coords.latitude, longitud: pos.coords.longitude }
  } catch (slowErr: any) {
    console.error(`[GEO] ❌ 4b) Fallback falló -> code=${slowErr?.code} message="${slowErr?.message}"`)
    if (isPermissionDenied(slowErr)) {
      throw new Error('Debes permitir el acceso a tu ubicación para enviar la emergencia.')
    }
    if (slowErr?.code === 3) {
      throw new Error('No se pudo obtener tu ubicación a tiempo. Intenta nuevamente.')
    }
    throw new Error('No se pudo obtener tu ubicación actual.')
  }
}

export default function IncidentReportForm() {
  // phase: 'idle' = botones rápidos | 'form' = emergencia ya enviada, completar detalles
  const [phase, setPhase] = useState<'idle' | 'form'>('idle')
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null)
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null)

  // Cuando el tipo ya viene definido por el botón (Robo/Accidente/Pelea) se oculta el selector.
  const [lockTipo, setLockTipo] = useState(false)

  // Mantener presionado 2 s
  const [holdingType, setHoldingType] = useState<QuickType | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

  const { playAlert: playTrustedAlert } = useAudioAlert()

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const resetAll = useCallback(() => {
    setFormData(INITIAL_FORM_DATA)
    setFileError('')
    setSubmitError('')
    setStatusMessage('')
    setActiveIncidentId(null)
    setLockTipo(false)
    setHoldingType(null)
    setHoldProgress(0)
    setPhase('idle')
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    if (user?.id) {
      emergencySocket.connect('affected', String(user.id))
    }
    // Pre-calentamos la ubicación para que el envío sea casi inmediato
    prewarmLocation()
    return () => {
      clearHoldTimer()
    }
  }, [clearHoldTimer])

  // 1) Crear y enviar la emergencia con el tipo seleccionado, luego abrir el formulario
  const sendEmergency = useCallback(async (tipoSeleccionado: QuickType) => {
    console.log('[SEND] Enviando emergencia, tipo =', tipoSeleccionado)
    setSubmitError('')
    setIsSending(true)

    try {
      const user = getCurrentUser()
      console.log('[SEND] Usuario:', user?.id, user?.nombre)
      const location = await getCurrentLocation()
      console.log('[SEND] Ubicación lista, buscando zona...', location)

      // La zona es opcional: si falla, no bloquea el envío
      let zonaId: number | null = null
      try {
        const zone = await getZoneByPoint(location.latitud, location.longitud)
        zonaId = zone?.id ?? null
        console.log('[SEND] Zona detectada:', zonaId)
      } catch (e) {
        console.warn('[SEND] No se pudo detectar zona (continuamos sin zona):', e)
        zonaId = null
      }

      const { data: newIncident, error } = await supabase
        .from('incidentes')
        .insert([
          {
            usuario_id: user?.id || null,
            zona_id: zonaId,
            tipo_incidente: tipoSeleccionado,
            descripcion: AUTO_DESCRIPTION[tipoSeleccionado],
            estado: 'Pendiente',
            latitud: location.latitud,
            longitud: location.longitud,
            guardia_id: null,
          },
        ])
        .select('*')
        .single()

      if (error || !newIncident) {
        setSubmitError('No se pudo enviar la emergencia. Intenta nuevamente.')
        return
      }

      setActiveIncidentId(Number(newIncident.id))
      // Pre-cargamos el tipo. Para Robo/Accidente/Pelea queda bloqueado; para Otro se elige luego.
      setFormData((prev) => ({
        ...prev,
        tipo: tipoSeleccionado === 'otro' ? '' : tipoSeleccionado,
      }))
      setLockTipo(tipoSeleccionado !== 'otro')

      // IDs de miembros de grupos de confianza para la alerta en tiempo real
      const trustedGroupUserIds: string[] = []
      if (user?.id) {
        const userId = Number(user.id)
        const groups = await getUserTrustGroups(userId)
        for (const group of groups) {
          const members = await getGroupMembers(group.id)
          members.forEach((member) => {
            if (String(member.usuario_id) !== String(userId)) {
              trustedGroupUserIds.push(String(member.usuario_id))
            }
          })

          await notifyGroupMembers(
            Number(group.id),
            Number(newIncident.id),
            userId,
            `🚨 ${user?.nombre || 'Un usuario'} reportó ${TYPE_LABEL[tipoSeleccionado]} en el grupo ${group.nombre}`
          )
        }
      }

      // El guardia recibe el incidente con el tipo correcto desde la alerta inicial
      emergencySocket.createIncident(
        {
          ...newIncident,
          tipo_incidente: tipoSeleccionado,
          victimName: user?.nombre || 'Un usuario',
        },
        trustedGroupUserIds
      )

      setStatusMessage(
        `Emergencia de tipo "${TYPE_LABEL[tipoSeleccionado]}" enviada. El guardia ya fue alertado con tu ubicación. Completa la información a continuación.`
      )
      setPhase('form')
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado al enviar la emergencia.'
      )
    } finally {
      setIsSending(false)
    }
  }, [])

  // ── Lógica de "mantener presionado 2 s" (los 4 botones) ──
  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const progress = Math.min(elapsed / HOLD_DURATION, 1)
    setHoldProgress(progress)
    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  const startHold = useCallback(
    (tipo: QuickType) => {
      if (isSending || holdingType) return
      setSubmitError('')
      setHoldingType(tipo)
      setHoldProgress(0)
      startTimeRef.current = Date.now()
      animationFrameRef.current = requestAnimationFrame(updateProgress)
      holdTimerRef.current = setTimeout(() => {
        clearHoldTimer()
        setHoldingType(null)
        setHoldProgress(0)
        // El incidente se envía apenas se completan los 2 segundos
        console.log('[HOLD] 2s completados para tipo =', tipo, '-> enviando')
        void sendEmergency(tipo)
      }, HOLD_DURATION)
    },
    [isSending, holdingType, updateProgress, clearHoldTimer, sendEmergency]
  )

  const cancelHold = useCallback(() => {
    clearHoldTimer()
    setHoldingType(null)
    setHoldProgress(0)
  }, [clearHoldTimer])

  // 2) Enviar detalles -> actualiza el incidente y avisa al guardia (sin alerta duplicada)
  const handleUpdateDetails = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!activeIncidentId) return

      setIsUpdating(true)
      setSubmitError('')

      try {
        const descripcion =
          `Ubicación: ${formData.ubicacion.trim() || 'No especificada'}\n` +
          `Descripción: ${formData.descripcion.trim() || 'Sin detalles'}`

        const { data: updated, error } = await supabase
          .from('incidentes')
          .update({
            tipo_incidente: formData.tipo || 'otro',
            descripcion,
          })
          .eq('id', activeIncidentId)
          .select('*')
          .single()

        if (error || !updated) {
          setSubmitError('No se pudieron guardar los detalles. Intenta nuevamente.')
          return
        }

        emergencySocket.createIncident(updated) // el guardia actualiza la tarjeta al momento
        setToast({ message: 'Detalles enviados al guardia', type: 'success' })
        setTimeout(() => setToast(null), 4000)
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : 'Ocurrió un error al guardar los detalles.'
        )
      } finally {
        setIsUpdating(false)
      }
    },
    [activeIncidentId, formData]
  )

  // 3) Cancelar el incidente -> se refleja al guardia en tiempo real
  const handleCancelIncident = useCallback(async () => {
    if (!activeIncidentId) return

    setIsUpdating(true)
    setSubmitError('')

    try {
      const { data: cancelled, error } = await supabase
        .from('incidentes')
        .update({ estado: 'Cancelado' })
        .eq('id', activeIncidentId)
        .select('*')
        .single()

      if (error || !cancelled) {
        setSubmitError('No se pudo cancelar el incidente. Intenta nuevamente.')
        return
      }

      emergencySocket.createIncident(cancelled) // el guardia lo quita de las alertas activas
      setToast({ message: 'Incidente cancelado', type: 'info' })
      setTimeout(() => setToast(null), 3000)
      resetAll()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Ocurrió un error al cancelar el incidente.'
      )
    } finally {
      setIsUpdating(false)
    }
  }, [activeIncidentId, resetAll])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (file && file.size > 5 * 1024 * 1024) {
      setFileError('El archivo es demasiado grande. Máximo 5MB permitidos.')
      event.target.value = ''
      setFormData((prev) => ({ ...prev, foto: null }))
      return
    }
    setFileError('')
    setFormData((prev) => ({ ...prev, foto: file }))
  }

  // Aviso del guardia hacia el estudiante (en camino / caso cerrado)
  const handleIncidentUpdated = useCallback(
    (payload: any) => {
      if (String(payload.incidentId) === String(activeIncidentId)) {
        const message =
          payload.status === 'Atendido' ? 'Un guardia va en camino' : 'Caso cerrado'
        setToast({ message, type: payload.status === 'Cerrado' ? 'success' : 'info' })
        if (payload.status === 'Cerrado') {
          resetAll()
        }
        setTimeout(() => setToast(null), 4000)
      }
    },
    [activeIncidentId, resetAll]
  )

  const handleTrustedGroupAlert = useCallback(
    (payload: any) => {
      const nombre = payload.victimName || 'Un contacto'
      const ubicacion = payload.location

      setToast({
        message: `⚠️ ALERTA DE CONFIANZA: ${nombre} ha reportado un incidente en la ubicación: ${ubicacion || 'Ubicación no especificada'}`,
        type: 'info',
      })
      playTrustedAlert()
      setTimeout(() => setToast(null), 6000)
    },
    [playTrustedAlert]
  )

  useEmergencySocket({
    role: 'affected',
    userId: String(getCurrentUser()?.id ?? ''),
    onIncidentUpdated: handleIncidentUpdated,
    onTrustedGroupAlert: handleTrustedGroupAlert,
  })

  // ----- Vista: formulario de detalles (emergencia ya enviada) -----
  if (phase === 'form') {
    return (
      <div className="max-w-md mx-auto">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-green-600 px-4 py-3">
            <h2 className="text-white text-base font-bold text-center">
              Emergencia enviada ✅
            </h2>
          </div>

          {statusMessage && (
            <div className="mx-4 mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-xs font-medium">{statusMessage}</p>
            </div>
          )}

          {submitError && (
            <div className="mx-4 mt-3 p-2 bg-red-50 border border-uta-red rounded-lg">
              <p className="text-uta-red text-xs font-medium">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleUpdateDetails} className="p-4 space-y-4" noValidate>
            <p className="text-sm font-bold text-uta-navy">
              Detalles del incidente <span className="text-gray-400 font-normal">(opcional)</span>
            </p>

            {/* Tipo: si viene de Robo/Accidente/Pelea queda fijo; en "Otro" se elige */}
            {lockTipo ? (
              <div>
                <span className="block text-sm font-semibold text-uta-navy mb-1">
                  Tipo de incidente
                </span>
                <div className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-semibold">
                  {TYPE_LABEL[(formData.tipo || 'otro') as QuickType] ?? formData.tipo}
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="tipo" className="block text-sm font-semibold text-uta-navy mb-1">
                  Tipo de incidente
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold"
                >
                  {INCIDENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value} disabled={type.value === ''}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="ubicacion" className="block text-sm font-semibold text-uta-navy mb-1">
                Ubicación exacta
              </label>
              <input
                type="text"
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                placeholder="Ej: Edificio A, Piso 2, Aula 204"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold"
              />
            </div>

            <div>
              <label htmlFor="descripcion" className="block text-sm font-semibold text-uta-navy mb-1">
                Descripción
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                rows={3}
                placeholder="Describe lo que está sucediendo..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold"
              />
            </div>

            <div>
              <label htmlFor="foto" className="block text-sm font-semibold text-uta-navy mb-1">
                Adjuntar foto <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <label
                htmlFor="foto"
                className="flex flex-col items-center justify-center w-full py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-uta-gold hover:bg-uta-gray/50 transition-colors"
              >
                {formData.foto ? (
                  <span className="text-xs text-gray-700 font-medium truncate px-2">
                    {formData.foto.name}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">Tap para subir foto</span>
                )}
                <input
                  type="file"
                  id="foto"
                  name="foto"
                  accept="image/png, image/jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {fileError && <p className="text-uta-red text-xs mt-1">{fileError}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelIncident}
                disabled={isUpdating}
                className="flex-1 py-2.5 px-3 border-2 border-uta-red text-uta-red font-bold text-xs rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Procesando...' : 'CANCELAR INCIDENTE'}
              </button>

              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 py-2.5 px-3 bg-uta-navy hover:bg-uta-navy/90 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-70"
              >
                {isUpdating ? 'Enviando...' : 'ENVIAR DETALLES'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Handlers comunes para un botón "mantener presionado".
  // No usamos e.preventDefault() en onTouchStart porque React registra
  // los listeners táctiles como "passive" y lanzaría un warning.
  // El comportamiento por defecto se evita con la clase CSS `touch-none`.
  const holdHandlers = (tipo: QuickType) => ({
    onMouseDown: () => startHold(tipo),
    onMouseUp: cancelHold,
    onMouseLeave: cancelHold,
    onTouchStart: () => startHold(tipo),
    onTouchEnd: cancelHold,
    onTouchCancel: cancelHold,
  })

  // Barra de progreso inferior mientras se mantiene presionado
  const HoldProgress = ({ tipo }: { tipo: QuickType }) =>
    holdingType === tipo ? (
      <span
        className="absolute bottom-0 left-0 h-1.5 bg-white/80 rounded-full pointer-events-none transition-[width] duration-75"
        style={{ width: `${Math.round(holdProgress * 100)}%` }}
      />
    ) : null

    // ----- Vista: botones rápidos de emergencia (idle) -----
  return (
    <div className="w-full max-w-md mx-auto h-full overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="h-full overflow-hidden flex flex-col">
        <div className="h-[9%] flex flex-col items-center justify-center text-center px-2">
          <h2 className="text-[clamp(1rem,4vw,1.3rem)] font-bold text-uta-navy leading-tight">
            ¿Presencias una emergencia?
          </h2>

          <p className="text-gray-600 text-[clamp(0.7rem,2.8vw,0.85rem)] leading-tight">
            {isSending
              ? 'Enviando tu emergencia con la ubicación...'
              : 'Mantén presionado 2 segundos el tipo de emergencia'}
          </p>
        </div>

        {submitError && (
          <div className="h-[7%] px-1 flex items-center">
            <div className="w-full p-2 bg-red-50 border border-uta-red rounded-lg">
              <p className="text-uta-red text-xs font-medium text-center leading-snug">
                {submitError}
              </p>
            </div>
          </div>
        )}

        <div className={`${submitError ? 'h-[82%]' : 'h-[89%]'} overflow-hidden flex flex-col gap-[1.5%]`}>
          {/* ROBO — botón principal */}
          <button
            type="button"
            {...holdHandlers('robo')}
            disabled={isSending}
            className="relative overflow-hidden w-full h-[51%] rounded-3xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold shadow-lg flex flex-col items-center justify-center gap-[4%] select-none touch-none transition-all disabled:opacity-60"
            aria-label="Mantén presionado para reportar Robo"
          >
            <span className="text-[clamp(4.2rem,19vw,7rem)] leading-none">🦹</span>
            <span className="text-[clamp(1.9rem,7vw,2.8rem)] leading-none">Robo</span>
            <HoldProgress tipo="robo" />
          </button>

          {/* ACCIDENTE + PELEA */}
          <div className="grid grid-cols-2 gap-[2.5%] h-[30%]">
            <button
              type="button"
              {...holdHandlers('accidente')}
              disabled={isSending}
              className="relative overflow-hidden h-full flex flex-col items-center justify-center gap-[6%] rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold shadow-lg select-none touch-none transition-all disabled:opacity-60"
              aria-label="Mantén presionado para reportar Accidente"
            >
              <span className="text-[clamp(2.6rem,11vw,4.4rem)] leading-none">🚑</span>
              <span className="text-[clamp(1.05rem,4.6vw,1.55rem)] leading-none">Accidente</span>
              <HoldProgress tipo="accidente" />
            </button>

            <button
              type="button"
              {...holdHandlers('pelea')}
              disabled={isSending}
              className="relative overflow-hidden h-full flex flex-col items-center justify-center gap-[6%] rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold shadow-lg select-none touch-none transition-all disabled:opacity-60"
              aria-label="Mantén presionado para reportar Pelea"
            >
              <span className="text-[clamp(2.6rem,11vw,4.4rem)] leading-none">🥊</span>
              <span className="text-[clamp(1.05rem,4.6vw,1.55rem)] leading-none">Pelea</span>
              <HoldProgress tipo="pelea" />
            </button>
          </div>

          {/* OTRO */}
          <button
            type="button"
            {...holdHandlers('otro')}
            disabled={isSending}
            className="relative overflow-hidden w-full h-[16%] rounded-2xl bg-gray-600 hover:bg-gray-700 active:scale-[0.98] text-white font-bold shadow-lg flex items-center justify-center gap-[3%] select-none touch-none transition-all disabled:opacity-60"
            aria-label="Mantén presionado para reportar Otro"
          >
            <span className="text-[clamp(2rem,8vw,3.2rem)] leading-none">⚠️</span>
            <span className="text-[clamp(1.1rem,4.8vw,1.6rem)] leading-none">Otro</span>
            <HoldProgress tipo="otro" />
          </button>
        </div>
      </div>
    </div>
  )
}