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
      admin_audit_log: {
        Row: {
          action: string
          admin_identifier: string
          created_at: string
          id: string
          ip: string | null
          payload: Json
          target_org_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_identifier: string
          created_at?: string
          id?: string
          ip?: string | null
          payload?: Json
          target_org_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_identifier?: string
          created_at?: string
          id?: string
          ip?: string | null
          payload?: Json
          target_org_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          email_attempted: string
          id: string
          ip: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_attempted: string
          id?: string
          ip: string
          success: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_attempted?: string
          id?: string
          ip?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          data_hora: string
          duracao: number
          id: string
          observacao: string | null
          org_id: string
          patient_id: string
          status: string
          titulo: string | null
          updated_at: string
          walkin: boolean | null
        }
        Insert: {
          created_at?: string
          data_hora: string
          duracao?: number
          id?: string
          observacao?: string | null
          org_id: string
          patient_id: string
          status?: string
          titulo?: string | null
          updated_at?: string
          walkin?: boolean | null
        }
        Update: {
          created_at?: string
          data_hora?: string
          duracao?: number
          id?: string
          observacao?: string | null
          org_id?: string
          patient_id?: string
          status?: string
          titulo?: string | null
          updated_at?: string
          walkin?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_records: {
        Row: {
          appointment_id: string | null
          clinical_data: Json | null
          created_at: string
          deleted_at: string | null
          editado: boolean | null
          editado_em: string | null
          finalizado_em: string | null
          finalizado_por: string | null
          id: string
          last_edited_by: string | null
          modelo: string
          org_id: string
          patient_id: string
          retorno_previsto_em: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinical_data?: Json | null
          created_at?: string
          deleted_at?: string | null
          editado?: boolean | null
          editado_em?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          id?: string
          last_edited_by?: string | null
          modelo?: string
          org_id: string
          patient_id: string
          retorno_previsto_em?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinical_data?: Json | null
          created_at?: string
          deleted_at?: string | null
          editado?: boolean | null
          editado_em?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          id?: string
          last_edited_by?: string | null
          modelo?: string
          org_id?: string
          patient_id?: string
          retorno_previsto_em?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_finalizado_por_fkey"
            columns: ["finalizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          org_id: string
          payload: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          org_id: string
          payload?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          org_id?: string
          payload?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_notes: {
        Row: {
          author_admin: string
          content: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          author_admin: string
          content: string
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          author_admin?: string
          content?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accepted_terms_at: string | null
          accepted_terms_ip: string | null
          accepted_terms_version: string | null
          asaas_customer_id: string | null
          cpf_cnpj: string | null
          created_at: string
          deletion_reason: string | null
          deletion_requested_at: string | null
          deletion_scheduled_for: string | null
          endereco: string | null
          horario_funcionamento: Json
          id: string
          nome_clinica: string
          plan: string
          plan_status: string
          slug: string | null
          telefone: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_terms_at?: string | null
          accepted_terms_ip?: string | null
          accepted_terms_version?: string | null
          asaas_customer_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          endereco?: string | null
          horario_funcionamento?: Json
          id?: string
          nome_clinica: string
          plan?: string
          plan_status?: string
          slug?: string | null
          telefone?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string | null
          accepted_terms_ip?: string | null
          accepted_terms_version?: string | null
          asaas_customer_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          endereco?: string | null
          horario_funcionamento?: Json
          id?: string
          nome_clinica?: string
          plan?: string
          plan_status?: string
          slug?: string | null
          telefone?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      origens_paciente: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          nome: string
          org_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome: string
          org_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "origens_paciente_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          org_id: string
          origem_id: string | null
          responsavel_legal: string | null
          sexo_biologico: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          org_id: string
          origem_id?: string | null
          responsavel_legal?: string | null
          sexo_biologico?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          org_id?: string
          origem_id?: string | null
          responsavel_legal?: string | null
          sexo_biologico?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens_paciente"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          asaas_payment_id: string
          billing_type: string | null
          created_at: string
          due_date: string | null
          id: string
          net_amount_cents: number | null
          org_id: string
          paid_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          asaas_payment_id: string
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          net_amount_cents?: number | null
          org_id: string
          paid_at?: string | null
          status: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          asaas_payment_id?: string
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          net_amount_cents?: number | null
          org_id?: string
          paid_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          amount_cents: number
          billing_type: string
          created_at: string
          cycle: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_type?: string
          created_at?: string
          cycle: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_type?: string
          created_at?: string
          cycle?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          clinical_record_id: string | null
          created_at: string
          dados_prescricao: Json
          deleted_at: string | null
          finalizada_em: string | null
          id: string
          org_id: string
          patient_id: string
          pdf_gerado_em: string | null
          prescription_type: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinical_record_id?: string | null
          created_at?: string
          dados_prescricao?: Json
          deleted_at?: string | null
          finalizada_em?: string | null
          id?: string
          org_id: string
          patient_id: string
          pdf_gerado_em?: string | null
          prescription_type?: string
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinical_record_id?: string | null
          created_at?: string
          dados_prescricao?: Json
          deleted_at?: string | null
          finalizada_em?: string | null
          id?: string
          org_id?: string
          patient_id?: string
          pdf_gerado_em?: string | null
          prescription_type?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          cro_cboo: string | null
          first_seen_at: string | null
          formacoes: string[] | null
          id: string
          last_seen_at: string | null
          nome_completo: string | null
          onboarded: boolean | null
          org_id: string
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cro_cboo?: string | null
          first_seen_at?: string | null
          formacoes?: string[] | null
          id: string
          last_seen_at?: string | null
          nome_completo?: string | null
          onboarded?: boolean | null
          org_id: string
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cro_cboo?: string | null
          first_seen_at?: string | null
          formacoes?: string[] | null
          id?: string
          last_seen_at?: string | null
          nome_completo?: string | null
          onboarded?: boolean | null
          org_id?: string
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cents: number
          asaas_subscription_id: string | null
          billing_type: string
          created_at: string
          current_period_end: string | null
          cycle: string
          id: string
          org_id: string
          plan_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          asaas_subscription_id?: string | null
          billing_type: string
          created_at?: string
          current_period_end?: string | null
          cycle: string
          id?: string
          org_id: string
          plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          asaas_subscription_id?: string | null
          billing_type?: string
          created_at?: string
          current_period_end?: string | null
          cycle?: string
          id?: string
          org_id?: string
          plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          asaas_payment_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          asaas_payment_id?: string | null
          created_at?: string
          event_type: string
          id: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          asaas_payment_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_user_metrics: {
        Args: never
        Returns: {
          fichas_abandonadas: number
          fichas_finalizadas: number
          first_seen_at: string
          last_seen_at: string
          nome_completo: string
          org_created_at: string
          org_id: string
          org_nome: string
          org_status: string
          pacientes_ativos: number
          pdfs_gerados: number
          profile_created_at: string
          ultimo_login: string
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
