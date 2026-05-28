import { useState, type FormEvent, type ChangeEvent } from 'react'
import { createTrustGroup } from '../services/trustGroupService'
import { getCurrentUser } from '../services/authService'
import type { CreateTrustGroupData } from '../types/trustGroup'

interface TrustGroupFormProps {
  onSuccess?: () => void
}

interface FormData {
  nombre: string
  descripcion: string
}

interface FormErrors {
  nombre?: string
}

export default function TrustGroupForm({ onSuccess }: TrustGroupFormProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    descripcion: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre del grupo es obligatorio'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name as keyof FormErrors]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setMessage('')

    const user = getCurrentUser()
    const userId = user?.id ? Number(user.id) : null

    if (!userId) {
      setIsSubmitting(false)
      setMessageType('error')
      setMessage('No se encontró el usuario autenticado.')
      return
    }

    const data: CreateTrustGroupData = {
      nombre: formData.nombre,
      descripcion: formData.descripcion || undefined,
    }

    const result = await createTrustGroup(userId, data)

    setIsSubmitting(false)

    if (result.success) {
      setMessageType('success')
      setMessage('Grupo creado exitosamente')
      setFormData({ nombre: '', descripcion: '' })
      setTimeout(() => {
        setShowForm(false)
        setMessage('')
        onSuccess?.()
      }, 1500)
    } else {
      setMessageType('error')
      setMessage(result.message)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setFormData({ nombre: '', descripcion: '' })
    setErrors({})
    setMessage('')
  }

  return (
    <div className="mb-6">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 px-4 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-bold rounded-lg transition-colors"
        >
          + Crear Nuevo Grupo
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-uta-navy mb-4">Crear Grupo de Confianza</h3>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="nombre" className="block text-sm font-semibold text-uta-navy mb-2">
                Nombre del Grupo <span className="text-uta-red">*</span>
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ej: Compañeros de clase"
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${errors.nombre ? 'border-uta-red' : 'border-gray-200'}`}
              />
              {errors.nombre && <p className="text-uta-red text-xs mt-1">{errors.nombre}</p>}
            </div>

            <div>
              <label htmlFor="descripcion" className="block text-sm font-semibold text-uta-navy mb-2">
                Descripción (opcional)
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                placeholder="Ej: Grupo para coordinar seguridad de los panas"
                rows={3}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold"
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-uta-red/10 text-uta-red'}`}
              >
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Creando...' : 'Crear Grupo'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
