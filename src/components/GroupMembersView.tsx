import { useEffect, useState } from 'react'
import { getGroupMembers, removeMember } from '../services/trustGroupService'
import { getCurrentUser } from '../services/authService'
import type { TrustGroup, TrustGroupMember } from '../types/trustGroup'

interface GroupMembersViewProps {
  group: TrustGroup
  onMembersChanged?: () => void
}

export default function GroupMembersView({ group, onMembersChanged }: GroupMembersViewProps) {
  const [members, setMembers] = useState<TrustGroupMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const currentUser = getCurrentUser()
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null
  const isGroupAdmin = group.usuario_creador_id === currentUserId

  const loadMembers = async () => {
    setIsLoading(true)
    const groupMembers = await getGroupMembers(Number(group.id))
    setMembers(groupMembers)
    setIsLoading(false)
  }

  useEffect(() => {
    void loadMembers()
  }, [group.id])

  const handleRemoveMember = async (memberId: number, memberEmail?: string) => {
    if (!currentUserId) {
      setMessageType('error')
      setMessage('No se pudo identificar al usuario actual.')
      return
    }

    if (!isGroupAdmin) {
      setMessageType('error')
      setMessage('Solo el administrador del grupo puede eliminar miembros')
      return
    }

    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${memberEmail || 'este usuario'} del grupo?`)) {
      return
    }

    const result = await removeMember(Number(memberId), currentUserId)

    if (result.success) {
      setMessageType('success')
      setMessage('Miembro eliminado exitosamente')
      await loadMembers()
      onMembersChanged?.()
    } else {
      setMessageType('error')
      setMessage(result.message)
    }

    setTimeout(() => setMessage(''), 3000)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Cargando miembros...</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
      <h3 className="text-lg font-bold text-uta-navy mb-4">Integrantes ({members.length})</h3>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-uta-red/10 text-uta-red'
          }`}
        >
          {message}
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 text-sm">No hay miembros en este grupo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-uta-gold transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-uta-navy text-sm break-words">
                  {member.usuario?.nombre || 'Usuario'}
                </p>

                <p className="text-xs text-gray-600 break-words">
                  {member.usuario?.correo || 'Sin correo'}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    member.rol === 'admin'
                      ? 'bg-uta-gold text-uta-navy'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {member.rol === 'admin' ? 'Admin' : 'Miembro'}
                </span>

                {isGroupAdmin && member.usuario_id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(Number(member.id), member.usuario?.correo)}
                    className="p-1 text-uta-red hover:bg-uta-red hover:bg-opacity-10 rounded transition-colors"
                    title="Eliminar miembro"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        💡 {isGroupAdmin ? 'Eres el administrador de este grupo' : 'Solo el administrador puede eliminar miembros'}
      </p>
    </div>
  )
}