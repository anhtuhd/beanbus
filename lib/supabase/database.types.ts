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
