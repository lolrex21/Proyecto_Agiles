// Reexporta el cliente único tipado desde la capa de repositorios.
// Mantener un único cliente evita conflictos en la sesión de autenticación.
export { supabase } from '../db/supabaseClient'