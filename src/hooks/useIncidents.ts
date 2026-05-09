// src/hooks/useIncidents.ts

import { useState, useEffect } from 'react';
import type { Incident } from '../types/incident';
import { IncidentService } from '../services/incidentService';

export const useIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const data = await IncidentService.getIncidents();
      setIncidents(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los incidentes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateIncidentStatus = async (id: string, newStatus: "Activo" | "Atendido" | "Cerrado") => {
    const success = await IncidentService.updateIncidentStatus(id, newStatus);
    if (success) {
      setIncidents(incidents.map(inc => 
        inc.id === id ? { ...inc, status: newStatus } : inc
      ));
    }
    return success;
  };

  const searchIncidents = async (query: string) => {
    if (!query.trim()) {
      fetchIncidents();
      return;
    }
    const filtered = incidents.filter(inc =>
      inc.title.toLowerCase().includes(query.toLowerCase()) ||
      inc.location.toLowerCase().includes(query.toLowerCase()) ||
      inc.type.toLowerCase().includes(query.toLowerCase())
    );
    setIncidents(filtered);
  };

  return {
    incidents,
    loading,
    error,
    selectedIncident,
    setSelectedIncident,
    fetchIncidents,
    updateIncidentStatus,
    searchIncidents
  };
};