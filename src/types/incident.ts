// src/types/incident.ts

export interface Incident {
  id: number
  usuario_id: number
  tipo_incidente: string
  descripcion: string
  estado: 'Pendiente' | 'Atendido' | 'Cerrado'
  latitud?: number
  longitud?: number
  created_at?: string
  usuario?: { nombre: string }
  guardia_id?: string
  zona_id?: number
  zona?: { id: number; nombre: string }
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity: 'high' | 'medium' | 'low';
}