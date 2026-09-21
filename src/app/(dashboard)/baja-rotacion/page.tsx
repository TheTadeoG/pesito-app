import { TrendingDown } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function BajaRotacionPage() {
  return (
    <ComingSoon
      icon={TrendingDown}
      title="Baja rotación, muy pronto"
      description="Vamos a mostrarte qué productos hace tiempo no se venden para que no se te quede el capital dormido en la góndola."
    />
  );
}
