import { redirect } from "next/navigation";

// Inventario ahora es la lista de Productos (con su stock).
export default function InventarioPage() {
  redirect("/productos");
}
