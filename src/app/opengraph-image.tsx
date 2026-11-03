import { OG_SIZE, renderOgCard } from "@/lib/og-card";

// Imagen por defecto de las vistas previas (la usa cualquier página que no defina la suya).
export const alt = "Pesito: sistema POS y punto de venta para tu negocio";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    title: "Sistema POS para tu negocio",
    subtitle: "Ventas, stock, caja y fiado en un solo lugar.",
    chips: ["Gratis para empezar", "Hecho en Argentina"],
  });
}
