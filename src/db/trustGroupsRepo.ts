import { supabase } from './supabaseClient'
import type { Tables, TablesInsert } from '../types/database'

export type Grupo = Tables<'grupos_confianza'>
export type GrupoMiembro = Tables<'grupo_miembros'>
export type SolicitudGrupo = Tables<'solicitudes_grupo'>

export type RolGrupo = 'admin' | 'miembro'

export const trustGroupsRepo = {
  // ---------- Grupos ----------
  async create(
    usuarioCreadorId: number,
    data: { nombre: string; descripcion?: string | null }
  ): Promise<Grupo> {
    const { data: grupo, error } = await supabase
      .from('grupos_confianza')
      .insert({
        usuario_creador_id: usuarioCreadorId,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return grupo
  },

  async findById(groupId: number): Promise<Grupo | null> {
    const { data, error } = await supabase
      .from('grupos_confianza')
      .select('*')
      .eq('id', groupId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async findManyByIds(ids: number[]): Promise<Grupo[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('grupos_confianza')
      .select('*')
      .in('id', ids)

    if (error) throw error
    return data ?? []
  },

  async findManyByIdSimple(ids: number[]) {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('grupos_confianza')
      .select('id, nombre')
      .in('id', ids)
    if (error) throw error
    return data ?? []
  },

  async deleteById(groupId: number): Promise<boolean> {
    const { error } = await supabase
      .from('grupos_confianza')
      .delete()
      .eq('id', groupId)
    return !error
  },

  // ---------- Membresía ----------
  async getGroupIdsForUser(userId: number): Promise<number[]> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .select('grupo_id')
      .eq('usuario_id', userId)

    if (error) throw error
    return (data ?? []).map((row) => row.grupo_id)
  },

  async getRoleInGroup(
    groupId: number,
    userId: number
  ): Promise<RolGrupo | null> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .select('rol')
      .eq('grupo_id', groupId)
      .eq('usuario_id', userId)
      .maybeSingle()

    if (error) throw error
    return (data?.rol as RolGrupo | undefined) ?? null
  },

  async countAdmins(groupId: number): Promise<number> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .select('id')
      .eq('grupo_id', groupId)
      .eq('rol', 'admin')

    if (error) throw error
    return (data ?? []).length
  },

  async addMember(
    groupId: number,
    userId: number,
    rol: RolGrupo = 'miembro'
  ): Promise<GrupoMiembro> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .insert({ grupo_id: groupId, usuario_id: userId, rol })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async listMembers(groupId: number): Promise<GrupoMiembro[]> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .select('id, grupo_id, usuario_id, rol, joined_at')
      .eq('grupo_id', groupId)

    if (error) throw error
    return data ?? []
  },

  async findMemberById(memberId: number): Promise<GrupoMiembro | null> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .select('*')
      .eq('id', memberId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async removeMemberById(memberId: number): Promise<boolean> {
    const { error } = await supabase
      .from('grupo_miembros')
      .delete()
      .eq('id', memberId)
    return !error
  },

  async removeUserFromGroup(groupId: number, userId: number): Promise<boolean> {
    const { error } = await supabase
      .from('grupo_miembros')
      .delete()
      .eq('grupo_id', groupId)
      .eq('usuario_id', userId)
    return !error
  },

  // ---------- Solicitudes ----------
  async findPendingInvitation(
    groupId: number,
    invitedUserId: number
  ): Promise<{ id: number } | null> {
    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .select('id')
      .eq('grupo_id', groupId)
      .eq('usuario_invitado_id', invitedUserId)
      .eq('estado', 'pendiente')
      .maybeSingle()

    if (error) throw error
    return data
  },

  async findExistingMembership(
    groupId: number,
    userId: number
  ): Promise<{ id: number } | null> {
    const { data, error } = await supabase
      .from('grupo_miembros')
      .select('id')
      .eq('grupo_id', groupId)
      .eq('usuario_id', userId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async createInvitation(input: {
    grupoId: number
    invitedUserId: number
    requesterId: number
    mensaje?: string
  }): Promise<SolicitudGrupo> {
    const row: TablesInsert<'solicitudes_grupo'> = {
      grupo_id: input.grupoId,
      usuario_invitado_id: input.invitedUserId,
      usuario_solicitante_id: input.requesterId,
      mensaje: input.mensaje ?? 'Te invitaron a un grupo de confianza.',
      estado: 'pendiente',
    }
    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async findPendingRequest(
    requestId: number,
    invitedUserId: number
  ): Promise<SolicitudGrupo | null> {
    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .select('*')
      .eq('id', requestId)
      .eq('usuario_invitado_id', invitedUserId)
      .eq('estado', 'pendiente')
      .maybeSingle()

    if (error) throw error
    return data
  },

  async updateRequestStatus(
    requestId: number,
    estado: 'aceptado' | 'rechazado'
  ): Promise<boolean> {
    const { error } = await supabase
      .from('solicitudes_grupo')
      .update({ estado })
      .eq('id', requestId)
    return !error
  },

  async listPendingInvitationsForUser(
    userId: number
  ): Promise<SolicitudGrupo[]> {
    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .select('*')
      .eq('usuario_invitado_id', userId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
}