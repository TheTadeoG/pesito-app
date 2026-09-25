import { LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { whatsappLink } from "@/lib/whatsapp";

export default function SoportePage() {
  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <CardTitle className="mt-4">¿Necesitás ayuda?</CardTitle>
          <CardDescription>
            Escribinos y te ayudamos a sacarle el jugo a Pesito en tu negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href={whatsappLink("Hola! Tengo una consulta sobre Pesito.")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4 text-primary" />
            WhatsApp
          </a>
          <a
            href="mailto:soporte@pesito.app"
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Mail className="h-4 w-4 text-primary" />
            soporte@pesito.app
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
