import { useEffect, useState } from 'react'
import { getUserTrustGroups, deleteTrustGroup } from '../services/trustGroupService'
import { getCurrentUser } from '../services/authService'
import type { TrustGroup } from '../types/trustGroup'
import GroupMemberManager from './GroupMemberManager'
import GroupMembersView from './GroupMembersView'

interface TrustGroupListProps {
  refreshTrigger?: number
}

type ViewMode = 'list' | 'members' | 'manage'

export default function TrustGroupList({ refreshTrigger }: TrustGroupListProps) {
  const [groups, setGroups] = useState<TrustGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<TrustGroup | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const user = getCurrentUser()
  const userId = user?.id ? Number(user.id) : null

  const loadGroups = async () => {
    if (!userId) {
      setGroups([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const userGroups = await getUserTrustGroups(userId)
    setGroups(userGroups)
    setIsLoading(false)
  }

  useEffect(() => {
    void loadGroups()
  }, [refreshTrigger, userId])

const handleDeleteGroup = async (groupId: number) => {
  if (!userId) {
    setMessageType('error')
    setMessage('No se pudo identificar al usuario actual.')
    return
  }

  if (!window.confirm('¿Estás seguro de que deseas eliminar este grupo?')) {
    return
  }

  const result = await deleteTrustGroup(Number(groupId), userId)

  if (result.success) {
    setMessageType('success')
    setMessage('Grupo eliminado exitosamente')

    // limpiar vista actual
    setSelectedGroup(null)
    setViewMode('list')

    // recargar lista desde Supabase
    const updatedGroups = await getUserTrustGroups(userId)
    setGroups(updatedGroups)
  } else {
    setMessageType('error')
    setMessage(result.message)
  }

  setTimeout(() => setMessage(''), 3000)
}

  const handleSelectGroup = (group: TrustGroup) => {
    setSelectedGroup(group)
    setViewMode('members')
  }

  const handleBackToList = () => {
    setViewMode('list')
    setSelectedGroup(null)
    void loadGroups()
  }

  const handleManageMembers = () => {
    setViewMode('manage')
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-600">Cargando grupos...</p>
      </div>
    )
  }

  if (viewMode === 'manage' && selectedGroup) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <button
          onClick={handleBackToList}
          className="mb-4 text-uta-gold hover:text-uta-gold-dark font-semibold text-sm"
        >
          ← Volver a grupos
        </button>

        <GroupMemberManager group={selectedGroup} onMemberAdded={loadGroups} />
      </div>
    )
  }

  if (viewMode === 'members' && selectedGroup) {
    const isAdmin = selectedGroup.usuario_creador_id === userId

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <button
          onClick={handleBackToList}
          className="mb-4 text-uta-gold hover:text-uta-gold-dark font-semibold text-sm"
        >
          ← Volver a grupos
        </button>

        <h2 className="text-2xl font-bold text-uta-navy mb-6">{selectedGroup.nombre}</h2>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={handleManageMembers}
                className="py-2 px-4 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-bold rounded-lg transition-colors"
              >
                Gestionar Miembros
              </button>

              <button
                onClick={() => handleDeleteGroup(Number(selectedGroup.id))}
                className="py-2 px-4 bg-uta-red hover:bg-uta-red-dark text-white font-bold rounded-lg transition-colors"
              >
                Eliminar Grupo
              </button>
            </>
          ) : (
            <p className="col-span-2 text-sm text-gray-600">
              Puedes ver los integrantes del grupo. Solo el administrador puede gestionar miembros.
            </p>
          )}
        </div>

        <GroupMembersView group={selectedGroup} onMembersChanged={loadGroups} />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-uta-navy mb-6">Mis Grupos de Confianza</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-uta-red/10 text-uta-red'
          }`}
        >
          {message}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No tienes grupos de confianza aún</p>
          <p className="text-sm text-gray-500">Crea tu primer grupo para comenzar a coordinar seguridad</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(group => (
            <div
              key={group.id}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-uta-gold transition-colors"
            >
              <h3 className="text-lg font-bold text-uta-navy mb-2">{group.nombre}</h3>

              {group.descripcion && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{group.descripcion}</p>
              )}

              <p className="text-xs text-gray-500 mb-4">
                Creado: {new Date(group.created_at).toLocaleDateString('es-ES')}
              </p>

              <button
                onClick={() => handleSelectGroup(group)}
                className="w-full py-2 px-3 bg-uta-gold hover:bg-uta-gold-dark text-uta-navy font-semibold rounded-lg transition-colors text-sm"
              >
                Ver Detalles
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}