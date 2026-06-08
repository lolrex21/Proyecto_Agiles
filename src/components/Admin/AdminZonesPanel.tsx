import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabaseClient'

type Zona = {
  id: number
  nombre: string
  descripcion?: string | null
  color?: string | null
  zona_tipo?: string | null
  campus?: string | null
  coordenadas?: any
}
type AdminZonesPanelProps = {
  onEditZone?: (zone: Zona) => void
}
export default function AdminZonesPanel({ onEditZone }: AdminZonesPanelProps) {
  const [zones, setZones] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadZones = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('zonas')
        .select('id, nombre, descripcion, color, zona_tipo, campus, coordenadas')
        .order('id', { ascending: true })

      if (error) {
        console.error('Error cargando zonas:', error)
        setZones([])
      } else {
        setZones(data || [])
      }

      setLoading(false)
    }

    void loadZones()
  }, [])

  if (loading) {
    return (
      <article className="dashboard-card stats-section admin-zones-section">
        <div className="section-header compact-header">
          <div>
            <h2>Gestión de zonas</h2>
            <p>Cargando zonas del campus...</p>
          </div>
        </div>

        <div className="p-4 text-sm text-gray-600">Cargando...</div>
      </article>
    )
  }

  return (
    <article className="dashboard-card stats-section admin-zones-section">
      <div className="section-header compact-header">
        <div>
          <h2>Gestión de zonas</h2>
          <p>Administración de zonas registradas dentro del campus.</p>
        </div>
      </div>

      <div className="admin-zones-panel">
        <div className="admin-users-toolbar">
          <div>
            <h3>Zonas del campus</h3>
            <p>{zones.length} zona(s) registradas</p>
          </div>
        </div>

        {zones.length === 0 ? (
          <div className="admin-empty-state">
            No hay zonas registradas todavía.
          </div>
        ) : (
          <div className="admin-zones-grid">
{zones.map((zone) => (
  <div
    key={zone.id}
    className="admin-zone-card admin-zone-card-clickable"
    onClick={() => onEditZone?.(zone)}
  >
                <div className="admin-zone-header">
                  <span
                    className="admin-zone-color"
                    style={{ backgroundColor: zone.color || '#94a3b8' }}
                  />
                  <div>
                    <h3>{zone.nombre}</h3>
                    <p>{zone.campus || 'Campus no especificado'}</p>
                  </div>
                </div>

                <p className="admin-zone-description">
                  {zone.descripcion || 'Sin descripción registrada.'}
                </p>

                <div className="admin-zone-meta">
                  <span>Tipo: {zone.zona_tipo || 'No definido'}</span>
                  <span>
                    Coordenadas:{' '}
                    {Array.isArray(zone.coordenadas)
                      ? zone.coordenadas.length
                      : 'Registradas'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}