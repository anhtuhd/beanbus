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
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['app_role'];
      };
    };
    Enums: {
      app_role: 'member' | 'staff' | 'admin';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type CatalogCategoryRow = Database['public']['Tables']['catalog_categories']['Row'];
export type CatalogOptionRow = Database['public']['Tables']['catalog_options']['Row'];
export type ProductRow = Database['public']['Tables']['products']['Row'];
