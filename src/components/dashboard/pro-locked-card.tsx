import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Card que reemplaza a un widget Pro cuando el negocio no tiene acceso. */
export function ProLockedCard({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <div className="mb-1 flex items-center justify-center gap-2">
            <p className="font-semibold text-foreground">{title}</p>
            <Badge tone="accent">Pro</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Disponible para negocios en el Plan Pro o superior.
          </p>
        </div>
        <Link
          href="/configuracion"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver planes
        </Link>
      </CardContent>
    </Card>
  );
}
