import { supabase } from './supabaseClient'

export interface AssignedGuard {
  id: number
  incidente_id: number
  guardia_id: number
  estado_asistencia: 'confirmado' | 'en_camino' | 'llego'
  fecha_asignacion: string
  usuario: {
    id: number
    nombre: string
    correo: string
  } | null
}

export const getAssignedGuards = async (incidentId: number): Promise<AssignedGuard[]> => {
  const { data, error } = await supabase
    .from('incidente_guardias')
    .select(`
      *,
      usuario:usuarios(id, nombre, correo)
    `)
    .eq('incidente_id', incidentId)
    .order('fecha_asignacion', { ascending: true })

  if (error) {
    console.error('Error fetching assigned guards:', error)
    return []
  }

  return data || []
}

export const confirmAttendance = async (
  incidentId: number,
  guardId: number
): Promise<boolean> => {
  const { error } = await supabase
    .from('incidente_guardias')
    .insert({
      incidente_id: incidentId,
      guardia_id: guardId,
      estado_asistencia: 'confirmado',
    })

  if (error) {
    console.error('Error confirming attendance:', error)
    return false
  }

  return true
}

export const updateAttendanceStatus = async (
  incidentId: number,
  guardId: number,
  status: 'en_camino' | 'llego'
): Promise<boolean> => {
  const { error } = await supabase
    .from('incidente_guardias')
    .update({ estado_asistencia: status })
    .eq('incidente_id', incidentId)
    .eq('guardia_id', guardId)

  if (error) {
    console.error('Error updating attendance status:', error)
    return false
  }

  return true
}

export const removeGuardAssignment = async (
  incidentId: number,
  guardId: number
): Promise<boolean> => {
  const { error } = await supabase
    .from('incidente_guardias')
    .delete()
    .eq('incidente_id', incidentId)
    .eq('guardia_id', guardId)

  if (error) {
    console.error('Error removing guard assignment:', error)
    return false
  }

  return true
}
