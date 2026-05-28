// Reexportamos el mismo cliente para evitar tener dos instancias de Supabase.
// Dos instancias provocan conflictos en la sesión de autenticación.
export { supabase } from '../services/supabaseClient'