import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'
import { getAssignedGuards, type AssignedGuard } from '../services/incidentGuardService'

export function useIncidentGuards(incidentId: number | null) {
  const [guards, setGuards] = useState<AssignedGuard[]>([])
  const [loading, setLoading] = useState(false)

  const fetchGuards = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    const data = await getAssignedGuards(incidentId)
    setGuards(data)
    setLoading(false)
  }, [incidentId])

  useEffect(() => {
    fetchGuards()

    if (!incidentId) return

    const channel = supabase
      .channel(`incident-guards-${incidentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidente_guardias',
          filter: `incidente_id=eq.${incidentId}`,
        },
        () => {
          fetchGuards()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [incidentId, fetchGuards])

  return { guards, loading, refetch: fetchGuards }
}
