import type { Json } from "@/lib/database.types";

// Lo que devuelve la función live_overview (migración 0042) para la
// pantalla "En vivo".
export interface LiveBranch {
  id: string;
  name: string;
  is_main: boolean;
  count: number;
  total: number;
  yesterday_total: number;
  open_registers: number;
  by_hour: number[];
}

export interface LiveOpenRegister {
  id: string;
  branch_id?: string | null;
  opened_at: string;
  opening_amount: number;
  cash: number | null;
  // Desde 0044: lo vendido en esta caja.
  sales_count?: number;
  sales_total?: number;
}

export interface LiveClosedRegister {
  closed_at: string;
  difference: number;
  // Desde 0044.
  id?: string;
  branch_id?: string | null;
  opened_at?: string;
  closing_amount?: number | null;
  sales_count?: number;
  sales_total?: number;
}

export interface LiveMember {
  user_id: string;
  // Con sucursales (0043): la de su caja abierta, o la asignada.
  branch_id?: string | null;
  label: string | null;
  role: "owner" | "admin" | "vendedor";
  sales_count: number;
  sales_total: number;
  last_sale_at: string | null;
  open_register: LiveOpenRegister | null;
  closed_today: LiveClosedRegister[];
  // Con sucursales: lo vendido hoy en cada una (branch_id -> totales).
  by_branch?: Record<string, { count: number; total: number; last_sale_at: string }>;
}

export interface LiveSale {
  id: string;
  branch_id?: string | null;
  user_id: string;
  total: number;
  payment_method: string;
  created_at: string;
  items: string | null;
}

export interface LiveOverview {
  generated_at: string;
  today: { count: number; total: number };
  yesterday_same_time: { count: number; total: number };
  by_hour: number[];
  // Sin la migración 0043 no viene.
  branches?: LiveBranch[];
  members: LiveMember[];
  recent_sales: LiveSale[];
}

export function parseLiveOverview(data: Json): LiveOverview {
  return data as unknown as LiveOverview;
}
