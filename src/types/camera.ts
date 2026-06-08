export interface Camera {
  id: number
  nombre: string
  latitud: number
  longitud: number
  estado_conectividad: 'Activa' | 'Inactiva'
  fecha_instalacion?: string
  created_at?: string
}
