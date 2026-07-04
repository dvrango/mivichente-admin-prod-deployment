export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bus_schedules: {
        Row: {
          company: string
          extra_times: Json
          id: string
          route_from: string
          route_to: string
          times: string[]
          updated_at: string | null
        }
        Insert: {
          company: string
          extra_times?: Json
          id?: string
          route_from: string
          route_to: string
          times: string[]
          updated_at?: string | null
        }
        Update: {
          company?: string
          extra_times?: Json
          id?: string
          route_from?: string
          route_to?: string
          times?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      business_categories: {
        Row: {
          business_id: string
          category_id: string
          created_at: string
          is_primary: boolean
        }
        Insert: {
          business_id: string
          category_id: string
          created_at?: string
          is_primary?: boolean
        }
        Update: {
          business_id?: string
          category_id?: string
          created_at?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'business_categories_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'business_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          closes_at: string
          day_of_week: number
          id: string
          opens_at: string
        }
        Insert: {
          business_id: string
          closes_at: string
          day_of_week: number
          id?: string
          opens_at: string
        }
        Update: {
          business_id?: string
          closes_at?: string
          day_of_week?: number
          id?: string
          opens_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'business_hours_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
        ]
      }
      business_registrations: {
        Row: {
          business_name: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          description: string
          id: string
          municipio: string
          notes: string | null
          phone: string
          status: string
        }
        Insert: {
          business_name: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          description: string
          id?: string
          municipio: string
          notes?: string | null
          phone: string
          status?: string
        }
        Update: {
          business_name?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          id?: string
          municipio?: string
          notes?: string | null
          phone?: string
          status?: string
        }
        Relationships: []
      }
      business_reports: {
        Row: {
          business_id: string
          created_at: string
          id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'business_reports_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          aliases: string[]
          category_id: string | null
          colonia: string | null
          created_at: string
          created_by: string | null
          data_source: string
          description: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          is_featured: boolean
          is_verified: boolean
          maps_url: string | null
          municipio: string
          name: string
          name_normalized: string | null
          offerings: string[]
          phone: string
          phone_is_whatsapp: boolean
          photo_url: string | null
          schedule: string | null
          updated_at: string
          updated_by: string | null
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          aliases?: string[]
          category_id?: string | null
          colonia?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_verified?: boolean
          maps_url?: string | null
          municipio?: string
          name: string
          name_normalized?: string | null
          offerings?: string[]
          phone: string
          phone_is_whatsapp?: boolean
          photo_url?: string | null
          schedule?: string | null
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          aliases?: string[]
          category_id?: string | null
          colonia?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_verified?: boolean
          maps_url?: string | null
          municipio?: string
          name?: string
          name_normalized?: string | null
          offerings?: string[]
          phone?: string
          phone_is_whatsapp?: boolean
          photo_url?: string | null
          schedule?: string | null
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'businesses_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'businesses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'businesses_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          aliases: string[]
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          municipio: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          municipio?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          municipio?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      businesses_open_now: {
        Args: never
        Returns: {
          address: string | null
          aliases: string[]
          category_id: string | null
          colonia: string | null
          created_at: string
          created_by: string | null
          data_source: string
          description: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          is_featured: boolean
          is_verified: boolean
          maps_url: string | null
          municipio: string
          name: string
          name_normalized: string | null
          offerings: string[]
          phone: string
          phone_is_whatsapp: boolean
          photo_url: string | null
          schedule: string | null
          updated_at: string
          updated_by: string | null
          verified_at: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'businesses'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      immutable_unaccent: { Args: { '': string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      search_businesses: {
        Args: { search_query: string }
        Returns: {
          address: string | null
          aliases: string[]
          category_id: string | null
          colonia: string | null
          created_at: string
          created_by: string | null
          data_source: string
          description: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          is_featured: boolean
          is_verified: boolean
          maps_url: string | null
          municipio: string
          name: string
          name_normalized: string | null
          offerings: string[]
          phone: string
          phone_is_whatsapp: boolean
          photo_url: string | null
          schedule: string | null
          updated_at: string
          updated_by: string | null
          verified_at: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'businesses'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: string[] }
      unaccent: { Args: { '': string }; Returns: string }
      user_municipio: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
