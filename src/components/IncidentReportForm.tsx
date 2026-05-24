import { useState, useRef, useCallback, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { supabase } from '../services/supabaseClient'
import { getCurrentUser } from '../services/authService'


type IncidentType = '' | 'robo' | 'agresion' | 'vandalismo' | 'sospechoso' | 'accidente' | 'otro'

interface FormData {
  tipo: IncidentType
  ubicacion: string
  descripcion: string
  foto: File | null
  latitud?: number
  longitud?: number
}

interface FormErrors {
  tipo?: string
  ubicacion?: string
  descripcion?: string
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

interface IncidentReportFormProps {
  onLogout: () => void
}

export default function IncidentReportForm({ onLogout }: IncidentReportFormProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    tipo: '',
    ubicacion: '',
    descripcion: '',
    foto: null,
  })
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [locationError, setLocationError] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  const HOLD_DURATION = 3000
  const BUTTON_RADIUS = 96
  const CIRCUMFERENCE = 2 * Math.PI * BUTTON_RADIUS

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.tipo) newErrors.tipo = 'Seleccione un tipo de incidente'
    if (!formData.ubicacion.trim()) newErrors.ubicacion = 'Ingrese la ubicación exacta'
    if (!formData.descripcion.trim()) newErrors.descripcion = 'Ingrese una descripción'

    //Agregar validación de coordenadas
  if (!formData.latitud || !formData.longitud) {
    newErrors.ubicacion = 'Debe tener ubicación capturada'
  }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name as keyof FormErrors]: undefined }))
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file && file.size > 5 * 1024 * 1024) {
      setFileError('El archivo es demasiado grande. Máximo 5MB permitidos.')
      e.target.value = ''
      setFormData(prev => ({ ...prev, foto: null }))
    } else {
      setFileError('')
      setFormData(prev => ({ ...prev, foto: file }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setSubmitError('')

  const user = getCurrentUser()

  const { error } = await supabase
    .from('incidentes')
    .insert([
      {
        usuario_id: user?.id || null,
        zona_id: null,
        tipo_incidente: formData.tipo,
        descripcion: `Ubicación: ${formData.ubicacion}\nDescripción: ${formData.descripcion}`,
        estado: 'Pendiente',
        latitud: formData.latitud,      
        longitud: formData.longitud,
      },
    ])

  if (error) {
    setSubmitError('Error al enviar el reporte. Intente nuevamente.')
    setIsSubmitting(false)
    return
  }

    setIsSubmitting(false)

    if (error) {
      console.error('Error al guardar incidente:', error)
      alert('No se pudo enviar el reporte.')
      return
    }

    setSubmitted(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setFormData({ tipo: '', ubicacion: '', descripcion: '', foto: null })
    setErrors({})
    setFileError('')
    setSubmitError('')
    setSubmitted(false)
  }

  const handleNewReport = () => {
    setFormData({ tipo: '', ubicacion: '', descripcion: '', foto: null })
    setErrors({})
    setFileError('')
    setSubmitError('')
    setSubmitted(false)
    setShowForm(true)
  }

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const progress = Math.min(elapsed / HOLD_DURATION, 1)
    setHoldProgress(progress)

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  const startHold = useCallback(() => {
    setIsHolding(true)
    startTimeRef.current = Date.now()
    setHoldProgress(0)
    animationFrameRef.current = requestAnimationFrame(updateProgress)

    holdTimerRef.current = setTimeout(() => {
      clearHoldTimer()
      setHoldProgress(1)
      setIsHolding(false)
      setShowForm(true)
    }, HOLD_DURATION)
  }, [updateProgress, clearHoldTimer])

  const cancelHold = useCallback(() => {
    clearHoldTimer()
    setHoldProgress(0)
    setIsHolding(false)
  }, [clearHoldTimer])

  // Nueva función para obtener ubicación
const getLocation = useCallback(() => {
  setLocationStatus('loading')
  setLocationError('')

  if (!navigator.geolocation) {
    setLocationError('Geolocalización no soportada en tu navegador')
    setLocationStatus('error')
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords
      
      // Guardar latitud y longitud en el formulario
      setFormData(prev => ({
        ...prev,
        latitud: latitude,
        longitud: longitude,
        ubicacion: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` // Mostrar coords
      }))
      
      setLocationStatus('success')
    },
    (error) => {
      let errorMsg = 'Error al obtener ubicación'
      
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = 'Permiso de ubicación denegado. Habilítalo en tu navegador.'
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMsg = 'Ubicación no disponible'
      } else if (error.code === error.TIMEOUT) {
        errorMsg = 'Tiempo de espera agotado'
      }
      
      setLocationError(errorMsg)
      setLocationStatus('error')
    }
  )
}, [])

// Obtener ubicación al cargar el formulario
useEffect(() => {
  if (showForm) {
    getLocation()
  }
}, [showForm, getLocation])

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="text-right mb-4">
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-uta-red underline hover:text-uta-red-dark"
            >
              Volver al Login
            </button>
          </div>
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-uta-navy mb-2">¡Reporte Enviado!</h2>

          <p className="text-gray-600 mb-6 text-sm">
            Tu reporte de emergencia ha sido guardado correctamente. El equipo de seguridad podrá visualizarlo.
          </p>

          <button
            onClick={handleNewReport}
            className="w-full py-3 px-6 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-bold rounded-lg transition-colors duration-200"
          >
            Reportar Otro Incidente
          </button>
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <div className="text-right w-full max-w-md mb-4">
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-uta-red underline hover:text-uta-red-dark"
          >
            Volver al Login
          </button>
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-uta-navy mb-2">¿Presencias algo inusual?</h2>
          <p className="text-gray-600 text-sm">Mantén presionado el botón por 3 segundos para reportar</p>
        </div>
        <div className="relative flex items-center justify-center">
          <svg
            className="absolute w-56 h-56 -rotate-90"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r={BUTTON_RADIUS}
              fill="none"
              stroke="rgba(192, 0, 0, 0.2)"
              strokeWidth="6"
            />
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
              className="transition-none"
            />
          </svg>
          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={(e) => {
              e.preventDefault()
              startHold()
            }}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            className={`relative w-48 h-48 rounded-full bg-uta-red text-white font-bold text-lg shadow-xl flex flex-col items-center justify-center gap-2 select-none touch-none ${
              isHolding
                ? 'bg-uta-red-dark scale-105'
                : 'hover:bg-uta-red-dark hover:shadow-2xl hover:scale-105 active:scale-95'
            } transition-all duration-150`}
            aria-label="Mantén presionado para reportar emergencia"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span className="leading-tight">¡REPORTAR<br/>EMERGENCIA!</span>
            {isHolding && (
              <span className="text-xs font-mono mt-1 opacity-80">
                {Math.round(holdProgress * 100)}%
              </span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-uta-red px-4 py-4">
          <h2 className="text-white text-lg font-bold text-center">Reportar Incidente</h2>
        </div>

        {submitError && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-uta-red rounded-lg">
            <p className="text-uta-red text-sm font-medium">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-5" noValidate>
          <div>
            <label htmlFor="tipo" className="block text-sm font-semibold text-uta-navy mb-1.5">
              Tipo de Incidente <span className="text-uta-red">*</span>
            </label>

            <select
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${errors.tipo ? 'border-uta-red' : 'border-gray-200'}`}
            >
              {INCIDENT_TYPES.map(t => (
                <option key={t.value} value={t.value} disabled={t.value === ''}>
                  {t.label}
                </option>
              ))}
            </select>

            {errors.tipo && <p className="text-uta-red text-xs mt-1">{errors.tipo}</p>}
          </div>

          {/* Campo de ubicación - automático */}
<div className="mb-4">
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    📍 Ubicación
  </label>
  
  <div className="flex gap-2 mb-2">
    <input
      type="text"
      name="ubicacion"
      value={formData.ubicacion}
      onChange={handleChange}
      placeholder="Tu ubicación se cargará automáticamente..."
      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      readOnly // No editable, es automático
    />
    
    <button
      type="button"
      onClick={getLocation}
      disabled={locationStatus === 'loading'}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
    >
      {locationStatus === 'loading' ? '⏳ Obteniendo...' : '📍 Actualizar'}
    </button>
  </div>

  {/* Estado de la ubicación */}
  {locationStatus === 'success' && (
    <p className="text-sm text-green-600">
      ✓ Ubicación capturada: {formData.latitud?.toFixed(4)}, {formData.longitud?.toFixed(4)}
    </p>
  )}

  {locationStatus === 'error' && (
    <p className="text-sm text-red-600">{locationError}</p>
  )}

  {errors.ubicacion && (
    <p className="text-red-500 text-sm mt-1">{errors.ubicacion}</p>
  )}
</div>

          <div>
            <label htmlFor="descripcion" className="block text-sm font-semibold text-uta-navy mb-1.5">
              Descripción <span className="text-uta-red">*</span>
            </label>

            <textarea
              id="descripcion"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={4}
              placeholder="Describe lo que está sucediendo..."
              className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${errors.descripcion ? 'border-uta-red' : 'border-gray-200'}`}
            />

            {errors.descripcion && <p className="text-uta-red text-xs mt-1">{errors.descripcion}</p>}
          </div>

          <div>
            <label htmlFor="foto" className="block text-sm font-semibold text-uta-navy mb-1.5">
              Adjuntar Foto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>

            <label
              htmlFor="foto"
              className="flex flex-col items-center justify-center w-full py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-uta-gold hover:bg-uta-gray/50 transition-colors"
            >
              {formData.foto ? (
                <>
                  <span className="text-sm text-gray-700 font-medium">{formData.foto.name}</span>
                  <span className="text-xs text-gray-400 mt-0.5">Click para cambiar</span>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-500">Tap para subir foto</span>
                  <span className="text-xs text-gray-400 mt-0.5">PNG, JPG hasta 5MB</span>
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
            {fileError && <p className="text-uta-red text-xs mt-1">{fileError}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              CANCELAR
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-uta-red hover:bg-uta-red-dark text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-70"
            >
              {isSubmitting ? 'Enviando...' : 'ENVIAR REPORTE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}