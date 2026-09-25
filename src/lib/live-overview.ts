import type { Json } from "@/lib/database.types";

// Lo que devuelve la función live_overview (migración 0042) para la
// pantalla "En vivo".
export interface LiveMember {
  user_id: string;
  label: string | null;
  role: "owner" | "admin" | "vendedor";
  sales_count: number;
  sales_total: number;
  last_sale_at: string | null;
  open_register: { id: string; opened_at: string; opening_amount: number; cash: number | null } | null;
  closed_today: { closed_at: string; difference: number }[];
}

export interface LiveSale {
  id: string;
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
  members: LiveMember[];
  recent_sales: LiveSale[];
}

export function parseLiveOverview(data: Json): LiveOverview {
  return data as unknown as LiveOverview;
}
