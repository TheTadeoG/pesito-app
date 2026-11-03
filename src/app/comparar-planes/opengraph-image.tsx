import { OG_SIZE, renderOgCard } from "@/lib/og-card";
import { planDefinitions } from "@/lib/plan-features";

// Vista previa de /comparar-planes (a donde también va /planes sin sesión): los planes con su precio.
export const alt = "Planes de Pesito: Gratis, Básico, Pro y Max";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const { basico, pro, max } = planDefinitions;
  return renderOgCard({
    title: "Elegí tu plan",
    subtitle: "Empezá gratis y cambiá de plan cuando quieras. Precios por mes, IVA incluido.",
    chips: ["Gratis", `Básico ${basico.priceLabel}`, `Pro ${pro.priceLabel}`, `Max ${max.priceLabel}`],
  });
}
