import { Sparkles } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function RecomendacionesPage() {
  return (
    <ComingSoon
      icon={Sparkles}
      title="Recomendaciones con IA, muy pronto"
      description="Estamos entrenando sugerencias de reposición y combos según lo que más se vende en tu kiosco."
    />
  );
}
