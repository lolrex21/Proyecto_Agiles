// src/types/incident.ts

export interface Incident {
  id: string;
  title: string;
  description: string;
  type: 'Robo' | 'Emergencia Médica' | 'Incendio' | 'Otro';
  location: string;
  latitude: number;
  longitude: number;
  status: 'Activo' | 'Atendido' | 'Cerrado';
  timestamp: string;
  reportedBy: string;
  building?: string;
  classroom?: string;
  estimatedTime?: string;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity: 'high' | 'medium' | 'low';
}