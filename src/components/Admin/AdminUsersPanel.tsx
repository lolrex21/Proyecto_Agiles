import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../services/supabaseClient'

type Usuario = {
  id: number
  nombre: string
  correo: string
  rol: string
  telefono?: string | null
  fecha_registro?: string | null
  auth_provider?: string | null
}

export default function AdminUsersPanel() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')

  useEffect(() => {
    const loadUsuarios = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, correo, rol, telefono, fecha_registro, auth_provider')
        .order('id', { ascending: false })

      if (error) {
        console.error('Error cargando usuarios:', error)
        setUsuarios([])
      } else {
        setUsuarios(data || [])
      }

      setLoading(false)
    }

    void loadUsuarios()
  }, [])

  const filteredUsers = useMemo(() => {
    if (!roleFilter) return usuarios

    return usuarios.filter(
      (usuario) => usuario.rol?.toLowerCase() === roleFilter.toLowerCase()
    )
  }, [usuarios, roleFilter])

  const totalUsuarios = usuarios.length
  const totalEstudiantes = usuarios.filter(
    (usuario) => usuario.rol?.toLowerCase() === 'estudiante'
  ).length
  const totalGuardias = usuarios.filter(
    (usuario) => usuario.rol?.toLowerCase() === 'guardia'
  ).length
  const totalAdmins = usuarios.filter((usuario) =>
    ['admin', 'administrador'].includes(usuario.rol?.toLowerCase())
  ).length

  const formatDate = (fecha?: string | null) => {
    if (!fecha) return 'Sin fecha'

    return new Date(fecha).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <article className="dashboard-card stats-section admin-users-section">
        <div className="section-header compact-header">
          <div>
            <h2>Gestión de usuarios</h2>
            <p>Cargando usuarios registrados...</p>
          </div>
        </div>

        <div className="p-4 text-sm text-gray-600">
          Cargando...
        </div>
      </article>
    )
  }

  return (
    <article className="dashboard-card stats-section admin-users-section">
      <div className="section-header compact-header">
        <div>
          <h2>Gestión de usuarios</h2>
          <p>Administración de estudiantes, guardias y administradores.</p>
        </div>
      </div>

      <div className="admin-users-panel">
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <span>Total usuarios</span>
            <strong>{totalUsuarios}</strong>
          </div>

          <div className="admin-summary-card">
            <span>Estudiantes</span>
            <strong>{totalEstudiantes}</strong>
          </div>

          <div className="admin-summary-card">
            <span>Guardias</span>
            <strong>{totalGuardias}</strong>
          </div>

          <div className="admin-summary-card">
            <span>Administradores</span>
            <strong>{totalAdmins}</strong>
          </div>
        </div>

        <div className="admin-users-toolbar">
          <div>
            <h3>Usuarios registrados</h3>
            <p>{filteredUsers.length} usuario(s) encontrados</p>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-role-select"
          >
            <option value="">Todos los roles</option>
            <option value="estudiante">Estudiantes</option>
            <option value="guardia">Guardias</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="admin-empty-state">
            No hay usuarios registrados con ese filtro.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Teléfono</th>
                  <th>Registro</th>
                  <th>Proveedor</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.nombre || 'Sin nombre'}</td>
                    <td>{usuario.correo || 'Sin correo'}</td>
                    <td>
                      <span className={`role-badge role-${usuario.rol?.toLowerCase()}`}>
                        {usuario.rol || 'Sin rol'}
                      </span>
                    </td>
                    <td>{usuario.telefono || 'Sin teléfono'}</td>
                    <td>{formatDate(usuario.fecha_registro)}</td>
                    <td>{usuario.auth_provider || 'local'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  )
}