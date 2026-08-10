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
      booking_requests: {
        Row: {
          consent_to_contact: boolean;
          created_at: string;
          customer_name: string;
          customer_phone: string;
          guest_count: number;
          id: string;
          idempotency_key: string;
          note: string | null;
          notification_status: 'not_configured' | 'pending' | 'sent' | 'failed';
          reference_number: number;
          reservation_at: string;
          seating_area: 'indoor' | 'balcony' | 'roastery_bar';
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          consent_to_contact: boolean;
          created_at?: string;
          customer_name: string;
          customer_phone: string;
          guest_count: number;
          id?: string;
          idempotency_key: string;
          note?: string | null;
          notification_status?: 'not_configured' | 'pending' | 'sent' | 'failed';
          reference_number?: never;
          reservation_at: string;
          seating_area: 'indoor' | 'balcony' | 'roastery_bar';
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          notification_status?: 'not_configured' | 'pending' | 'sent' | 'failed';
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
          updated_at?: string;
        };
        Relationships: [];
      };
      booking_request_status_history: {
        Row: {
          actor_user_id: string;
          booking_request_id: string;
          created_at: string;
          from_status: string;
          id: number;
          to_status: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
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
      customer_requests: {
        Row: {
          consent_to_contact: boolean;
          contact_email: string | null;
          contact_name: string;
          contact_phone: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          message: string | null;
          notification_status: 'not_configured' | 'pending' | 'sent' | 'failed';
          organization: string | null;
          reference_number: number;
          request_type: 'contact' | 'rsvp' | 'b2b_quote';
          status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
          subject_reference: string | null;
          updated_at: string;
          user_id: string | null;
          volume_range: '10_30' | '30_100' | 'over_100' | null;
        };
        Insert: {
          consent_to_contact: boolean;
          contact_email?: string | null;
          contact_name: string;
          contact_phone: string;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          message?: string | null;
          notification_status?: 'not_configured' | 'pending' | 'sent' | 'failed';
          organization?: string | null;
          reference_number?: never;
          request_type: 'contact' | 'rsvp' | 'b2b_quote';
          status?: 'pending' | 'in_progress' | 'resolved' | 'rejected';
          subject_reference?: string | null;
          updated_at?: string;
          user_id?: string | null;
          volume_range?: '10_30' | '30_100' | 'over_100' | null;
        };
        Update: {
          notification_status?: 'not_configured' | 'pending' | 'sent' | 'failed';
          status?: 'pending' | 'in_progress' | 'resolved' | 'rejected';
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_request_status_history: {
        Row: {
          actor_user_id: string;
          created_at: string;
          customer_request_id: string;
          from_status: string;
          id: number;
          to_status: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      content_publication_history: {
        Row: {
          actor_user_id: string;
          content_id: string;
          content_type: 'event' | 'blog_post';
          created_at: string;
          from_is_published: boolean;
          id: number;
          to_is_published: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          description_en: string;
          description_vi: string;
          ends_at: string | null;
          id: string;
          image_url: string;
          is_featured: boolean;
          is_published: boolean;
          location: string;
          max_seats: number | null;
          published_at: string | null;
          slug: string;
          sort_order: number;
          starts_at: string;
          summary_en: string;
          summary_vi: string;
          time_label: string;
          title_en: string;
          title_vi: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
        Relationships: [];
      };
      blog_posts: {
        Row: {
          author: string;
          category_en: string;
          category_vi: string;
          content_en: string;
          content_vi: string;
          cover_image_url: string;
          created_at: string;
          excerpt_en: string;
          excerpt_vi: string;
          id: string;
          is_published: boolean;
          published_at: string | null;
          read_time_en: string;
          read_time_vi: string;
          slug: string;
          sort_order: number;
          title_en: string;
          title_vi: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['blog_posts']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['blog_posts']['Insert']>;
        Relationships: [];
      };
      order_items: {
        Row: {
          base_price_vnd: number;
          created_at: string;
          id: string;
          image_url: string;
          line_total_vnd: number;
          options_price_vnd: number;
          order_id: string;
          product_id: string;
          product_name_en: string;
          product_name_vi: string;
          quantity: number;
          special_note: string | null;
          unit_price_vnd: number;
        };
        Insert: {
          base_price_vnd: number;
          created_at?: string;
          id?: string;
          image_url: string;
          line_total_vnd: number;
          options_price_vnd?: number;
          order_id: string;
          product_id: string;
          product_name_en: string;
          product_name_vi: string;
          quantity: number;
          special_note?: string | null;
          unit_price_vnd: number;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
        Relationships: [];
      };
      orders: {
        Row: {
          created_at: string;
          customer_name: string;
          customer_phone: string;
          delivery_address: string | null;
          discount_vnd: number;
          fulfillment: Database['public']['Enums']['order_fulfillment'];
          id: string;
          idempotency_key: string;
          note: string | null;
          order_number: number;
          payment_method: Database['public']['Enums']['order_payment_method'];
          payment_status: Database['public']['Enums']['order_payment_status'];
          pickup_at: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_vnd: number;
          total_vnd: number;
          updated_at: string;
          user_id: string | null;
          voucher_code: string | null;
        };
        Insert: {
          created_at?: string;
          customer_name: string;
          customer_phone: string;
          delivery_address?: string | null;
          discount_vnd?: number;
          fulfillment: Database['public']['Enums']['order_fulfillment'];
          id?: string;
          idempotency_key: string;
          note?: string | null;
          order_number?: never;
          payment_method: Database['public']['Enums']['order_payment_method'];
          payment_status?: Database['public']['Enums']['order_payment_status'];
          pickup_at?: string | null;
          status?: Database['public']['Enums']['order_status'];
          subtotal_vnd?: number;
          total_vnd?: number;
          updated_at?: string;
          user_id?: string | null;
          voucher_code?: string | null;
        };
        Update: {
          payment_status?: Database['public']['Enums']['order_payment_status'];
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
        };
        Relationships: [];
      };
      order_status_history: {
        Row: {
          actor_type: 'admin' | 'system';
          actor_user_id: string | null;
          created_at: string;
          from_status: Database['public']['Enums']['order_status'];
          id: number;
          order_id: string;
          to_status: Database['public']['Enums']['order_status'];
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      member_role_history: {
        Row: {
          actor_user_id: string;
          created_at: string;
          from_role: Database['public']['Enums']['app_role'];
          id: number;
          to_role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      product_status_history: {
        Row: {
          actor_user_id: string;
          created_at: string;
          from_is_available: boolean;
          from_is_published: boolean;
          id: number;
          product_id: string;
          to_is_available: boolean;
          to_is_published: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
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
      vouchers: {
        Row: {
          code: string;
          created_at: string;
          discount_type: Database['public']['Enums']['discount_type'];
          discount_value: number;
          ends_at: string | null;
          is_active: boolean;
          maximum_discount_vnd: number | null;
          minimum_subtotal_vnd: number;
          starts_at: string | null;
          updated_at: string;
          usage_count: number;
          usage_limit: number | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          discount_type: Database['public']['Enums']['discount_type'];
          discount_value: number;
          ends_at?: string | null;
          is_active?: boolean;
          maximum_discount_vnd?: number | null;
          minimum_subtotal_vnd?: number;
          starts_at?: string | null;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
        };
        Update: Partial<Database['public']['Tables']['vouchers']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_customer_request: {
        Args: {
          p_consent_to_contact: boolean;
          p_contact_email: string | null;
          p_contact_name: string;
          p_contact_phone: string;
          p_idempotency_key: string;
          p_message: string | null;
          p_organization: string | null;
          p_request_type: string;
          p_subject_reference: string | null;
          p_volume_range: string | null;
        };
        Returns: {
          created_request_type: string;
          request_id: string;
          request_number: number;
          request_status: string;
        }[];
      };
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
      update_booking_request_status: {
        Args: {
          p_request_id: string;
          p_status: string;
        };
        Returns: {
          booking_id: string;
          booking_status: string;
        }[];
      };
      update_customer_request_status: {
        Args: {
          p_request_id: string;
          p_status: string;
        };
        Returns: {
          customer_request_id: string;
          customer_request_status: string;
        }[];
      };
      update_order_status: {
        Args: {
          p_order_id: string;
          p_status: Database['public']['Enums']['order_status'];
        };
        Returns: {
          updated_order_id: string;
          updated_order_status: Database['public']['Enums']['order_status'];
        }[];
      };
      update_member_role: {
        Args: {
          p_role: Database['public']['Enums']['app_role'];
          p_user_id: string;
        };
        Returns: {
          updated_role: Database['public']['Enums']['app_role'];
          updated_user_id: string;
        }[];
      };
      update_product_status: {
        Args: {
          p_is_available: boolean;
          p_is_published: boolean;
          p_product_id: string;
        };
        Returns: {
          updated_is_available: boolean;
          updated_is_published: boolean;
          updated_product_id: string;
        }[];
      };
      update_event_publication: {
        Args: { p_event_id: string; p_is_published: boolean };
        Returns: { updated_event_id: string; updated_is_published: boolean }[];
      };
      update_blog_post_publication: {
        Args: { p_post_id: string; p_is_published: boolean };
        Returns: { updated_post_id: string; updated_is_published: boolean }[];
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
