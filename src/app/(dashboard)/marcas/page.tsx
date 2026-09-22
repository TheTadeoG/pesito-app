import { redirect } from "next/navigation";

// Marcas ahora es una pestaña de Productos.
export default function MarcasPage() {
  redirect("/productos?tab=marcas");
}
