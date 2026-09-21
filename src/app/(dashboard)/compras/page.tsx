import { ShoppingBag } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ComprasPage() {
  return (
    <ComingSoon
      icon={ShoppingBag}
      title="Compras, muy pronto"
      description="Vas a poder registrar el ingreso de mercadería y actualizar tu stock automáticamente al cargar una compra a tu proveedor."
    />
  );
}
