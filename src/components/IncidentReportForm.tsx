import { useState, type FormEvent, type ChangeEvent } from 'react'

type IncidentType = '' | 'robo' | 'agresion' | 'vandalismo' | 'sospechoso' | 'accidente' | 'otro'

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

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'robo', label: 'Robo / Hurto' },
  { value: 'agresion', label: 'Agresión Física' },
  { value: 'vandalismo', label: 'Vandalismo' },
  { value: 'sospechoso', label: 'Persona Sospechosa' },
  { value: 'accidente', label: 'Accidente' },
  { value: 'otro', label: 'Otro' },
]

export default function IncidentReportForm() {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    tipo: '',
    ubicacion: '',
    descripcion: '',
    foto: null,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!formData.tipo) newErrors.tipo = 'Seleccione un tipo de incidente'
    if (!formData.ubicacion.trim()) newErrors.ubicacion = 'Ingrese la ubicación exacta'
    if (!formData.descripcion.trim()) newErrors.descripcion = 'Ingrese una descripción'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData(prev => ({ ...prev, foto: file }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('=== INCIDENT REPORT SUBMITTED ===')
    console.log('Tipo:', formData.tipo)
    console.log('Ubicación:', formData.ubicacion)
    console.log('Descripción:', formData.descripcion)
    console.log('Foto:', formData.foto ? formData.foto.name : 'Sin foto adjunta')
    console.log('=================================')

    setIsSubmitting(false)
    setSubmitted(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setFormData({ tipo: '', ubicacion: '', descripcion: '', foto: null })
    setErrors({})
    setSubmitted(false)
  }

  const handleNewReport = () => {
    setFormData({ tipo: '', ubicacion: '', descripcion: '', foto: null })
    setErrors({})
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-uta-navy mb-2">¡Reporte Enviado!</h2>
          <p className="text-gray-600 mb-6 text-sm">
            Tu reporte de emergencia ha sido recibido. El equipo de seguridad ha sido notificado.
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
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-uta-navy mb-2">¿Presencias algo inusual?</h2>
          <p className="text-gray-600 text-sm">Presiona el botón para reportar inmediatamente</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-48 h-48 rounded-full bg-uta-red hover:bg-uta-red-dark text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-2"
          aria-label="Reportar Emergencia"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span className="leading-tight">¡REPORTAR<br/>EMERGENCIA!</span>
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-uta-red px-4 py-4">
          <h2 className="text-white text-lg font-bold text-center">Reportar Incidente</h2>
        </div>

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

          <div>
            <label htmlFor="ubicacion" className="block text-sm font-semibold text-uta-navy mb-1.5">
              Ubicación Exacta <span className="text-uta-red">*</span>
            </label>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <input
                type="text"
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                placeholder="Ej: Edificio A, Piso 2, Aula 204"
                className={`w-full pl-10 pr-3 py-2.5 border-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${errors.ubicacion ? 'border-uta-red' : 'border-gray-200'}`}
              />
            </div>
            {errors.ubicacion && <p className="text-uta-red text-xs mt-1">{errors.ubicacion}</p>}
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <span className="text-sm text-gray-700 font-medium">{formData.foto.name}</span>
                  <span className="text-xs text-gray-400 mt-0.5">Click para cambiar</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-sm text-gray-500">Tap para subir foto</span>
                  <span className="text-xs text-gray-400 mt-0.5">PNG, JPG hasta 5MB</span>
                </>
              )}
              <input
                type="file"
                id="foto"
                name="foto"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
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
              className="flex-1 py-3 px-4 bg-uta-red hover:bg-uta-red-dark text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Enviando...
                </>
              ) : (
                'ENVIAR REPORTE'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
