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
          name_en: string | null;
          name_vi: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          name: string;
          name_en?: string | null;
          name_vi?: string | null;
          updated_at?: string;
        };
        Update: {
          is_active?: boolean;
          name?: string;
          name_en?: string | null;
          name_vi?: string | null;
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
          is_default: boolean;
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
          is_default?: boolean;
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
          is_default?: boolean;
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
      catalog_menus: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name_en: string;
          name_vi: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          name_en: string;
          name_vi: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          is_active?: boolean;
          name_en?: string;
          name_vi?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      catalog_menu_schedules: {
        Row: {
          day_of_week: number;
          ends_at: string;
          id: number;
          menu_id: string;
          starts_at: string;
        };
        Insert: {
          day_of_week: number;
          ends_at: string;
          id?: never;
          menu_id: string;
          starts_at: string;
        };
        Update: {
          day_of_week?: number;
          ends_at?: string;
          menu_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_menu_schedules_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_menus';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_menu_sections: {
        Row: {
          category_id: string;
          id: string;
          menu_id: string;
          sort_order: number;
        };
        Insert: {
          category_id: string;
          id: string;
          menu_id: string;
          sort_order?: number;
        };
        Update: {
          category_id?: string;
          menu_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_menu_sections_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'catalog_menu_sections_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_menus';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_menu_items: {
        Row: {
          is_visible: boolean;
          product_id: string;
          section_id: string;
          sort_order: number;
        };
        Insert: {
          is_visible?: boolean;
          product_id: string;
          section_id: string;
          sort_order?: number;
        };
        Update: {
          is_visible?: boolean;
          product_id?: string;
          section_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_menu_items_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_menu_sections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'catalog_menu_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_option_groups: {
        Row: {
          allow_multiple: boolean;
          created_at: string;
          group_name: string;
          id: string;
          is_active: boolean;
          is_required: boolean;
          max_selections: number;
          min_selections: number;
          name_en: string;
          name_vi: string;
          option_set_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          allow_multiple?: boolean;
          created_at?: string;
          group_name: string;
          id: string;
          is_active?: boolean;
          is_required?: boolean;
          max_selections?: number;
          min_selections?: number;
          name_en: string;
          name_vi: string;
          option_set_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          allow_multiple?: boolean;
          group_name?: string;
          is_active?: boolean;
          is_required?: boolean;
          max_selections?: number;
          min_selections?: number;
          name_en?: string;
          name_vi?: string;
          option_set_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalog_option_groups_option_set_id_fkey';
            columns: ['option_set_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_option_sets';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_releases: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          lock_version: number;
          published_at: string | null;
          published_by: string | null;
          snapshot: Json;
          status: 'draft' | 'published' | 'archived';
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lock_version?: number;
          published_at?: string | null;
          published_by?: string | null;
          snapshot: Json;
          status: 'draft' | 'published' | 'archived';
          updated_at?: string;
          updated_by?: string | null;
          version: number;
        };
        Update: {
          lock_version?: number;
          published_at?: string | null;
          published_by?: string | null;
          snapshot?: Json;
          status?: 'draft' | 'published' | 'archived';
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      catalog_publication_history: {
        Row: {
          actor_user_id: string;
          created_at: string;
          id: number;
          release_id: string;
          version: number;
        };
        Insert: {
          actor_user_id: string;
          created_at?: string;
          id?: never;
          release_id: string;
          version: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'catalog_publication_history_release_id_fkey';
            columns: ['release_id'];
            isOneToOne: false;
            referencedRelation: 'catalog_releases';
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
          status: 'pending' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled';
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
          status?: 'pending' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled';
          subject_reference?: string | null;
          updated_at?: string;
          user_id?: string | null;
          volume_range?: '10_30' | '30_100' | 'over_100' | null;
        };
        Update: {
          notification_status?: 'not_configured' | 'pending' | 'sent' | 'failed';
          status?: 'pending' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled';
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
      commerce_policy: {
        Row: {
          id: boolean;
          loyalty_reverse_on_cancel: boolean;
          loyalty_reverse_on_refund: boolean;
          refund_enabled: boolean;
          refund_window_hours: number;
          updated_at: string;
          updated_by: string | null;
          voucher_on_cancel: 'release' | 'consume';
          voucher_on_refund: 'release' | 'consume';
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      commerce_policy_history: {
        Row: {
          actor_user_id: string;
          created_at: string;
          id: number;
          loyalty_reverse_on_cancel: boolean;
          loyalty_reverse_on_refund: boolean;
          refund_enabled: boolean;
          refund_window_hours: number;
          voucher_on_cancel: 'release' | 'consume';
          voucher_on_refund: 'release' | 'consume';
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      order_refund_history: {
        Row: {
          actor_user_id: string;
          amount_vnd: number;
          created_at: string;
          id: number;
          order_id: string;
          payment_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sepay_reconciliation_events: {
        Row: {
          payment_id: string | null;
          payload: Json;
          processed_at: string | null;
          provider_transaction_key: string;
          reason: string | null;
          received_at: string;
          status: 'received' | 'processed' | 'rejected';
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sepay_reconciliation_state: {
        Row: {
          cursor_at: string | null;
          cursor_key: string | null;
          id: boolean;
          lease_key: string | null;
          lease_until: string | null;
          updated_at: string;
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
      content_change_history: {
        Row: {
          actor_user_id: string;
          after_data: Json;
          before_data: Json | null;
          content_id: string;
          content_type: 'event' | 'blog_post';
          created_at: string;
          id: number;
          operation: 'created' | 'updated';
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      loyalty_ledger: {
        Row: {
          actor_user_id: string | null;
          amount_vnd: number;
          created_at: string;
          id: string;
          note: string | null;
          order_id: string | null;
          points: number;
          source_key: string;
          source_type: 'order_earned' | 'order_reversal' | 'redemption' | 'manual_adjustment' | 'topup_credited' | 'flash_sale_credited' | 'order_payment_debit' | 'order_payment_refund';
          voucher_code: string | null;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      loyalty_policy: {
        Row: {
          cod_eligible: boolean;
          earn_bps: number;
          enabled: boolean;
          id: boolean;
          points_payment_enabled: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      stored_value_policy: {
        Row: {
          enabled: boolean;
          flash_sale_enabled: boolean;
          id: boolean;
          topup_enabled: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      topup_packages: {
        Row: {
          amount_vnd: number;
          created_at: string;
          id: string;
          is_active: boolean;
          name_en: string;
          name_vi: string;
          points: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      flash_sale_campaigns: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          is_active: boolean;
          max_per_user: number | null;
          name_en: string;
          name_vi: string;
          points: number;
          price_vnd: number;
          quota_reserved: number;
          quota_sold: number;
          quota_total: number | null;
          slug: string;
          starts_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      wallet_topups: {
        Row: {
          amount_vnd: number;
          created_at: string;
          expires_at: string;
          id: string;
          idempotency_key: string;
          package_id: string;
          paid_at: string | null;
          points: number;
          status: 'pending' | 'paid' | 'failed' | 'expired';
          updated_at: string;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      flash_sale_purchases: {
        Row: {
          amount_vnd: number;
          campaign_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          idempotency_key: string;
          paid_at: string | null;
          points: number;
          reservation_released: boolean;
          status: 'pending' | 'paid' | 'failed' | 'expired';
          updated_at: string;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      stored_value_payments: {
        Row: {
          account_number: string;
          amount_vnd: number;
          bank_code: string;
          created_at: string;
          expires_at: string;
          flash_sale_purchase_id: string | null;
          id: string;
          paid_at: string | null;
          payment_code: string;
          provider: 'sepay';
          provider_reference: string | null;
          provider_transaction_id: number | null;
          status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
          topup_id: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      stored_value_policy_history: {
        Row: {
          actor_user_id: string;
          created_at: string;
          enabled: boolean;
          flash_sale_enabled: boolean;
          id: number;
          topup_enabled: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      loyalty_policy_history: {
        Row: {
          actor_user_id: string;
          cod_eligible: boolean;
          created_at: string;
          earn_bps: number;
          enabled: boolean;
          id: number;
          points_payment_enabled: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      loyalty_rewards: {
        Row: {
          created_at: string;
          discount_type: Database['public']['Enums']['discount_type'];
          discount_value: number;
          id: string;
          is_active: boolean;
          maximum_discount_vnd: number | null;
          minimum_subtotal_vnd: number;
          name_en: string;
          name_vi: string;
          points_cost: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      loyalty_reward_change_history: {
        Row: {
          actor_user_id: string;
          after_data: Json;
          before_data: Json | null;
          created_at: string;
          id: number;
          operation: 'created' | 'updated';
          reward_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      voucher_change_history: {
        Row: {
          actor_user_id: string;
          after_data: Json;
          before_data: Json | null;
          created_at: string;
          id: number;
          operation: 'created' | 'updated';
          voucher_code: string;
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
      order_item_options: {
        Row: {
          extra_price_vnd: number;
          option_id: string;
          option_name_en: string;
          option_name_vi: string;
          order_item_id: string;
        };
        Insert: {
          extra_price_vnd: number;
          option_id: string;
          option_name_en: string;
          option_name_vi: string;
          order_item_id: string;
        };
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: {
          account_number: string;
          amount_vnd: number;
          bank_code: string;
          created_at: string;
          expires_at: string;
          id: string;
          order_id: string;
          paid_at: string | null;
          payment_code: string;
          provider: 'sepay';
          provider_payload: Json | null;
          provider_reference: string | null;
          provider_transaction_id: number | null;
          status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      product_change_history: {
        Row: {
          actor_user_id: string;
          after_data: Json;
          before_data: Json | null;
          created_at: string;
          id: number;
          operation: 'created' | 'updated';
          product_id: string;
        };
        Insert: never;
        Update: never;
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
          order_code: string;
          order_number: number;
          points_applied: number;
          payment_method: Database['public']['Enums']['order_payment_method'];
          payment_status: Database['public']['Enums']['order_payment_status'];
          pickup_at: string | null;
          receipt_token: string;
          status: Database['public']['Enums']['order_status'];
          subtotal_vnd: number;
          total_vnd: number;
          cash_due_vnd: number;
          request_fingerprint: string | null;
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
          points_applied?: number;
          cash_due_vnd?: number;
          request_fingerprint?: string | null;
          fulfillment: Database['public']['Enums']['order_fulfillment'];
          id?: string;
          idempotency_key: string;
          note?: string | null;
          order_code?: never;
          order_number?: never;
          payment_method: Database['public']['Enums']['order_payment_method'];
          payment_status?: Database['public']['Enums']['order_payment_status'];
          pickup_at?: string | null;
          receipt_token?: string;
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
          assigned_user_id: string | null;
          usage_count: number;
          usage_limit: number | null;
        };
        Insert: {
          code: string;
          assigned_user_id?: string | null;
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
      voucher_reservations: {
        Row: {
          consumed_at: string | null;
          order_id: string;
          released_at: string | null;
          reserved_at: string;
          status: 'reserved' | 'consumed' | 'released';
          updated_at: string;
          voucher_code: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          body_en: string;
          body_vi: string;
          created_at: string;
          dedupe_key: string;
          href: string | null;
          id: string;
          kind: 'order_created' | 'order_status_changed' | 'order_payment_changed' | 'event_published' | 'store_announcement' | 'booking_request_created' | 'booking_request_status_changed' | 'customer_request_created' | 'customer_request_status_changed' | 'points_adjusted';
          read_at: string | null;
          recipient_user_id: string;
          source_id: string;
          source_type: 'order' | 'event' | 'store_announcement' | 'booking_request' | 'customer_request' | 'loyalty';
          title_en: string;
          title_vi: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email_event_updates: boolean;
          email_order_updates: boolean;
          email_store_updates: boolean;
          push_event_updates: boolean;
          push_order_updates: boolean;
          push_request_updates: boolean;
          push_store_updates: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      store_announcements: {
        Row: {
          body_en: string;
          body_vi: string;
          created_at: string;
          created_by: string;
          href: string | null;
          id: string;
          send_email: boolean;
          title_en: string;
          title_vi: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      email_outbox: {
        Row: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          id: string;
          last_error_code: string | null;
          locked_by: string | null;
          locked_until: string | null;
          notification_id: string;
          provider_message_id: string | null;
          recipient_email: string;
          recipient_user_id: string;
          status: 'pending' | 'processing' | 'accepted' | 'delivered' | 'failed' | 'cancelled';
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      email_delivery_events: {
        Row: {
          created_at: string;
          event_type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.complained';
          id: string;
          occurred_at: string;
          provider_event_id: string;
          provider_message_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      email_suppressions: {
        Row: { created_at: string; email: string; reason: 'bounced' | 'complained' };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      guest_notification_sessions: {
        Row: { created_at: string; expires_at: string; id: string; last_seen_at: string };
        Insert: { id: string; created_at?: string; expires_at?: string; last_seen_at?: string };
        Update: Partial<Database['public']['Tables']['guest_notification_sessions']['Insert']>;
        Relationships: [];
      };
      guest_order_access: {
        Row: { created_at: string; guest_session_id: string; order_id: string };
        Insert: { created_at?: string; guest_session_id: string; order_id: string };
        Update: never;
        Relationships: [];
      };
      guest_notifications: {
        Row: {
          body_en: string;
          body_vi: string;
          created_at: string;
          dedupe_key: string;
          guest_session_id: string;
          href: string;
          id: string;
          kind: 'order_created' | 'order_status_changed' | 'order_payment_changed';
          order_id: string;
          read_at: string | null;
          title_en: string;
          title_vi: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      fcm_installations: {
        Row: {
          active: boolean;
          created_at: string;
          fid: string;
          id: string;
          last_seen_at: string;
          locale: 'vi' | 'en';
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      fcm_installation_recipients: {
        Row: {
          created_at: string;
          guest_session_id: string | null;
          id: string;
          installation_id: string;
          user_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      push_outbox: {
        Row: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          guest_notification_id: string | null;
          id: string;
          installation_id: string;
          last_error_code: string | null;
          locked_by: string | null;
          locked_until: string | null;
          notification_id: string | null;
          payload: Json;
          provider_message_id: string | null;
          status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      admin_request_feed: {
        Row: {
          contact_email: string | null;
          created_at: string;
          display_name: string;
          display_phone: string;
          guest_count: number | null;
          id: string;
          kind: 'booking' | 'customer';
          message: string | null;
          note: string | null;
          organization: string | null;
          reference_number: number;
          request_type: string;
          reservation_at: string | null;
          seating_area: string | null;
          status: string;
          subject_reference: string | null;
          volume_range: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_current_profile: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['profiles']['Row'][];
      };
      save_catalog_draft: {
        Args: {
          p_expected_lock_version: number;
          p_snapshot: Json;
        };
        Returns: {
          lock_version: number;
          release_id: string;
        }[];
      };
      publish_catalog_draft: {
        Args: {
          p_expected_lock_version: number;
        };
        Returns: {
          draft_lock_version: number;
          published_version: number;
        }[];
      };
      product_is_orderable: {
        Args: {
          p_product_id: string;
        };
        Returns: boolean;
      };
      cancel_owned_booking_request: {
        Args: {
          p_request_id: string;
        };
        Returns: {
          booking_id: string;
          booking_status: string;
        }[];
      };
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
      create_server_priced_order_v2: {
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
          p_points_to_apply: number;
          p_voucher_code: string | null;
        };
        Returns: {
          cash_due_vnd: number;
          discount_vnd: number;
          order_id: string;
          order_number: number;
          points_applied: number;
          receipt_token: string;
          request_fingerprint: string;
          subtotal_vnd: number;
          total_vnd: number;
        }[];
      };
      get_points_payment_policy: {
        Args: Record<string, never>;
        Returns: { enabled: boolean }[];
      };
      update_points_payment_policy: {
        Args: { p_enabled: boolean };
        Returns: { updated_enabled: boolean }[];
      };
      get_member_loyalty_summary_v2: {
        Args: { p_user_id: string };
        Returns: {
          available_points: number;
          balance_points: number;
          debt_points: number;
          earned_points: number;
          policy_enabled: boolean;
          points_payment_enabled: boolean;
          spent_points: number;
          topup_points: number;
          total_spent_vnd: number;
        }[];
      };
      get_admin_member_point_balances: {
        Args: { p_user_ids: string[] };
        Returns: {
          available_points: number;
          balance_points: number;
          debt_points: number;
          earned_points: number;
          spent_points: number;
          topup_points: number;
          user_id: string;
        }[];
      };
      admin_adjust_member_points: {
        Args: { p_delta: number; p_idempotency_key: string; p_reason: string; p_user_id: string };
        Returns: { adjusted_user_id: string; applied_delta: number; available_points: number; balance_points: number; debt_points: number }[];
      };
      compensate_order_payment_failure: {
        Args: { p_order_id: string };
        Returns: boolean;
      };
      refund_order_settlement: {
        Args: { p_order_id: string };
        Returns: { cash_refunded_vnd: number; points_restored: number; refunded_order_id: string }[];
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
      cancel_owned_customer_request: {
        Args: {
          p_request_id: string;
        };
        Returns: {
          request_id: string;
          request_status: string;
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
      get_commerce_policy: {
        Args: Record<string, never>;
        Returns: {
          loyalty_reverse_on_cancel: boolean;
          loyalty_reverse_on_refund: boolean;
          refund_enabled: boolean;
          refund_window_hours: number;
          updated_at: string;
          voucher_on_cancel: 'release' | 'consume';
          voucher_on_refund: 'release' | 'consume';
        }[];
      };
      update_commerce_policy: {
        Args: {
          p_loyalty_reverse_on_cancel: boolean;
          p_loyalty_reverse_on_refund: boolean;
          p_refund_enabled: boolean;
          p_refund_window_hours: number;
          p_voucher_on_cancel: 'release' | 'consume';
          p_voucher_on_refund: 'release' | 'consume';
        };
        Returns: {
          updated_loyalty_reverse_on_cancel: boolean;
          updated_loyalty_reverse_on_refund: boolean;
          updated_refund_enabled: boolean;
          updated_refund_window_hours: number;
          updated_voucher_on_cancel: 'release' | 'consume';
          updated_voucher_on_refund: 'release' | 'consume';
        }[];
      };
      refund_order_payment: {
        Args: { p_order_id: string };
        Returns: { refunded_amount_vnd: number; refunded_order_id: string }[];
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
      admin_upsert_product: {
        Args: {
          p_badge: string | null;
          p_category_id: string;
          p_description_en: string;
          p_description_vi: string;
          p_image_url: string;
          p_is_available: boolean;
          p_is_published: boolean;
          p_name_en: string;
          p_name_vi: string;
          p_option_set_id: string | null;
          p_price_vnd: number;
          p_product_id: string | null;
          p_sort_order: number;
          p_tasting_notes: string | null;
        };
        Returns: { operation: 'created' | 'updated'; updated_product_id: string }[];
      };
      admin_archive_product: {
        Args: { p_product_id: string };
        Returns: { archived: boolean; archived_product_id: string }[];
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
      admin_upsert_event: {
        Args: {
          p_description_en: string;
          p_description_vi: string;
          p_ends_at: string | null;
          p_event_id: string | null;
          p_image_url: string;
          p_is_featured: boolean;
          p_is_published: boolean;
          p_location: string;
          p_max_seats: number | null;
          p_slug: string;
          p_sort_order: number;
          p_starts_at: string;
          p_summary_en: string;
          p_summary_vi: string;
          p_time_label: string;
          p_title_en: string;
          p_title_vi: string;
        };
        Returns: { operation: 'created' | 'updated'; updated_event_id: string }[];
      };
      admin_upsert_blog_post: {
        Args: {
          p_author: string;
          p_category_en: string;
          p_category_vi: string;
          p_content_en: string;
          p_content_vi: string;
          p_cover_image_url: string;
          p_excerpt_en: string;
          p_excerpt_vi: string;
          p_is_published: boolean;
          p_post_id: string | null;
          p_read_time_en: string;
          p_read_time_vi: string;
          p_slug: string;
          p_sort_order: number;
          p_title_en: string;
          p_title_vi: string;
        };
        Returns: { operation: 'created' | 'updated'; updated_post_id: string }[];
      };
      get_member_loyalty_summary: {
        Args: { p_user_id: string };
        Returns: {
          balance_points: number;
          earned_points: number;
          policy_enabled: boolean;
          redeemed_points: number;
          total_spent_vnd: number;
        }[];
      };
      get_member_requests: {
        Args: { p_page: number; p_page_size: number; p_user_id: string };
        Returns: {
          created_at: string;
          id: string;
          kind: string;
          notification_status: string;
          reference_number: number;
          request_type: string;
          reservation_at: string | null;
          status: string;
          subject_reference: string | null;
          total_count: number;
        }[];
      };
      get_member_request_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      update_loyalty_policy: {
        Args: { p_cod_eligible: boolean; p_earn_bps: number; p_enabled: boolean };
        Returns: { updated_cod_eligible: boolean; updated_earn_bps: number; updated_enabled: boolean }[];
      };
      get_loyalty_policy: {
        Args: Record<string, never>;
        Returns: { cod_eligible: boolean; earn_bps: number; enabled: boolean; updated_at: string }[];
      };
      admin_upsert_voucher: {
        Args: {
          p_code: string;
          p_discount_type: Database['public']['Enums']['discount_type'];
          p_discount_value: number;
          p_ends_at: string | null;
          p_is_active: boolean;
          p_maximum_discount_vnd: number | null;
          p_minimum_subtotal_vnd: number;
          p_starts_at: string | null;
          p_usage_limit: number | null;
        };
        Returns: { operation: 'created' | 'updated'; updated_voucher_code: string }[];
      };
      admin_upsert_loyalty_reward: {
        Args: {
          p_discount_type: Database['public']['Enums']['discount_type'];
          p_discount_value: number;
          p_is_active: boolean;
          p_maximum_discount_vnd: number | null;
          p_minimum_subtotal_vnd: number;
          p_name_en: string;
          p_name_vi: string;
          p_points_cost: number;
          p_reward_id: string;
        };
        Returns: { operation: 'created' | 'updated'; updated_reward_id: string }[];
      };
      redeem_loyalty_reward: {
        Args: { p_idempotency_key: string; p_reward_id: string };
        Returns: { points_spent: number; voucher_code: string }[];
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
      process_sepay_reconciliation: {
        Args: {
          p_account_number: string;
          p_code: string;
          p_content: string;
          p_gateway: string;
          p_payload: Json;
          p_provider_transaction_key: string;
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
      acquire_sepay_reconciliation_lease: {
        Args: { p_lease_key: string };
        Returns: boolean;
      };
      complete_sepay_reconciliation: {
        Args: { p_cursor_at: string; p_cursor_key: string; p_lease_key: string };
        Returns: undefined;
      };
      release_sepay_reconciliation_lease: {
        Args: { p_lease_key: string };
        Returns: undefined;
      };
      expire_pending_sepay_payments: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_stored_value_catalog: {
        Args: Record<string, never>;
        Returns: {
          amount_vnd: number;
          ends_at: string | null;
          item_id: string;
          kind: 'topup' | 'flash_sale';
          max_per_user: number | null;
          name_en: string;
          name_vi: string;
          points: number;
          remaining_quantity: number | null;
          starts_at: string | null;
        }[];
      };
      create_topup_intent: {
        Args: { p_idempotency_key: string; p_package_id: string };
        Returns: {
          amount_vnd: number;
          expires_at: string;
          points: number;
          purchase_id: string;
          purchase_status: string;
        }[];
      };
      create_flash_sale_intent: {
        Args: { p_campaign_id: string; p_idempotency_key: string };
        Returns: {
          amount_vnd: number;
          expires_at: string;
          points: number;
          purchase_id: string;
          purchase_status: string;
        }[];
      };
      create_stored_value_payment: {
        Args: {
          p_account_number: string;
          p_bank_code: string;
          p_purchase_id: string;
          p_purchase_type: 'topup' | 'flash_sale';
        };
        Returns: {
          amount_vnd: number;
          expires_at: string;
          payment_code: string;
          payment_id: string;
          payment_status: string;
        }[];
      };
      get_stored_value_purchase: {
        Args: { p_purchase_id: string };
        Returns: {
          amount_vnd: number;
          expires_at: string;
          paid_at: string | null;
          payment_code: string | null;
          payment_status: string | null;
          points: number;
          purchase_id: string;
          purchase_status: string;
          purchase_type: 'topup' | 'flash_sale';
        }[];
      };
      get_member_payment_history: {
        Args: { p_page?: number; p_page_size?: number };
        Returns: {
          amount_vnd: number;
          created_at: string;
          expires_at: string;
          paid_at: string | null;
          payment_code: string | null;
          payment_method: string;
          points: number;
          reference_code: string;
          reference_id: string;
          source_type: string;
          status: string;
          total_count: number;
        }[];
      };
      process_stored_value_webhook: {
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
        Returns: { matched_purchase_id: string | null; outcome: string }[];
      };
      get_stored_value_policy: {
        Args: Record<string, never>;
        Returns: { enabled: boolean; flash_sale_enabled: boolean; topup_enabled: boolean; updated_at: string }[];
      };
      get_admin_stored_value_catalog: {
        Args: Record<string, never>;
        Returns: Json;
      };
      update_stored_value_policy: {
        Args: { p_enabled: boolean; p_flash_sale_enabled: boolean; p_topup_enabled: boolean };
        Returns: { updated_enabled: boolean; updated_flash_sale_enabled: boolean; updated_topup_enabled: boolean }[];
      };
      admin_upsert_topup_package: {
        Args: {
          p_amount_vnd: number;
          p_is_active: boolean;
          p_name_en: string;
          p_name_vi: string;
          p_package_id: string | null;
          p_points: number;
          p_sort_order: number;
        };
        Returns: { operation: 'created' | 'updated'; updated_package_id: string }[];
      };
      admin_upsert_flash_sale_campaign: {
        Args: {
          p_campaign_id: string | null;
          p_ends_at: string;
          p_is_active: boolean;
          p_max_per_user: number | null;
          p_name_en: string;
          p_name_vi: string;
          p_points: number;
          p_price_vnd: number;
          p_quota_total: number | null;
          p_slug: string;
          p_starts_at: string;
        };
        Returns: { operation: 'created' | 'updated'; updated_campaign_id: string }[];
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['app_role'];
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: boolean;
      };
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      enqueue_role_notifications: {
        Args: {
          p_body_en: string;
          p_body_vi: string;
          p_dedupe_key: string;
          p_email_category: string;
          p_email_enabled?: boolean;
          p_href: string | null;
          p_kind: string;
          p_recipient_role: string;
          p_source_id: string;
          p_source_type: string;
          p_title_en: string;
          p_title_vi: string;
        };
        Returns: number;
      };
      update_notification_preferences: {
        Args: {
          p_email_event_updates: boolean;
          p_email_order_updates: boolean;
          p_email_store_updates: boolean;
        };
        Returns: Database['public']['Tables']['notification_preferences']['Row'];
      };
      update_push_notification_preferences: {
        Args: {
          p_push_event_updates: boolean;
          p_push_order_updates: boolean;
          p_push_request_updates: boolean;
          p_push_store_updates: boolean;
        };
        Returns: Database['public']['Tables']['notification_preferences']['Row'];
      };
      link_guest_order_notifications: {
        Args: { p_guest_session_id: string; p_order_id: string };
        Returns: boolean;
      };
      register_fcm_installation: {
        Args: { p_fid: string; p_guest_session_id: string | null; p_locale: string; p_user_id: string | null };
        Returns: string;
      };
      unlink_fcm_installation: {
        Args: { p_disable?: boolean; p_fid: string; p_guest_session_id: string | null; p_user_id: string | null };
        Returns: boolean;
      };
      unlink_user_fcm_installations: {
        Args: { p_user_id: string };
        Returns: number;
      };
      mark_guest_notifications_read: {
        Args: { p_guest_session_id: string; p_notification_id?: string | null };
        Returns: number;
      };
      claim_push_notification_batch: {
        Args: { p_allowed_fids?: string[] | null; p_limit: number; p_worker_id: string };
        Returns: {
          attempt_count: number;
          fid: string;
          installation_id: string;
          outbox_id: string;
          payload: Json;
        }[];
      };
      complete_push_notification: {
        Args: { p_outbox_id: string; p_provider_message_id: string };
        Returns: boolean;
      };
      fail_push_notification: {
        Args: { p_error_code: string; p_outbox_id: string; p_retryable: boolean };
        Returns: boolean;
      };
      publish_store_announcement: {
        Args: {
          p_body_en: string;
          p_body_vi: string;
          p_href: string | null;
          p_send_email: boolean;
          p_title_en: string;
          p_title_vi: string;
        };
        Returns: string;
      };
      get_admin_notification_summary: {
        Args: Record<PropertyKey, never>;
        Returns: { failed_email_count: number; unread_count: number }[];
      };
      get_admin_notification_failures: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          attempt_count: number;
          id: string;
          last_error_code: string | null;
          notification_id: string;
          recipient_email: string;
          updated_at: string;
        }[];
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
