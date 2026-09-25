export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          business_type: string;
          currency: string;
          phone: string | null;
          auto_invoice_by_payment: boolean;
          /** "HH:MM:SS" en hora de Argentina (0041). undefined si falta la migración. */
          cash_close_time?: string | null;
          org_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type?: string;
          currency?: string;
          phone?: string | null;
          auto_invoice_by_payment?: boolean;
          cash_close_time?: string | null;
          org_code?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: "owner" | "admin" | "vendedor";
          email: string | null;
          username: string | null;
          created_at: string;
          branch_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role?: "owner" | "admin" | "vendedor";
          email?: string | null;
          username?: string | null;
          created_at?: string;
          branch_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          org_id: string;
          category_id: string | null;
          name: string;
          barcode: string | null;
          sku: string | null;
          price: number;
          cost: number | null;
          stock: number;
          min_stock: number;
          unit: string;
          brand: string | null;
          image_url: string | null;
          default_supplier_id: string | null;
          package_label: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          category_id?: string | null;
          name: string;
          barcode?: string | null;
          sku?: string | null;
          price?: number;
          cost?: number | null;
          stock?: number;
          min_stock?: number;
          unit?: string;
          brand?: string | null;
          image_url?: string | null;
          default_supplier_id?: string | null;
          package_label?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      bulk_price_changes: {
        Row: {
          id: string;
          org_id: string;
          field: "price" | "cost";
          supplier_id: string | null;
          brand: string | null;
          percent: number | null;
          fixed_amount: number | null;
          product_count: number;
          created_by: string | null;
          created_at: string;
          reverted_at: string | null;
          reverted_by: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          field: "price" | "cost";
          supplier_id?: string | null;
          brand?: string | null;
          percent?: number | null;
          fixed_amount?: number | null;
          product_count?: number;
          created_by?: string | null;
          created_at?: string;
          reverted_at?: string | null;
          reverted_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bulk_price_changes"]["Insert"]>;
        Relationships: [];
      };
      product_price_history: {
        Row: {
          id: string;
          org_id: string;
          product_id: string;
          old_price: number;
          new_price: number;
          changed_by: string | null;
          bulk_change_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          product_id: string;
          old_price: number;
          new_price: number;
          changed_by?: string | null;
          bulk_change_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_price_history"]["Insert"]>;
        Relationships: [];
      };
      product_cost_history: {
        Row: {
          id: string;
          org_id: string;
          product_id: string;
          old_cost: number;
          new_cost: number;
          changed_by: string | null;
          bulk_change_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          product_id: string;
          old_cost: number;
          new_cost: number;
          changed_by?: string | null;
          bulk_change_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_cost_history"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          razon_social: string | null;
          phone: string | null;
          email: string | null;
          document: string | null;
          notes: string | null;
          balance: number;
          invoice_type: "consumidor_final" | "factura_a" | "factura_b" | "factura_c" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          razon_social?: string | null;
          phone?: string | null;
          email?: string | null;
          document?: string | null;
          notes?: string | null;
          balance?: number;
          invoice_type?: "consumidor_final" | "factura_a" | "factura_b" | "factura_c" | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      cash_registers: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          opening_amount: number;
          closing_amount: number | null;
          expected_amount: number | null;
          status: "abierta" | "cerrada";
          opened_at: string;
          closed_at: string | null;
          notes: string | null;
          branch_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          opening_amount?: number;
          closing_amount?: number | null;
          expected_amount?: number | null;
          status?: "abierta" | "cerrada";
          opened_at?: string;
          closed_at?: string | null;
          notes?: string | null;
          branch_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cash_registers"]["Insert"]>;
        Relationships: [];
      };
      cash_movements: {
        Row: {
          id: string;
          org_id: string;
          cash_register_id: string;
          type: "ingreso" | "retiro";
          amount: number;
          reason: string | null;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          cash_register_id: string;
          type: "ingreso" | "retiro";
          amount: number;
          reason?: string | null;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cash_movements"]["Insert"]>;
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          org_id: string;
          cash_register_id: string | null;
          customer_id: string | null;
          user_id: string;
          subtotal: number;
          discount: number;
          surcharge: number;
          total: number;
          payment_method: "efectivo" | "tarjeta" | "transferencia" | "qr" | "mixto" | "fiado";
          invoice_type: "consumidor_final" | "factura_a" | "factura_b" | "factura_c";
          status: "completada" | "anulada";
          created_at: string;
          branch_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          cash_register_id?: string | null;
          customer_id?: string | null;
          user_id: string;
          subtotal?: number;
          discount?: number;
          surcharge?: number;
          total?: number;
          payment_method?: "efectivo" | "tarjeta" | "transferencia" | "qr" | "mixto" | "fiado";
          invoice_type?: "consumidor_final" | "factura_a" | "factura_b" | "factura_c";
          status?: "completada" | "anulada";
          created_at?: string;
          branch_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Insert"]>;
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Update: Partial<Database["public"]["Tables"]["sale_items"]["Insert"]>;
        Relationships: [];
      };
      sale_payments: {
        Row: {
          id: string;
          org_id: string;
          sale_id: string;
          cash_register_id: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr" | "fiado";
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          sale_id: string;
          cash_register_id?: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr" | "fiado";
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sale_payments"]["Insert"]>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          org_id: string;
          product_id: string;
          type: "venta" | "compra" | "ajuste" | "apertura" | "transferencia";
          quantity: number;
          reference: string | null;
          user_id: string | null;
          created_at: string;
          branch_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          product_id: string;
          type: "venta" | "compra" | "ajuste" | "apertura" | "transferencia";
          quantity: number;
          reference?: string | null;
          user_id?: string | null;
          created_at?: string;
          branch_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          is_main: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          is_main?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["branches"]["Insert"]>;
        Relationships: [];
      };
      branch_stock: {
        Row: {
          branch_id: string;
          product_id: string;
          org_id: string;
          stock: number;
        };
        Insert: {
          branch_id: string;
          product_id: string;
          org_id: string;
          stock?: number;
        };
        Update: Partial<Database["public"]["Tables"]["branch_stock"]["Insert"]>;
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          balance?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          org_id: string;
          supplier_id: string | null;
          user_id: string;
          subtotal: number;
          total: number;
          notes: string | null;
          status: "completada" | "anulada";
          account_amount: number;
          cash_register_id: string | null;
          payment_method: "efectivo" | "tarjeta" | "transferencia" | "qr" | null;
          created_at: string;
          branch_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          supplier_id?: string | null;
          user_id: string;
          subtotal?: number;
          total?: number;
          notes?: string | null;
          status?: "completada" | "anulada";
          account_amount?: number;
          cash_register_id?: string | null;
          payment_method?: "efectivo" | "tarjeta" | "transferencia" | "qr" | null;
          created_at?: string;
          branch_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Insert"]>;
        Relationships: [];
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_cost: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_cost: number;
          subtotal: number;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_items"]["Insert"]>;
        Relationships: [];
      };
      organization_subscriptions: {
        Row: {
          org_id: string;
          plan: "gratis" | "esencial" | "pro" | "ia";
          pro_trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          plan?: "gratis" | "esencial" | "pro" | "ia";
          pro_trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      plan_history: {
        Row: {
          id: string;
          org_id: string;
          from_plan: "gratis" | "esencial" | "pro" | "ia";
          to_plan: "gratis" | "esencial" | "pro" | "ia";
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          from_plan: "gratis" | "esencial" | "pro" | "ia";
          to_plan: "gratis" | "esencial" | "pro" | "ia";
          changed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plan_history"]["Insert"]>;
        Relationships: [];
      };
      landing_stats: {
        Row: {
          id: string;
          kioscos_offset: number;
          ventas_offset: number;
          monto_offset: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kioscos_offset?: number;
          ventas_offset?: number;
          monto_offset?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["landing_stats"]["Insert"]>;
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Insert"]>;
        Relationships: [];
      };
      testimonials: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          business_type: string | null;
          rating: number;
          quote: string;
          published: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          business_type?: string | null;
          rating?: number;
          quote: string;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["testimonials"]["Insert"]>;
        Relationships: [];
      };
      customer_payments: {
        Row: {
          id: string;
          org_id: string;
          customer_id: string;
          cash_register_id: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr";
          amount: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          customer_id: string;
          cash_register_id?: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr";
          amount: number;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_payments"]["Insert"]>;
        Relationships: [];
      };
      supplier_payments: {
        Row: {
          id: string;
          org_id: string;
          supplier_id: string;
          cash_register_id: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr";
          amount: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          supplier_id: string;
          cash_register_id?: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr";
          amount: number;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_payments"]["Insert"]>;
        Relationships: [];
      };
      purchase_payments: {
        Row: {
          id: string;
          org_id: string;
          purchase_id: string;
          cash_register_id: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr" | "cuenta_corriente";
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          purchase_id: string;
          cash_register_id?: string | null;
          method: "efectivo" | "tarjeta" | "transferencia" | "qr" | "cuenta_corriente";
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_payments"]["Insert"]>;
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          role: "admin" | "vendedor";
          created_by: string;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          code: string;
          role: "admin" | "vendedor";
          created_by: string;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_business_type?: string;
          p_phone?: string | null;
        };
        Returns: string;
      };
      checkout_sale: {
        Args: {
          p_org_id: string;
          p_cash_register_id: string | null;
          p_customer_id: string | null;
          p_payment_method: string;
          p_discount: number;
          p_items: Json;
          p_surcharge?: number;
          p_invoice_type?: string;
          p_payments?: Json | null;
        };
        Returns: string;
      };
      cash_register_summaries: {
        Args: { p_register_ids: string[] };
        Returns: {
          cash_register_id: string;
          sales_cash: number;
          debt_payments: number;
          ingresos: number;
          retiros: number;
          supplier_payments: number;
          cash_purchases: number;
          payment_breakdown: Json;
        }[];
      };
      live_overview: {
        Args: { p_org_id: string };
        Returns: Json;
      };
      void_sale: {
        Args: { p_sale_id: string };
        Returns: undefined;
      };
      register_purchase: {
        Args: {
          p_org_id: string;
          p_supplier_id: string | null;
          p_items: Json;
          p_notes?: string | null;
          p_cash_register_id?: string | null;
          p_payments?: Json | null;
          p_branch_id?: string | null;
        };
        Returns: string;
      };
      create_branch: {
        Args: { p_org_id: string; p_name: string };
        Returns: string;
      };
      set_member_branch: {
        Args: { p_membership_id: string; p_branch_id: string | null };
        Returns: undefined;
      };
      adjust_branch_stock: {
        Args: { p_branch_id: string; p_product_id: string; p_delta: number; p_reason?: string | null };
        Returns: number;
      };
      transfer_stock: {
        Args: { p_from_branch_id: string; p_to_branch_id: string; p_items: Json; p_note?: string | null };
        Returns: undefined;
      };
      void_purchase: {
        Args: { p_purchase_id: string };
        Returns: undefined;
      };
      register_customer_payment: {
        Args: {
          p_customer_id: string;
          p_cash_register_id: string | null;
          p_method: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      register_supplier_payment: {
        Args: {
          p_supplier_id: string;
          p_cash_register_id: string | null;
          p_method: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      bulk_increase_price_by_supplier: {
        Args: {
          p_org_id: string;
          p_supplier_id: string;
          p_percent?: number | null;
          p_fixed_amount?: number | null;
        };
        Returns: number;
      };
      bulk_increase_field: {
        Args: {
          p_org_id: string;
          p_field: string;
          p_supplier_id?: string | null;
          p_brand?: string | null;
          p_percent?: number | null;
          p_fixed_amount?: number | null;
        };
        Returns: number;
      };
      bulk_increase_cost_with_price: {
        Args: {
          p_org_id: string;
          p_supplier_id?: string | null;
          p_brand?: string | null;
          p_percent?: number | null;
          p_fixed_amount?: number | null;
        };
        Returns: { cost_count: number; price_count: number };
      };
      revert_bulk_price_change: {
        Args: { p_bulk_change_id: string };
        Returns: { reverted: number; skipped: number };
      };
      create_invitation: {
        Args: { p_org_id: string; p_role: string };
        Returns: Database["public"]["Tables"]["invitations"]["Row"];
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      get_invitation_preview: {
        Args: { p_code: string };
        Returns: { org_id: string; org_name: string; role: string; valid: boolean }[];
      };
      accept_invitation: {
        Args: { p_code: string; p_username?: string | null };
        Returns: string;
      };
      update_member_role: {
        Args: { p_membership_id: string; p_role: string };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_membership_id: string };
        Returns: undefined;
      };
      username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      create_member_direct: {
        Args: { p_org_id: string; p_user_id: string; p_role: string; p_username: string };
        Returns: undefined;
      };
      check_login_lockout: {
        Args: { p_email: string };
        Returns: { locked: boolean; retry_after_seconds: number }[];
      };
      register_login_failure: {
        Args: { p_email: string };
        Returns: undefined;
      };
      register_login_success: {
        Args: { p_email: string };
        Returns: undefined;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      update_member_username: {
        Args: { p_membership_id: string; p_username: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
