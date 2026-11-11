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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_name: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string
          tin_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          tin_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          tin_number?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_address: string
          delivery_status: string
          dispatch_date: string | null
          dispatched_by: string | null
          driver_or_service: string | null
          failure_reason: string | null
          id: string
          line_id: string | null
          notes: string | null
          order_id: string
          product_id: string | null
          quantity: number | null
          recipient_name: string
          recipient_phone: string
          request_key: string | null
          returned_at: string | null
          signed_by: string | null
          signed_reference: string | null
          source_location_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_address: string
          delivery_status?: string
          dispatch_date?: string | null
          dispatched_by?: string | null
          driver_or_service?: string | null
          failure_reason?: string | null
          id?: string
          line_id?: string | null
          notes?: string | null
          order_id: string
          product_id?: string | null
          quantity?: number | null
          recipient_name: string
          recipient_phone: string
          request_key?: string | null
          returned_at?: string | null
          signed_by?: string | null
          signed_reference?: string | null
          source_location_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_status?: string
          dispatch_date?: string | null
          dispatched_by?: string | null
          driver_or_service?: string | null
          failure_reason?: string | null
          id?: string
          line_id?: string | null
          notes?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number | null
          recipient_name?: string
          recipient_phone?: string
          request_key?: string | null
          returned_at?: string | null
          signed_by?: string | null
          signed_reference?: string | null
          source_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_evidence: {
        Row: {
          created_at: string
          delivery_id: string | null
          file_name: string
          id: string
          mime_type: string
          payment_id: string | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          file_name: string
          id?: string
          mime_type: string
          payment_id?: string | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          payment_id?: string | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_evidence_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_evidence_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exception_cases: {
        Row: {
          case_number: string
          case_type: Database["public"]["Enums"]["exception_type"]
          created_at: string
          customer_id: string | null
          disposition: Database["public"]["Enums"]["disposition_status"]
          id: string
          issue_description: string
          location_id: string
          order_id: string | null
          product_id: string
          quantity: number
          recorded_by: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          case_number: string
          case_type: Database["public"]["Enums"]["exception_type"]
          created_at?: string
          customer_id?: string | null
          disposition?: Database["public"]["Enums"]["disposition_status"]
          id?: string
          issue_description: string
          location_id: string
          order_id?: string | null
          product_id: string
          quantity: number
          recorded_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          case_number?: string
          case_type?: Database["public"]["Enums"]["exception_type"]
          created_at?: string
          customer_id?: string | null
          disposition?: Database["public"]["Enums"]["disposition_status"]
          id?: string
          issue_description?: string
          location_id?: string
          order_id?: string | null
          product_id?: string
          quantity?: number
          recorded_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exception_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_cases_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_cases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_cases_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_cases_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_customer_available: boolean
          name: string
          phone: string | null
          type: Database["public"]["Enums"]["location_type"]
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_customer_available?: boolean
          name: string
          phone?: string | null
          type: Database["public"]["Enums"]["location_type"]
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_customer_available?: boolean
          name?: string
          phone?: string | null
          type?: Database["public"]["Enums"]["location_type"]
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recorded_by: string
          reference_no: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recorded_by: string
          reference_no: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          order_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recorded_by?: string
          reference_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_batches: {
        Row: {
          batch_reference: string
          created_at: string
          failed_records: number
          id: string
          imported_by: string | null
          imported_records: number
          source_filename: string
          status: string
          total_records: number
        }
        Insert: {
          batch_reference: string
          created_at?: string
          failed_records?: number
          id?: string
          imported_by?: string | null
          imported_records?: number
          source_filename: string
          status?: string
          total_records?: number
        }
        Update: {
          batch_reference?: string
          created_at?: string
          failed_records?: number
          id?: string
          imported_by?: string | null
          imported_records?: number
          source_filename?: string
          status?: string
          total_records?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_errors: {
        Row: {
          batch_id: string
          created_at: string
          error_message: string
          id: string
          raw_data: Json
          row_number: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_message: string
          id?: string
          raw_data: Json
          row_number: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_message?: string
          id?: string
          raw_data?: Json
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_import_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          collection: string
          created_at: string
          description: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_active: boolean
          local_price: number | null
          materials: string | null
          name: string
          reference_price: number | null
          sku: string
          specifications: Json
          updated_at: string
        }
        Insert: {
          category?: string
          collection?: string
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          local_price?: number | null
          materials?: string | null
          name: string
          reference_price?: number | null
          sku: string
          specifications?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          collection?: string
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          local_price?: number | null
          materials?: string | null
          name?: string
          reference_price?: number | null
          sku?: string
          specifications?: Json
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          approved_by: string
          created_at: string
          id: string
          order_id: string
          payment_id: string
          reason: string
          reference_no: string | null
        }
        Insert: {
          amount: number
          approved_by: string
          created_at?: string
          id?: string
          order_id: string
          payment_id: string
          reason: string
          reference_no?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string
          created_at?: string
          id?: string
          order_id?: string
          payment_id?: string
          reason?: string
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          location_id: string
          order_id: string
          product_id: string
          quantity: number
          released_at: string | null
          released_by: string | null
          review_at: string | null
          status: Database["public"]["Enums"]["reservation_status"]
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          location_id: string
          order_id: string
          product_id: string
          quantity: number
          released_at?: string | null
          released_by?: string | null
          review_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          location_id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          released_at?: string | null
          released_by?: string | null
          review_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          id: string
          line_total: number | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total?: number | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          balance_due: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          id: string
          location_id: string
          notes: string | null
          order_number: string
          paid_amount: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          id?: string
          location_id: string
          notes?: string | null
          order_number: string
          paid_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          id?: string
          location_id?: string
          notes?: string | null
          order_number?: string
          paid_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          default_location_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_location_id?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_location_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_staff_default_location"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          active_reserved: number
          damaged_count: number
          location_id: string
          product_id: string
          quarantine_count: number
          sellable_on_hand: number
          updated_at: string
        }
        Insert: {
          active_reserved?: number
          damaged_count?: number
          location_id: string
          product_id: string
          quarantine_count?: number
          sellable_on_hand?: number
          updated_at?: string
        }
        Update: {
          active_reserved?: number
          damaged_count?: number
          location_id?: string
          product_id?: string
          quarantine_count?: number
          sellable_on_hand?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_lines: {
        Row: {
          count_id: string
          counted_quantity: number
          discrepancy_reason: string | null
          id: string
          product_id: string
          system_quantity: number
          variance: number | null
        }
        Insert: {
          count_id: string
          counted_quantity: number
          discrepancy_reason?: string | null
          id?: string
          product_id: string
          system_quantity: number
          variance?: number | null
        }
        Update: {
          count_id?: string
          counted_quantity?: number
          discrepancy_reason?: string | null
          id?: string
          product_id?: string
          system_quantity?: number
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          count_reference: string
          counted_by: string
          created_at: string
          id: string
          location_id: string
          notes: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          count_reference: string
          counted_by: string
          created_at?: string
          id?: string
          location_id: string
          notes?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          count_reference?: string
          counted_by?: string
          created_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          dest_location_id: string | null
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          product_id: string
          quantity: number
          reason: string
          reference_no: string
          source_location_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dest_location_id?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          product_id: string
          quantity: number
          reason: string
          reference_no: string
          source_location_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dest_location_id?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          product_id?: string
          quantity?: number
          reason?: string
          reference_no?: string
          source_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_dest_location_id_fkey"
            columns: ["dest_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_public_product_availability: {
        Row: {
          availability_status: string | null
          category: string | null
          collection: string | null
          dimensions: string | null
          image_url: string | null
          materials: string | null
          name: string | null
          sku: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      erp_apply_product_prices: {
        Args: { p_prices: Json; p_reason: string }
        Returns: number
      }
      erp_attach_evidence: {
        Args: {
          p_delivery_id: string
          p_file_name: string
          p_mime_type: string
          p_payment_id: string
          p_storage_path: string
        }
        Returns: string
      }
      erp_confirm_delivery: {
        Args: {
          p_delivery_id: string
          p_signed_by: string
          p_signed_reference: string
        }
        Returns: undefined
      }
      erp_create_draft_product: {
        Args: {
          p_category: string
          p_description?: string
          p_name: string
          p_sku: string
        }
        Returns: string
      }
      erp_create_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_notes?: string
          p_showroom_id: string
        }
        Returns: string
      }
      erp_create_product: {
        Args: {
          p_category: string
          p_description?: string
          p_local_price: number
          p_name: string
          p_sku: string
        }
        Returns: string
      }
      erp_create_reservation: {
        Args: {
          p_expires_at: string
          p_line_id: string
          p_location_id: string
          p_quantity: number
          p_review_at: string
        }
        Returns: string
      }
      erp_dispatch_line: {
        Args: {
          p_address: string
          p_line_id: string
          p_location_id: string
          p_phone: string
          p_quantity: number
          p_recipient: string
          p_request_key: string
        }
        Returns: string
      }
      erp_extend_reservation: {
        Args: {
          p_expires_at: string
          p_reason: string
          p_reservation_id: string
          p_review_at: string
        }
        Returns: undefined
      }
      erp_fail_delivery: {
        Args: { p_delivery_id: string; p_reason: string }
        Returns: undefined
      }
      erp_link_product_image: {
        Args: {
          p_product_id: string
          p_public_url: string
          p_storage_path: string
        }
        Returns: undefined
      }
      erp_post_opening_stock: {
        Args: { p_items: Json; p_reference: string }
        Returns: number
      }
      erp_post_receipt: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_reference: string
        }
        Returns: undefined
      }
      erp_post_transfer: {
        Args: {
          p_destination: string
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_reference: string
          p_source: string
        }
        Returns: undefined
      }
      erp_receive_failed_delivery: {
        Args: { p_delivery_id: string }
        Returns: undefined
      }
      erp_record_payment: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
          p_reference: string
        }
        Returns: string
      }
      erp_refund_cancel_order: {
        Args: { p_order_id: string; p_reason: string; p_reference: string }
        Returns: number
      }
      erp_release_expired_reservation: {
        Args: { p_reason: string; p_reservation_id: string }
        Returns: undefined
      }
      erp_review_product: {
        Args: {
          p_category: string
          p_description: string
          p_is_active: boolean
          p_local_price: number
          p_name: string
          p_product_id: string
          p_reason: string
        }
        Returns: undefined
      }
      erp_update_product_price: {
        Args: { p_local_price: number; p_product_id: string; p_reason: string }
        Returns: undefined
      }
      fn_create_reservation: {
        Args: {
          p_actor_id: string
          p_expires_hours: number
          p_location_id: string
          p_order_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: string
      }
      fn_ensure_stock_balance: {
        Args: { p_location_id: string; p_product_id: string }
        Returns: undefined
      }
      fn_fulfil_sales_order: {
        Args: { p_actor_id: string; p_order_id: string }
        Returns: undefined
      }
      fn_post_receipt: {
        Args: {
          p_actor_id: string
          p_location_id: string
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_reference: string
        }
        Returns: undefined
      }
      fn_post_transfer: {
        Args: {
          p_actor_id: string
          p_dest_location_id: string
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_reference: string
          p_source_location_id: string
        }
        Returns: undefined
      }
      fn_record_payment: {
        Args: {
          p_amount: number
          p_notes: string
          p_order_id: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_recorded_by: string
          p_reference: string
        }
        Returns: string
      }
      fn_record_stock_adjustment: {
        Args: {
          p_approved_by: string
          p_location_id: string
          p_new_quantity: number
          p_product_id: string
          p_reason: string
        }
        Returns: undefined
      }
      fn_release_reservation: {
        Args: { p_actor_id: string; p_reason: string; p_reservation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      disposition_status:
        | "pending_inspection"
        | "quarantined"
        | "restocked_sellable"
        | "written_off"
      exception_type: "return" | "damage" | "warranty"
      location_type: "warehouse" | "showroom"
      movement_type:
        | "receipt"
        | "transfer_out"
        | "transfer_in"
        | "reservation_hold"
        | "reservation_release"
        | "sale_fulfilment"
        | "count_adjustment"
        | "quarantine_damage"
        | "warranty_return"
        | "delivery_return_quarantine"
      order_status:
        | "draft"
        | "reserved"
        | "confirmed"
        | "partially_paid"
        | "paid"
        | "dispatched"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "partially_dispatched"
      payment_method:
        | "cash"
        | "telebirr"
        | "cbe_birr"
        | "bank_transfer"
        | "card"
      reservation_status: "active" | "fulfilled" | "cancelled" | "expired"
      staff_role:
        | "admin"
        | "manager"
        | "stock_clerk"
        | "showroom_sales"
        | "finance"
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
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      disposition_status: [
        "pending_inspection",
        "quarantined",
        "restocked_sellable",
        "written_off",
      ],
      exception_type: ["return", "damage", "warranty"],
      location_type: ["warehouse", "showroom"],
      movement_type: [
        "receipt",
        "transfer_out",
        "transfer_in",
        "reservation_hold",
        "reservation_release",
        "sale_fulfilment",
        "count_adjustment",
        "quarantine_damage",
        "warranty_return",
        "delivery_return_quarantine",
      ],
      order_status: [
        "draft",
        "reserved",
        "confirmed",
        "partially_paid",
        "paid",
        "dispatched",
        "delivered",
        "cancelled",
        "refunded",
        "partially_dispatched",
      ],
      payment_method: ["cash", "telebirr", "cbe_birr", "bank_transfer", "card"],
      reservation_status: ["active", "fulfilled", "cancelled", "expired"],
      staff_role: [
        "admin",
        "manager",
        "stock_clerk",
        "showroom_sales",
        "finance",
      ],
    },
  },
} as const
