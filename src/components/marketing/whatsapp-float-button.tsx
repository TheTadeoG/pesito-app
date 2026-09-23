import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";

// Sin el logo de WhatsApp (ver Support): acá sí es un link real a WhatsApp,
// así que el ícono de chat + la posición flotante ya comunican de qué se
// trata, sin necesitar la marca ajena.
export function WhatsappFloatButton() {
  return (
    <a
      href={whatsappLink("Hola! Tengo una consulta sobre Pesito.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-primary py-3.5 pl-3.5 pr-3.5 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:pr-5 sm:bottom-6 sm:right-6"
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary opacity-75 [animation-duration:2.5s]" />
      <MessageCircle className="h-6 w-6 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 group-hover:max-w-[10rem]">
        Escribinos
      </span>
    </a>
  );
}
