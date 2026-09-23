export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options        
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)    
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      grupo_miembros: {
        Row: {
          grupo_id: number
          id: number
          joined_at: string
          rol: string
          usuario_id: number
        }
        Insert: {
          grupo_id: number
          id?: number
          joined_at?: string
          rol?: string
          usuario_id: number
        }
        Update: {
          grupo_id?: number
          id?: number
          joined_at?: string
          rol?: string
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupo_miembros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_confianza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_miembros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_confianza: {
        Row: {
          created_at: string
          descripcion: string | null
          id: number
          nombre: string
          updated_at: string
          usuario_creador_id: number
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: number
          nombre: string
          updated_at?: string
          usuario_creador_id: number
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: number
          nombre?: string
          updated_at?: string
          usuario_creador_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupos_confianza_usuario_creador_id_fkey"
            columns: ["usuario_creador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes: {
        Row: {
          created_at: string
          descripcion: string
          estado: string
          guardia_id: string | null
          id: number
          latitud: number | null
          longitud: number | null
          tipo_incidente: string
          updated_at: string
          usuario_id: number | null
          zona_id: number | null
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado?: string
          guardia_id?: string | null
          id?: number
          latitud?: number | null
          longitud?: number | null
          tipo_incidente?: string
          updated_at?: string
          usuario_id?: number | null
          zona_id?: number | null
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado?: string
          guardia_id?: string | null
          id?: number
          latitud?: number | null
          longitud?: number | null
          tipo_incidente?: string
          updated_at?: string
          usuario_id?: number | null
          zona_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          fecha: string
          id: number
          incidente_id: number | null
          leido: boolean
          mensaje: string
          usuario_id: number
        }
        Insert: {
          fecha?: string
          id?: number
          incidente_id?: number | null
          leido?: boolean
          mensaje: string
          usuario_id: number
        }
        Update: {
          fecha?: string
          id?: number
          incidente_id?: number | null
          leido?: boolean
          mensaje?: string
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_grupo: {
        Row: {
          created_at: string
          grupo_id: number
          id: number
          incidente_id: number | null
          leida: boolean
          mensaje: string
          usuario_emisor_id: number
        }
        Insert: {
          created_at?: string
          grupo_id: number
          id?: number
          incidente_id?: number | null
          leida?: boolean
          mensaje: string
          usuario_emisor_id: number
        }
        Update: {
          created_at?: string
          grupo_id?: number
          id?: number
          incidente_id?: number | null
          leida?: boolean
          mensaje?: string
          usuario_emisor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_grupo_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_confianza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_grupo_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "incidentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_grupo_usuario_emisor_id_fkey"       
            columns: ["usuario_emisor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_grupo: {
        Row: {
          created_at: string
          estado: string
          grupo_id: number
          id: number
          mensaje: string | null
          usuario_invitado_id: number
          usuario_solicitante_id: number
        }
        Insert: {
          created_at?: string
          estado?: string
          grupo_id: number
          id?: number
          mensaje?: string | null
          usuario_invitado_id: number
          usuario_solicitante_id: number
        }
        Update: {
          created_at?: string
          estado?: string
          grupo_id?: number
          id?: number
          mensaje?: string | null
          usuario_invitado_id?: number
          usuario_solicitante_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_grupo_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_confianza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_grupo_usuario_invitado_id_fkey"        
            columns: ["usuario_invitado_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_grupo_usuario_solicitante_id_fkey"     
            columns: ["usuario_solicitante_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          correo: string
          created_at: string
          id: number
          nombre: string
          password: string
          rol: string
          updated_at: string
        }
        Insert: {
          correo: string
          created_at?: string
          id?: number
          nombre: string
          password: string
          rol?: string
        }
        Update: {
          correo?: string
          created_at?: string
          id?: number
          nombre?: string
          password?: string
          rol?: string
          updated_at?: string
        }
        Relationships: []
      }
      zonas: {
        Row: {
          campus: string
          color: string
          coordenadas: Json
          created_at: string
          descripcion: string | null
          id: number
          nombre: string
          zona_tipo: string | null
        }
        Insert: {
          campus?: string
          color?: string
          coordenadas: Json
          created_at?: string
          descripcion?: string | null
          id?: number
          nombre: string
          zona_tipo?: string | null
        }
        Update: {
          campus?: string
          color?: string
          coordenadas?: Json
          created_at?: string
          descripcion?: string | null
          id?: number
          nombre?: string
          zona_tipo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &    
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {      
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]       
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {        
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]       
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {        
        Update: infer U
      }
        ? U
        : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const