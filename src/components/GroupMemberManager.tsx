import { useState, type FormEvent, type ChangeEvent } from 'react'
import { addMemberByEmail } from '../services/trustGroupService'
import { getCurrentUser } from '../services/authService'
import type { TrustGroup } from '../types/trustGroup'

interface GroupMemberManagerProps {
  group: TrustGroup
  onMemberAdded?: () => void
}

interface FormData {
  correo: string
}

interface FormErrors {
  correo?: string
}

export default function GroupMemberManager({ group, onMemberAdded }: GroupMemberManagerProps) {
  const [formData, setFormData] = useState<FormData>({ correo: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.correo.trim()) {
      newErrors.correo = 'El correo es obligatorio'
    } else if (!formData.correo.includes('@')) {
      newErrors.correo = 'Ingresa un correo válido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name as keyof FormErrors]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const currentUser = getCurrentUser()
    const currentUserId = currentUser?.id ? Number(currentUser.id) : null

    if (!currentUserId) {
      setMessageType('error')
      setMessage('No se pudo identificar al usuario actual.')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    const result = await addMemberByEmail(
      Number(group.id),
      formData.correo.trim(),
      currentUserId
    )

    setIsSubmitting(false)

    if (result.success) {
      setMessageType('success')
      setMessage('Solicitud enviada correctamente')
      setFormData({ correo: '' })
      onMemberAdded?.()
      setTimeout(() => setMessage(''), 2000)
    } else {
      setMessageType('error')
      setMessage(result.message)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
      <h3 className="text-lg font-bold text-uta-navy mb-4">Agregar Miembro</h3>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="correo" className="block text-sm font-semibold text-uta-navy mb-2">
            Correo Institucional <span className="text-uta-red">*</span>
          </label>

          <input
            id="correo"
            name="correo"
            type="email"
            value={formData.correo}
            onChange={handleChange}
            placeholder="Ej: usuario@uta.edu.ec"
            className={`w-full px-3 py-2 border-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-uta-gold focus:border-uta-gold ${errors.correo ? 'border-uta-red' : 'border-gray-200'}`}
          />

          {errors.correo && <p className="text-uta-red text-xs mt-1">{errors.correo}</p>}
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              messageType === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-uta-red/10 text-uta-red'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Enviando solicitud...' : 'Enviar Solicitud'}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-4">
        💡 Nota: El usuario recibirá una invitación y solo entrará al grupo si la acepta.
      </p>
    </div>
  )
}