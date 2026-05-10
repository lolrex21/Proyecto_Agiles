import { useState, useEffect } from 'react'
import type { Incident } from '../types/incident'
import { supabase } from '../services/supabaseClient'
import { getIncidents, updateIncidentStatus, searchIncidents } from '../services/incidentService'

export const useIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)

  // Cargar incidentes al iniciar y mantener la lista en tiempo real
  useEffect(() => {
    fetchIncidents()

    const channel = supabase
      .channel('incidentes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidentes' },
        () => {
          fetchIncidents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const data = await getIncidents()
      setIncidents(data)
    } catch (err) {
      console.error('Error fetching:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: number, status: 'Pendiente' | 'Atendido' | 'Cerrado') => {
    const success = await updateIncidentStatus(id, status)
    if (success) {
      setIncidents(
        incidents.map(inc =>
          inc.id === id ? { ...inc, estado: status } : inc
        )
      )
    }
    return success
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      fetchIncidents()
      return
    }
    const data = await searchIncidents(query)
    setIncidents(data)
  }

  return {
    incidents,
    loading,
    selectedIncident,
    setSelectedIncident,
    fetchIncidents,
    updateStatus,
    handleSearch,
  }
}