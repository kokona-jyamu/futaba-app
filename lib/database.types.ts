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
      attendances: {
        Row: {
          arrival_time: string | null
          child_id: string
          created_at: string
          id: string
          needs_lunch: boolean
          reason: string | null
          reason_type: string | null
          reported_by: string | null
          school_id: string
          status: string
          symptoms: string | null
          target_date: string
          temperature: number | null
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          child_id: string
          created_at?: string
          id?: string
          needs_lunch?: boolean
          reason?: string | null
          reason_type?: string | null
          reported_by?: string | null
          school_id: string
          status: string
          symptoms?: string | null
          target_date: string
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          child_id?: string
          created_at?: string
          id?: string
          needs_lunch?: boolean
          reason?: string | null
          reason_type?: string | null
          reported_by?: string | null
          school_id?: string
          status?: string
          symptoms?: string | null
          target_date?: string
          temperature?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["guardian_id"]
          },
          {
            foreignKeyName: "attendances_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      child_classes: {
        Row: {
          child_id: string
          class_id: string
          created_at: string
          id: string
          start_date: string
        }
        Insert: {
          child_id: string
          class_id: string
          created_at?: string
          id?: string
          start_date: string
        }
        Update: {
          child_id?: string
          class_id?: string
          created_at?: string
          id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_classes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_classes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      child_meal_types: {
        Row: {
          child_id: string
          created_at: string
          id: string
          meal_type_id: string
          start_date: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          meal_type_id: string
          start_date: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          meal_type_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_meal_types_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_meal_types_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_meal_types_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "meal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          allergens: Json
          allergens_confirmed: Json
          allergens_confirmed_at: string | null
          allergens_confirmed_by: string | null
          allergens_updated_at: string | null
          allergens_updated_by: string | null
          allergens_updated_by_role: string | null
          class_name: string | null
          created_at: string
          graduated_at: string | null
          id: string
          is_active: boolean
          login_no: string
          name: string
          school_id: string
        }
        Insert: {
          allergens?: Json
          allergens_confirmed?: Json
          allergens_confirmed_at?: string | null
          allergens_confirmed_by?: string | null
          allergens_updated_at?: string | null
          allergens_updated_by?: string | null
          allergens_updated_by_role?: string | null
          class_name?: string | null
          created_at?: string
          graduated_at?: string | null
          id?: string
          is_active?: boolean
          login_no: string
          name: string
          school_id: string
        }
        Update: {
          allergens?: Json
          allergens_confirmed?: Json
          allergens_confirmed_at?: string | null
          allergens_confirmed_by?: string | null
          allergens_updated_at?: string | null
          allergens_updated_by?: string | null
          allergens_updated_by_role?: string | null
          class_name?: string | null
          created_at?: string
          graduated_at?: string | null
          id?: string
          is_active?: boolean
          login_no?: string
          name?: string
          school_id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_likes: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          liked_by: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          liked_by: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          liked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "food_education_events"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          guardian_id: string
          menu_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          menu_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          menu_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["guardian_id"]
          },
          {
            foreignKeyName: "favorites_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      food_education_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          id: string
          photo_url: string | null
          recipe_ingredients: string[] | null
          recipe_steps: string | null
          recipe_title: string | null
          school_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          id?: string
          photo_url?: string | null
          recipe_ingredients?: string[] | null
          recipe_steps?: string | null
          recipe_title?: string | null
          school_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          id?: string
          photo_url?: string | null
          recipe_ingredients?: string[] | null
          recipe_steps?: string | null
          recipe_title?: string | null
          school_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_education_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          child_id: string
          created_at: string
          display_name: string | null
          id: string
          last_seen_at: string | null
          school_id: string
          settings: Json
        }
        Insert: {
          child_id: string
          created_at?: string
          display_name?: string | null
          id: string
          last_seen_at?: string | null
          school_id: string
          settings?: Json
        }
        Update: {
          child_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
          school_id?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "guardians_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_baby: boolean
          name: string
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_baby?: boolean
          name: string
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_baby?: boolean
          name?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      menus: {
        Row: {
          allergen_checked: boolean
          allergens: Json | null
          calcium: number | null
          carb: number | null
          created_at: string | null
          dish_photos: Json
          fat: number | null
          id: string
          ingredients: string[] | null
          is_published: boolean
          kcal: number | null
          nutritionist_comment: string | null
          photo_url: string | null
          posted_by: string | null
          protein: number | null
          salt: number | null
          school_id: string | null
          served_date: string
          title: string | null
          tray_photo_url: string | null
          why_eat_note: string | null
        }
        Insert: {
          allergen_checked?: boolean
          allergens?: Json | null
          calcium?: number | null
          carb?: number | null
          created_at?: string | null
          dish_photos?: Json
          fat?: number | null
          id?: string
          ingredients?: string[] | null
          is_published?: boolean
          kcal?: number | null
          nutritionist_comment?: string | null
          photo_url?: string | null
          posted_by?: string | null
          protein?: number | null
          salt?: number | null
          school_id?: string | null
          served_date: string
          title?: string | null
          tray_photo_url?: string | null
          why_eat_note?: string | null
        }
        Update: {
          allergen_checked?: boolean
          allergens?: Json | null
          calcium?: number | null
          carb?: number | null
          created_at?: string | null
          dish_photos?: Json
          fat?: number | null
          id?: string
          ingredients?: string[] | null
          is_published?: boolean
          kcal?: number | null
          nutritionist_comment?: string | null
          photo_url?: string | null
          posted_by?: string | null
          protein?: number | null
          salt?: number | null
          school_id?: string | null
          served_date?: string
          title?: string | null
          tray_photo_url?: string | null
          why_eat_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          guardian_id: string | null
          id: string
          is_nutritionist: boolean | null
          is_public: boolean | null
          menu_id: string | null
          replied_to: string | null
          sender_id: string | null
          sender_name: string | null
          week_start: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          is_nutritionist?: boolean | null
          is_public?: boolean | null
          menu_id?: string | null
          replied_to?: string | null
          sender_id?: string | null
          sender_name?: string | null
          week_start?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          is_nutritionist?: boolean | null
          is_public?: boolean | null
          menu_id?: string | null
          replied_to?: string | null
          sender_id?: string | null
          sender_name?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "children_with_account"
            referencedColumns: ["guardian_id"]
          },
          {
            foreignKeyName: "messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_replied_to_fkey"
            columns: ["replied_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      school_allergens: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          key: string
          label: string
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          key: string
          label: string
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          key?: string
          label?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      school_photo_kinds: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          preset_key: string | null
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          preset_key?: string | null
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          preset_key?: string | null
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_photo_kinds_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          allergy_label_format: string
          attendance_deadline: string
          common_free_allergens: Json
          created_at: string | null
          id: string
          name: string
          photo_kind_limit: number
          prefecture: string | null
          show_allergy_in_counts: boolean
        }
        Insert: {
          address?: string | null
          allergy_label_format?: string
          attendance_deadline?: string
          common_free_allergens?: Json
          created_at?: string | null
          id?: string
          name: string
          photo_kind_limit?: number
          prefecture?: string | null
          show_allergy_in_counts?: boolean
        }
        Update: {
          address?: string | null
          allergy_label_format?: string
          attendance_deadline?: string
          common_free_allergens?: Json
          created_at?: string | null
          id?: string
          name?: string
          photo_kind_limit?: number
          prefecture?: string | null
          show_allergy_in_counts?: boolean
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          line_user_id: string | null
          role: string
          school_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          line_user_id?: string | null
          role: string
          school_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          line_user_id?: string | null
          role?: string
          school_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      children_with_account: {
        Row: {
          allergens: Json | null
          class_name: string | null
          created_at: string | null
          guardian_id: string | null
          has_account: boolean | null
          id: string | null
          is_active: boolean | null
          last_seen_at: string | null
          login_no: string | null
          name: string | null
          school_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_school_id: { Args: never; Returns: string }
      is_staff: { Args: never; Returns: boolean }
      my_child_id: { Args: never; Returns: string }
      my_school_id: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
