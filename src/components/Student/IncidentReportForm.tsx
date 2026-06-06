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
import { getUserTrustGroups, notifyGroupMembers } from '../../services/trustGroupService'
import { useEmergencySocket } from '../../hooks/useEmergencySocket'

type IncidentType =
  | ''
  | 'robo'
  | 'agresion'
  | 'vandalismo'
  | 'sospechoso'
  | 'accidente'
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

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'robo', label: 'Robo / Hurto' },
  { value: 'agresion', label: 'Agresión Física' },
  { value: 'vandalismo', label: 'Vandalismo' },
  { value: 'sospechoso', label: 'Persona Sospechosa' },
  { value: 'accidente', label: 'Accidente' },
  { value: 'otro', label: 'Otro' },
]

const INITIAL_FORM_DATA: FormData = {
  tipo: '',
  ubicacion: '',
  descripcion: '',
  foto: null,
}

const HOLD_DURATION = 2000
const BUTTON_RADIUS = 96
const CIRCUMFERENCE = 2 * Math.PI * BUTTON_RADIUS

function getCurrentLocation(): Promise<CurrentLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no permite obtener la ubicación.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Debes permitir el acceso a tu ubicación para enviar la emergencia.'))
          return
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error('No se pudo obtener tu ubicación a tiempo. Intenta nuevamente.'))
          return
        }
        reject(new Error('No se pudo obtener tu ubicación actual.'))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

export default function IncidentReportForm() {
  // phase: 'idle' = botón de pánico | 'form' = emergencia ya enviada, detalles opcionales
  const [phase, setPhase] = useState<'idle' | 'form'>('idle')
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null)
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null)

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

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
    setHoldProgress(0)
    setIsHolding(false)
    setPhase('idle')
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    if (user?.id) {
      emergencySocket.connect('affected', String(user.id))
    }
    return () => {
      clearHoldTimer()
    }
  }, [clearHoldTimer])

  // 1) Crear y enviar la emergencia inmediatamente (con ubicación) al guardia
  const sendEmergency = useCallback(async () => {
    setSubmitError('')
    setIsSending(true)

    try {
      const user = getCurrentUser()
      const location = await getCurrentLocation()
      const zone = await getZoneByPoint(location.latitud, location.longitud)

      const { data: newIncident, error } = await supabase
        .from('incidentes')
        .insert([
          {
            usuario_id: user?.id || null,
            zona_id: zone?.id || null,    
            tipo_incidente: 'otro',
            descripcion: 'Emergencia reportada (sin detalles aún)',
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
      emergencySocket.createIncident(newIncident)

      // Notificar a los grupos de confianza
      if (user?.id) {
        const userId = Number(user.id)
        const groups = await getUserTrustGroups(userId)
        for (const group of groups) {
          await notifyGroupMembers(
            Number(group.id),
            Number(newIncident.id),
            userId,
            `🚨 ${user?.nombre || 'Un usuario'} reportó una emergencia en el grupo ${group.nombre}`
          )
        }
      }

      setStatusMessage(
        'Emergencia enviada. El guardia ya fue alertado con tu ubicación. Si quieres, agrega detalles abajo.'
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

  // 2) Enviar detalles opcionales -> actualiza el incidente y avisa al guardia en tiempo real
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

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const progress = Math.min(elapsed / HOLD_DURATION, 1)
    setHoldProgress(progress)
    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  const startHold = useCallback(() => {
    if (isHolding || isSending) return
    setIsHolding(true)
    setHoldProgress(0)
    startTimeRef.current = Date.now()
    animationFrameRef.current = requestAnimationFrame(updateProgress)
    holdTimerRef.current = setTimeout(() => {
      clearHoldTimer()
      setHoldProgress(1)
      setIsHolding(false)
      void sendEmergency()
    }, HOLD_DURATION)
  }, [isHolding, isSending, updateProgress, clearHoldTimer, sendEmergency])

  const cancelHold = useCallback(() => {
    clearHoldTimer()
    setHoldProgress(0)
    setIsHolding(false)
  }, [clearHoldTimer])

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

  useEmergencySocket({
    role: 'affected',
    userId: String(getCurrentUser()?.id ?? ''),
    onIncidentUpdated: handleIncidentUpdated,
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

  // ----- Vista: botón de pánico (idle) -----
  return (
    <div className="max-w-md mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col items-center justify-center px-4 py-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-uta-navy mb-2">
            ¿Presencias algo inusual?
          </h2>
          <p className="text-gray-600 text-sm">
            {isSending
              ? 'Enviando tu emergencia con la ubicación...'
              : 'Mantén presionado el botón 2 segundos para enviar la emergencia'}
          </p>
        </div>

        {submitError && (
          <div className="mb-4 w-full p-2 bg-red-50 border border-uta-red rounded-lg">
            <p className="text-uta-red text-xs font-medium text-center">{submitError}</p>
          </div>
        )}

        <div className="relative flex items-center justify-center w-56 h-56 mx-auto">
          <svg className="absolute w-56 h-56 -rotate-90 pointer-events-none" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={BUTTON_RADIUS} fill="none" stroke="rgba(192, 0, 0, 0.2)" strokeWidth="6" />
            {holdProgress > 0 && (
              <circle
                cx="100"
                cy="100"
                r={BUTTON_RADIUS}
                fill="none"
                stroke="#FFBD00"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - holdProgress)}
              />
            )}
          </svg>

          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={(event) => {
              event.preventDefault()
              startHold()
            }}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            disabled={isSending}
            className={`w-56 h-56 rounded-full bg-red-600 text-white font-bold text-xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:bg-red-700 active:scale-95 transition-all mx-auto text-center p-4 select-none touch-none focus:outline-none disabled:opacity-70 ${
              isHolding ? 'bg-red-700 scale-105' : 'hover:shadow-2xl hover:scale-105'
            }`}
            aria-label="Mantén presionado para enviar emergencia"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span className="leading-tight text-sm px-2 text-center">
              {isSending ? 'ENVIANDO...' : '¡REPORTAR\u00A0EMERGENCIA!'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}