// src/services/incidentService.ts

// src/services/incidentService.ts
import type { Incident } from '../types/incident';

// Simular datos de ejemplo (luego conectarás con Supabase)
const MOCK_INCIDENTS: Incident[] = [
  {
    id: '1',
    title: 'Emergencia Médica',
    description: 'Estudiante con síncope',
    type: 'Emergencia Médica',
    location: 'Aula 201, Edificio de Medicina',
    latitude: -1.2345,
    longitude: -78.6234,
    status: 'Activo',
    timestamp: new Date().toISOString(),
    reportedBy: 'Juan Pérez',
    building: 'Edificio de Medicina',
    classroom: 'Aula 201',
    estimatedTime: '5 min'
  },
  {
    id: '2',
    title: 'Robo',
    description: 'Robo de laptop en biblioteca',
    type: 'Robo',
    location: 'Biblioteca Central',
    latitude: -1.2350,
    longitude: -78.6240,
    status: 'Atendido',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    reportedBy: 'María García',
    estimatedTime: '10 min'
  },
  {
    id: '3',
    title: 'Incendio',
    description: 'Incendio en parque central',
    type: 'Incendio',
    location: 'Parque Central',
    latitude: -1.2340,
    longitude: -78.6220,
    status: 'Cerrado',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    reportedBy: 'Carlos López',
    estimatedTime: 'Finalizado'
  }
];

export class IncidentService {
  // Obtener todos los incidentes
  static async getIncidents(): Promise<Incident[]> {
    // TODO: Reemplazar con llamada a Supabase
    // return await supabase.from('incidents').select('*');
    return new Promise(resolve => {
      setTimeout(() => resolve(MOCK_INCIDENTS), 500);
    });
  }

  // Obtener incidente por ID
  static async getIncidentById(id: string): Promise<Incident | null> {
    const incident = MOCK_INCIDENTS.find(inc => inc.id === id);
    return new Promise(resolve => {
      setTimeout(() => resolve(incident || null), 300);
    });
  }

  // Obtener incidentes activos
  static async getActiveIncidents(): Promise<Incident[]> {
    const active = MOCK_INCIDENTS.filter(inc => inc.status === 'Activo');
    return new Promise(resolve => {
      setTimeout(() => resolve(active), 500);
    });
  }

  // Buscar incidentes por tipo
  static async getIncidentsByType(type: string): Promise<Incident[]> {
    const filtered = MOCK_INCIDENTS.filter(inc => inc.type === type);
    return new Promise(resolve => {
      setTimeout(() => resolve(filtered), 500);
    });
  }

  // Actualizar estado de incidente
  static async updateIncidentStatus(id: string, status: string): Promise<boolean> {
    const incident = MOCK_INCIDENTS.find(inc => inc.id === id);
    if (incident) {
      incident.status = status as any;
      return new Promise(resolve => {
        setTimeout(() => resolve(true), 300);
      });
    }
    return false;
  }
}