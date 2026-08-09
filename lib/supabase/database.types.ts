export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      catalog_categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name_en: string;
          name_vi: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          name_en: string;
          name_vi: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          is_active?: boolean;
          name_en?: string;
          name_vi?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      catalog_option_sets: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      catalog_options: {
        Row: {
          created_at: string;
          extra_price_vnd: number;
          group_name: string;
          id: string;
          is_active: boolean;
          name_en: string;
          name_vi: string;
          option_set_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          extra_price_vnd?: number;
          group_name: string;
          id: string;
          is_active?: boolean;
          name_en: string;
          name_vi: string;
          option_set_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          extra_price_vnd?: number;
          group_name?: string;
          is_active?: boolean;
          name_en?: string;
          name_vi?: string;
          option_set_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_options_option_set_id_fkey';
            columns: ['option_set_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_option_sets';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          badge: string | null;
          category_id: string;
          created_at: string;
          description_en: string;
          description_vi: string;
          id: string;
          image_url: string;
          is_available: boolean;
          is_published: boolean;
          name_en: string;
          name_vi: string;
          option_set_id: string | null;
          price_vnd: number;
          sort_order: number;
          tasting_notes: string | null;
          updated_at: string;
        };
        Insert: {
          badge?: string | null;
          category_id: string;
          created_at?: string;
          description_en?: string;
          description_vi?: string;
          id: string;
          image_url: string;
          is_available?: boolean;
          is_published?: boolean;
          name_en: string;
          name_vi: string;
          option_set_id?: string | null;
          price_vnd: number;
          sort_order?: number;
          tasting_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          badge?: string | null;
          category_id?: string;
          description_en?: string;
          description_vi?: string;
          image_url?: string;
          is_available?: boolean;
          is_published?: boolean;
          name_en?: string;
          name_vi?: string;
          option_set_id?: string | null;
          price_vnd?: number;
          sort_order?: number;
          tasting_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_option_set_id_fkey';
            columns: ['option_set_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_option_sets';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          birthday: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          member_number: number;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          birthday?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          member_number?: never;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          birthday?: string | null;
          email?: string | null;
          full_name?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_booking_request: {
        Args: {
          p_consent_to_contact: boolean;
          p_customer_name: string;
          p_customer_phone: string;
          p_guest_count: number;
          p_idempotency_key: string;
          p_note: string | null;
          p_reservation_at: string;
          p_seating_area: string;
        };
        Returns: {
          booking_id: string;
          booking_number: number;
          booking_status: string;
          reservation_at: string;
        }[];
      };
      create_sepay_payment: {
        Args: {
          p_account_number: string;
          p_bank_code: string;
          p_order_id: string;
          p_receipt_token: string;
        };
        Returns: {
          amount_vnd: number;
          expires_at: string;
          payment_code: string;
          payment_id: string;
          payment_status: string;
        }[];
      };
      create_server_priced_order: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_delivery_address: string | null;
          p_fulfillment: Database['public']['Enums']['order_fulfillment'];
          p_idempotency_key: string;
          p_items: Json;
          p_note: string | null;
          p_payment_method: Database['public']['Enums']['order_payment_method'];
          p_pickup_at: string | null;
          p_voucher_code: string | null;
        };
        Returns: {
          discount_vnd: number;
          order_id: string;
          order_number: number;
          subtotal_vnd: number;
          total_vnd: number;
        }[];
      };
      get_order_receipt: {
        Args: {
          p_order_id: string;
          p_receipt_token: string;
        };
        Returns: Json;
      };
      issue_order_receipt: {
        Args: { p_idempotency_key: string };
        Returns: {
          order_id: string;
          receipt_token: string;
        }[];
      };
      process_sepay_webhook: {
        Args: {
          p_account_number: string;
          p_code: string | null;
          p_gateway: string;
          p_payload: Json;
          p_provider_transaction_id: number;
          p_reference_code: string;
          p_transaction_at: string;
          p_transfer_amount: number;
          p_transfer_type: string;
        };
        Returns: {
          matched_order_id: string | null;
          outcome: string;
        }[];
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['app_role'];
      };
    };
    Enums: {
      app_role: 'member' | 'staff' | 'admin';
      discount_type: 'percent' | 'fixed';
      order_fulfillment: 'pickup' | 'delivery';
      order_payment_method: 'sepay_qr' | 'cod';
      order_payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
      order_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type CatalogCategoryRow = Database['public']['Tables']['catalog_categories']['Row'];
export type CatalogOptionRow = Database['public']['Tables']['catalog_options']['Row'];
export type ProductRow = Database['public']['Tables']['products']['Row'];
