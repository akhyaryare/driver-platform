export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'admin' | 'driver'
          full_name: string
          phone: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: 'admin' | 'driver'
          full_name: string
          phone?: string | null
          email?: string | null
        }
        Update: {
          role?: 'admin' | 'driver'
          full_name?: string
          phone?: string | null
          email?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          id: string
          profile_id: string | null
          name: string
          phone: string
          email: string | null
          vehicle_plate: string | null
          status: 'active' | 'inactive' | 'on_route'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          name: string
          phone: string
          email?: string | null
          vehicle_plate?: string | null
          status?: 'active' | 'inactive' | 'on_route'
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string | null
          name?: string
          phone?: string
          email?: string | null
          vehicle_plate?: string | null
          status?: 'active' | 'inactive' | 'on_route'
        }
        Relationships: []
      }
      routes: {
        Row: {
          id: string
          name: string
          route_number: string | null
          description: string | null
          waypoints: Json
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          route_number?: string | null
          description?: string | null
          waypoints?: Json
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          route_number?: string | null
          description?: string | null
          waypoints?: Json
          status?: 'active' | 'inactive'
        }
        Relationships: []
      }
      driver_routes: {
        Row: {
          id: string
          driver_id: string
          route_id: string
          assigned_at: string
          date: string
          status: 'pending' | 'in_progress' | 'completed'
        }
        Insert: {
          id?: string
          driver_id: string
          route_id: string
          date?: string
          status?: 'pending' | 'in_progress' | 'completed'
          assigned_at?: string
        }
        Update: {
          status?: 'pending' | 'in_progress' | 'completed'
        }
        Relationships: [
          {
            foreignKeyName: 'driver_routes_driver_id_fkey'
            columns: ['driver_id']
            isOneToOne: false
            referencedRelation: 'drivers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'driver_routes_route_id_fkey'
            columns: ['route_id']
            isOneToOne: false
            referencedRelation: 'routes'
            referencedColumns: ['id']
          }
        ]
      }
      driver_locations: {
        Row: {
          id: string
          driver_id: string
          lat: number
          lng: number
          accuracy: number | null
          heading: number | null
          speed: number | null
          recorded_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          lat: number
          lng: number
          accuracy?: number | null
          heading?: number | null
          speed?: number | null
          recorded_at?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          title: string
          message: string
          channel: 'sms' | 'email' | 'both'
          recipients: 'all' | 'active' | 'on_route'
          sent_by: string | null
          status: 'pending' | 'sent' | 'failed'
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          message: string
          channel: 'sms' | 'email' | 'both'
          recipients: 'all' | 'active' | 'on_route'
          sent_by?: string | null
          status?: 'pending' | 'sent' | 'failed'
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'sent' | 'failed'
          sent_at?: string | null
        }
        Relationships: []
      }
      delivery_reports: {
        Row: {
          id: string
          driver_id: string
          route_id: string | null
          route_number_text: string | null
          date: string
          parcels_taken: number
          parcels_delivered: number
          parcels_failed: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          route_id?: string | null
          route_number_text?: string | null
          date?: string
          parcels_taken: number
          parcels_delivered: number
          parcels_failed: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          route_id?: string | null
          route_number_text?: string | null
          parcels_taken?: number
          parcels_delivered?: number
          parcels_failed?: number
          notes?: string | null
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          id: string
          route_id: string
          postcode: string
          label: string | null
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          route_id: string
          postcode: string
          label?: string | null
          order_index?: number
          created_at?: string
        }
        Update: {
          postcode?: string
          label?: string | null
          order_index?: number
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          id: string
          name: string
          description: string | null
          link: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          link: string
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          link?: string
          active?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      driver_latest_locations: {
        Row: {
          driver_id: string
          driver_name: string
          driver_status: string
          lat: number
          lng: number
          heading: number | null
          speed: number | null
          recorded_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}
