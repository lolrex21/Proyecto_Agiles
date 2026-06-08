import {
  GoogleMap,
  Polygon,
  useJsApiLoader,
} from '@react-google-maps/api'
import { useState } from 'react'
import { supabase } from '../../services/supabaseClient'

type ZoneEditorMapProps = {
  zone: any
  zones: any[]
  onZoneUpdated?: (zone: any) => void
  onCancel?: () => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const defaultCenter = {
  lat: -1.2685,
  lng: -78.6245,
}

export default function ZoneEditorMap({
  zone,
  zones,
  onZoneUpdated,
  onCancel,
}: ZoneEditorMapProps) {
  const [nombre, setNombre] = useState(zone.nombre || '')
  const [descripcion, setDescripcion] = useState(zone.descripcion || '')
  const [color, setColor] = useState(zone.color || '#2563eb')
  const [zonaTipo, setZonaTipo] = useState(zone.zona_tipo || '')
  const [saving, setSaving] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  })


const handleSave = async () => {
  setSaving(true)

  const { data, error } = await supabase
    .from('zonas')
    .update({
      nombre,
      descripcion,
      color,
      zona_tipo: zonaTipo,
    })
    .eq('id', zone.id)
    .select()
    .maybeSingle()

  setSaving(false)

  if (error) {
    console.error('Error actualizando zona:', error)
    alert(`No se pudo actualizar la zona: ${error.message}`)
    return
  }

  if (!data) {
    alert('No se actualizó ninguna zona. Revisa si el ID existe o si Supabase permite actualizar esta tabla.')
    return
  }

  alert('Zona actualizada correctamente.')
  onZoneUpdated?.(data)
}

  const handleDelete = async () => {
    const confirmed = confirm(
      `¿Seguro que deseas eliminar la zona "${zone.nombre}"?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('zonas')
      .delete()
      .eq('id', zone.id)

    if (error) {
      alert('No se pudo eliminar la zona.')
      console.error(error)
      return
    }

    alert('Zona eliminada correctamente.')
    onCancel?.()
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        Cargando mapa...
      </div>
    )
  }

  return (
    <div className="zone-editor-layout">
      <div className="zone-editor-map">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={17}
          options={{
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          }}
        >
          {zones.map((item) => (
            <Polygon
              key={item.id}
              paths={item.coordenadas || []}
              options={{
                strokeColor: item.id === zone.id ? color : item.color,
                strokeOpacity: item.id === zone.id ? 1 : 0.6,
                strokeWeight: item.id === zone.id ? 5 : 2,
                fillColor: item.id === zone.id ? color : item.color,
                fillOpacity: item.id === zone.id ? 0.28 : 0.1,
                editable: item.id === zone.id,
                draggable: item.id === zone.id,
              }}
            />
          ))}
        </GoogleMap>
      </div>

      <aside className="zone-editor-panel">
        <h3>Configuración de zona</h3>

        <label>
          <span>Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>

        <label>
          <span>Descripción</span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        <label>
          <span>Tipo</span>
          <input
            value={zonaTipo}
            onChange={(e) => setZonaTipo(e.target.value)}
          />
        </label>

        <label>
          <span>Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="zone-editor-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>

        <button
          type="button"
          className="zone-editor-delete"
          onClick={handleDelete}
        >
          Eliminar zona
        </button>

        <button
          type="button"
          className="zone-editor-cancel"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </aside>
    </div>
  )
}