import { supabase } from './supabaseClient'
import type { Tables, TablesInsert } from '../types/database'

export type Usuario = Tables<'usuarios'>
export type UsuarioInsert = TablesInsert<'usuarios'>

export const usersRepo = {
  async findByEmail(correo: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', correo.toLowerCase())
      .maybeSingle()

    if (error) throw error
    return data
  },

  async findById(id: number): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async findByIds(ids: number[]) {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, correo')
      .in('id', ids)
    if (error) throw error
    return data ?? []
  },

  async create(input: UsuarioInsert): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return data
  },
}