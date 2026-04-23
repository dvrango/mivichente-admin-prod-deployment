// Generado manualmente a partir de supabase/migrations/20260422170000_initial_schema.sql
// Reemplazar con `npm run db:types` tras cada migración.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          icon: string | null
          type: 'food' | 'business'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string | null
          type: 'food' | 'business'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string | null
          type?: 'food' | 'business'
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          id: string
          name: string
          category_id: string | null
          phone: string
          address: string | null
          schedule: string | null
          photo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category_id?: string | null
          phone: string
          address?: string | null
          schedule?: string | null
          photo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category_id?: string | null
          phone?: string
          address?: string | null
          schedule?: string | null
          photo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'businesses_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
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

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
