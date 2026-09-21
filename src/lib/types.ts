import type { Database } from "@/lib/database.types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Membership = Database["public"]["Tables"]["memberships"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CashRegister = Database["public"]["Tables"]["cash_registers"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];

export interface CartLine {
  product: Product;
  quantity: number;
}
