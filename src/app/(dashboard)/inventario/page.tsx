import { redirect } from "next/navigation";

// Inventario ahora es la pestaña "Stock" de Productos.
export default function InventarioPage() {
  redirect("/productos?tab=stock");
}
