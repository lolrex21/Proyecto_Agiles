import { useState, useEffect, useCallback, useRef } from 'react'
import type { Incident } from '../types/incident'
import { supabase } from '../services/supabaseClient'
import { getIncidents, updateIncidentStatus, searchIncidents } from '../services/incidentService'

export const useIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const isFirstLoad = useRef(true)

  // ── fetchIncidents definida ANTES del useEffect que la usa ──
  const fetchIncidents = useCallback(async (showLoading = false) => {
    try {
      // Solo muestra spinner en la carga inicial o cuando se pide explícitamente
      if (showLoading || isFirstLoad.current) setLoading(true)
      const data = await getIncidents()
      setIncidents(data)
      isFirstLoad.current = false
    } catch (err) {
      console.error('Error fetching:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Carga inicial + Supabase Realtime ──────────────────────
  useEffect(() => {
    fetchIncidents(true) // true = mostrar spinner en la primera carga

    const channel = supabase
      .channel('incidentes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidentes' },
        () => {
          fetchIncidents(false) // false = actualización silenciosa, sin spinner
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchIncidents])

  const updateStatus = async (id: number, status: 'Pendiente' | 'Atendido' | 'Cerrado') => {
    const success = await updateIncidentStatus(id, status)
    if (success) {
      setIncidents(prev =>
        prev.map(inc => inc.id === id ? { ...inc, estado: status } : inc)
      )
    }
    return success
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      fetchIncidents(true)
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