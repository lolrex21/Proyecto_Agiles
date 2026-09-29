// src/types/incident.ts

export type EstadoIncidente = 'Pendiente' | 'Atendido' | 'Cerrado' | 'Cancelado'

export type IncidentSeverity = 'high' | 'medium' | 'low'

export interface IncidentConfig {
  label: string
  color: string
  emoji?: string
  severity?: IncidentSeverity
}

export type KnownIncidentType =
  | 'robo'
  | 'agresion'
  | 'vandalismo'
  | 'sospechoso'
  | 'accidente'
  | 'incendio'
  | 'fuga_gas'
  | 'otro'

export type IncidentType = KnownIncidentType | (string & {})

export interface Incident {
  id: number
  usuario_id: number | null
  tipo_incidente: string
  descripcion: string
  estado: EstadoIncidente
  latitud?: number | null
  longitud?: number | null
  created_at?: string
  updated_at?: string
  usuario?: { nombre: string }
  guardia_id?: string | null
  zona_id?: number | null
  zona?: { id: number; nombre: string }
}

export interface MapMarker {
  id: string
  lat: number
  lng: number
  title: string
  severity: IncidentSeverity
}
