import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from 'react'
import Header from '../Header'
import Toast from '../Toast'
import { supabase } from '../../services/supabaseClient'
import { getCurrentUser } from '../../services/authService'
import { emergencySocket } from '../../services/emergencySocket'
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

interface FormErrors {
  tipo?: string
  ubicacion?: string
  descripcion?: string
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
          reject(
            new Error(
              'Debes permitir el acceso a tu ubicación para enviar el reporte.'
            )
          )
          return
        }

        if (error.code === error.TIMEOUT) {
          reject(
            new Error(
              'No se pudo obtener tu ubicación a tiempo. Intenta nuevamente.'
            )
          )
          return
        }

        reject(new Error('No se pudo obtener tu ubicación actual.'))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

export default function IncidentReportForm() {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)
  const [errors, setErrors] = useState<FormErrors>({})
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
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

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA)
    setErrors({})
    setFileError('')
    setSubmitError('')
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

  const validate = () => {
    const newErrors: FormErrors = {}

    if (!formData.tipo) {
      newErrors.tipo = 'Seleccione un tipo de incidente'
    }

    if (!formData.ubicacion.trim()) {
      newErrors.ubicacion = 'Ingrese la ubicación exacta'
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'Ingrese una descripción'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name as keyof FormErrors]: undefined,
      }))
    }
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!validate()) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const user = getCurrentUser()
      const location = await getCurrentLocation()

      const { data: newIncident, error } = await supabase
        .from('incidentes')
        .insert([
          {
            usuario_id: user?.id || null,
            zona_id: null,
            tipo_incidente: formData.tipo,
            descripcion: `Ubicación: ${formData.ubicacion}\nDescripción: ${formData.descripcion}`,
            estado: 'Pendiente',
            latitud: location.latitud,
            longitud: location.longitud,
            guardia_id: null,
          },
        ])
        .select('*')
        .single()

      if (error || !newIncident) {
        setSubmitError('Error al enviar el reporte. Intente nuevamente.')
        return
      }

      emergencySocket.createIncident(newIncident)

      console.log('[STUDENT] newIncident.id:', newIncident.id)
      setActiveIncidentId(newIncident.id)

      resetForm()
      setShowForm(false)
      setSubmitted(true)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado. Intente nuevamente.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    clearHoldTimer()
    resetForm()
    setShowForm(false)
    setSubmitted(false)
    setHoldProgress(0)
    setIsHolding(false)
  }

  const handleNewReport = () => {
    resetForm()
    setSubmitted(false)
    setShowForm(true)
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
    if (isHolding) return

    setIsHolding(true)
    setHoldProgress(0)
    startTimeRef.current = Date.now()

    animationFrameRef.current = requestAnimationFrame(updateProgress)

    holdTimerRef.current = setTimeout(() => {
      clearHoldTimer()
      setHoldProgress(1)
      setIsHolding(false)
      setShowForm(true)
    }, HOLD_DURATION)
  }, [isHolding, updateProgress, clearHoldTimer])

  const cancelHold = useCallback(() => {
    clearHoldTimer()
    setHoldProgress(0)
    setIsHolding(false)
  }, [clearHoldTimer])

  const handleIncidentUpdated = useCallback((payload: any) => {
    console.log('[STUDENT] handleIncidentUpdated called', payload)
    console.log('[STUDENT] Active ID:', activeIncidentId, 'Payload ID:', payload.incidentId)

    if (String(payload.incidentId) === String(activeIncidentId)) {
      const message =
        payload.status === 'Atendido'
          ? 'Guardia UTA en camino'
          : 'Caso cerrado'

      setToast({
        message,
        type: payload.status === 'Cerrado' ? 'success' : 'info',
      })

      if (payload.status === 'Cerrado') {
        setActiveIncidentId(null)
        setSubmitted(false)
        setShowForm(false)
      }

      setTimeout(() => setToast(null), 4000)
    }
  }, [activeIncidentId])

  useEmergencySocket({
    role: 'affected',
    userId: String(getCurrentUser()?.id ?? ''),
    onIncidentUpdated: handleIncidentUpdated,
  })

  if (submitted) {
    return (
      <div className="max-w-md mx-auto min-h-screen relative bg-gray-50 flex flex-col shadow-2xl overflow-x-hidden">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <Header />

        <main className="flex flex-col items-center justify-center flex-1 px-4 py-8 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-green-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="text-lg font-bold text-uta-navy mb-2">
              ¡Reporte Enviado!
            </h2>

            <p className="text-gray-600 mb-6 text-sm">
              Tu reporte de emergencia ha sido guardado correctamente. El equipo
              de seguridad podrá visualizarlo.
            </p>

            <button
              onClick={handleNewReport}
              className="w-full py-3 px-4 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-bold text-sm rounded-lg transition-colors duration-200"
            >
              Reportar Otro Incidente
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="max-w-md mx-auto min-h-screen relative bg-gray-50 flex flex-col shadow-2xl overflow-x-hidden">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <Header />

        <main className="flex flex-col items-center justify-center flex-1 px-4 py-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-uta-navy mb-2">
              ¿Presencias algo inusual?
            </h2>

            <p className="text-gray-600 text-sm">
              Mantén presionado el botón por 2 segundos para reportar
            </p>
          </div>

          <div className="relative flex items-center justify-center w-56 h-56 mx-auto">
            <svg className="absolute w-56 h-56 -rotate-90 pointer-events-none" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={BUTTON_RADIUS}
                fill="none"
                stroke="rgba(192, 0, 0, 0.2)"
                strokeWidth="6"
              />

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
              className={`w-56 h-56 rounded-full bg-red-600 text-white font-bold text-xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:bg-red-700 active:scale-95 transition-all mx-auto text-center p-4 select-none touch-none focus:outline-none focus:ring-0 ${
                isHolding ? 'bg-red-700 scale-105' : 'hover:shadow-2xl hover:scale-105'
              }`}
              aria-label="Mantén presionado para reportar emergencia"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>

              <span className="leading-tight text-sm px-2 text-center">
                ¡REPORTAR
                <br />
                EMERGENCIA!
              </span>
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen relative bg-gray-50 flex flex-col shadow-2xl overflow-x-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header />

      <main className="flex-1 px-4 py-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-uta-red px-4 py-3">
            <h2 className="text-white text-base font-bold text-center">
              Reportar Incidente
            </h2>
          </div>

          {submitError && (
            <div className="mx-4 mt-3 p-2 bg-red-50 border border-uta-red rounded-lg">
              <p className="text-uta-red text-xs font-medium">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 space-y-4" noValidate>
            <div>
              <label
                htmlFor="tipo"
                className="block text-sm font-semibold text-uta-navy mb-1"
              >
                Tipo de Incidente <span className="text-uta-red">*</span>
              </label>

              <select
                id="tipo"
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${
                  errors.tipo ? 'border-uta-red' : 'border-gray-200'
                }`}
              >
                {INCIDENT_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                    disabled={type.value === ''}
                  >
                    {type.label}
                  </option>
                ))}
              </select>

              {errors.tipo && (
                <p className="text-uta-red text-xs mt-1">{errors.tipo}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="ubicacion"
                className="block text-sm font-semibold text-uta-navy mb-1"
              >
                Ubicación Exacta <span className="text-uta-red">*</span>
              </label>

              <input
                type="text"
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                placeholder="Ej: Edificio A, Piso 2, Aula 204"
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${
                  errors.ubicacion ? 'border-uta-red' : 'border-gray-200'
                }`}
              />

              {errors.ubicacion && (
                <p className="text-uta-red text-xs mt-1">{errors.ubicacion}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="descripcion"
                className="block text-sm font-semibold text-uta-navy mb-1"
              >
                Descripción <span className="text-uta-red">*</span>
              </label>

              <textarea
                id="descripcion"
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                rows={3}
                placeholder="Describe lo que está sucediendo..."
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${
                  errors.descripcion ? 'border-uta-red' : 'border-gray-200'
                }`}
              />

              {errors.descripcion && (
                <p className="text-uta-red text-xs mt-1">
                  {errors.descripcion}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="foto"
                className="block text-sm font-semibold text-uta-navy mb-1"
              >
                Adjuntar Foto{' '}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>

              <label
                htmlFor="foto"
                className="flex flex-col items-center justify-center w-full py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-uta-gold hover:bg-uta-gray/50 transition-colors"
              >
                {formData.foto ? (
                  <>
                    <span className="text-xs text-gray-700 font-medium truncate px-2">
                      {formData.foto.name}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      Click para cambiar
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-gray-500">
                      Tap para subir foto
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      PNG, JPG hasta 5MB
                    </span>
                  </>
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

              {fileError && (
                <p className="text-uta-red text-xs mt-1">{fileError}</p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-3 border-2 border-gray-300 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                CANCELAR
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-3 bg-uta-red hover:bg-uta-red-dark text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Obteniendo ubicación...' : 'ENVIAR REPORTE'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
