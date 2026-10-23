export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "ADMIN" | "USER";

export type MealType = "BREAKFAST" | "LUNCH_FIRST" | "LUNCH_SECOND" | "DINNER";

export type OrderStatus = "PENDING" | "IN_DELIVERY" | "COMPLETED" | "CANCELLED";

export type KitchenReportRow = {
  dish_title: string;
  meal_type: MealType;
  portions: number;
};

export type DeliveryReportRow = {
  location_name: string;
  breakfast_count: number;
  lunch_first_count: number;
  lunch_second_count: number;
  dinner_count: number;
  kits_count: number;
};

export type Database = {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          role: UserRole;
          default_location_id: string | null;
          is_blocked: boolean;
          must_change_password: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          role?: UserRole;
          default_location_id?: string | null;
          is_blocked?: boolean;
          must_change_password?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          role?: UserRole;
          default_location_id?: string | null;
          is_blocked?: boolean;
          must_change_password?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_default_location_id_fkey";
            columns: ["default_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      dishes: {
        Row: {
          id: string;
          title: string;
          description: string;
          meal_type: MealType;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          meal_type: MealType;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          meal_type?: MealType;
          is_active?: boolean;
        };
        Relationships: [];
      };
      daily_menu: {
        Row: {
          id: string;
          date: string;
          dish_id: string;
          meal_type: MealType;
        };
        Insert: {
          id?: string;
          date: string;
          dish_id: string;
          meal_type: MealType;
        };
        Update: {
          id?: string;
          date?: string;
          dish_id?: string;
          meal_type?: MealType;
        };
        Relationships: [
          {
            foreignKeyName: "daily_menu_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          target_location_id: string;
          date: string;
          status: OrderStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_location_id: string;
          date: string;
          status?: OrderStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_location_id?: string;
          date?: string;
          status?: OrderStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_target_location_id_fkey";
            columns: ["target_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          daily_menu_id: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          daily_menu_id: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          daily_menu_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_daily_menu_id_fkey";
            columns: ["daily_menu_id"];
            isOneToOne: false;
            referencedRelation: "daily_menu";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_blocked_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      check_admin_menu_deadline: {
        Args: { target_date: string };
        Returns: boolean;
      };
      check_user_order_deadline: {
        Args: { target_date: string };
        Returns: boolean;
      };
      get_kitchen_report: {
        Args: { target_date: string };
        Returns: KitchenReportRow[];
      };
      get_delivery_report: {
        Args: { target_date: string };
        Returns: DeliveryReportRow[];
      };
      complete_password_change: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
