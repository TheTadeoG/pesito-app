import { UserCog } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function UsuariosPage() {
  return (
    <ComingSoon
      icon={UserCog}
      title="Gestión de usuarios, muy pronto"
      description="Vas a poder invitar a tus empleados, darles su propio acceso y elegir qué pueden ver o hacer en el sistema."
    />
  );
}
