import { CheckCheck, MessageCircle, MessageSquareText, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  from: "user" | "pesito";
  text: string;
  time: string;
}

// Tres consultas típicas de un día cualquiera, resueltas una atrás de la
// otra — no un solo ida y vuelta perfecto, que se siente más de folleto
// que de chat real.
const conversation: ChatMessage[] = [
  { from: "user", text: "Holaa, se me trabó el cierre de caja 😩", time: "14:02" },
  {
    from: "pesito",
    text: "Hola! Fijate si te quedó una venta sin confirmar en el carrito, eso traba el cierre.",
    time: "14:03",
  },
  { from: "user", text: "Sí, era eso. Ya cerró, gracias!", time: "14:05" },
  {
    from: "user",
    text: "Che, aparte cargué mal el precio de una gaseosa, ¿la puedo corregir?",
    time: "14:06",
  },
  {
    from: "pesito",
    text: "Sí, andá a Productos, buscala y tocá el lápiz para editar. Se actualiza al toque.",
    time: "14:07",
  },
  { from: "user", text: "Buenísimo", time: "14:08" },
  {
    from: "user",
    text: "Una última: un cliente me pagó la mitad del fiado, ¿cómo lo anoto?",
    time: "14:10",
  },
  {
    from: "pesito",
    text: 'Entrá a su ficha en Clientes y tocá "Registrar pago". Le baja la deuda y queda en el historial.',
    time: "14:11",
  },
  { from: "user", text: "Sos un capo, quedó todo solucionado 🙌", time: "14:12" },
];

const qualities = [
  {
    icon: UserRound,
    title: "Te contesta una persona",
    description: "Nada de bot ni de formulario eterno: escribís y te responde alguien del equipo.",
  },
  {
    icon: MessageSquareText,
    title: "Entendemos tu kiosco",
    description: "Hablamos de fiado, de balanza y de cierre de caja — no de \"tickets\" genéricos.",
  },
  {
    icon: MessageCircle,
    title: "Directo por WhatsApp",
    description: "Nos escribís como a cualquier contacto, sin bajar otra app ni pasar por un bot.",
  },
  {
    icon: ShieldCheck,
    title: "Seguimos después de la venta",
    description: "El soporte no termina cuando activás el plan: te acompañamos mientras lo usás.",
  },
];

export function Support() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Cuando algo no funciona, alguien te contesta
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No tenemos un ejército de soporte — todavía. Lo que sí tenemos es un equipo chico que
            lee cada mensaje y contesta en persona.
          </p>

          <ul className="mt-10 space-y-6">
            {qualities.map((q) => (
              <li key={q.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <q.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{q.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{q.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/*
          Colores fijos de WhatsApp (no los tokens de la app): es un mock
          de esa app puntual, no una pantalla de Pesito, así que se ve
          igual sin importar si el resto de la página está en modo claro
          u oscuro — como una captura. Sin el logo de WhatsApp, para no
          dar a entender una alianza oficial que no existe.
        */}
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border shadow-lg shadow-black/5">
          <div className="flex items-center gap-2.5 bg-[#075E54] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
              P
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Pesito</p>
              <p className="text-xs text-white/70">En línea</p>
            </div>
          </div>

          {/*
            Alto máximo con scroll (como un chat real) en vez de achicar
            texto/ancho: son 9 mensajes y sino la tarjeta queda desmedida
            al lado de la lista de la izquierda.
          */}
          <div
            className="whatsapp-scroll max-h-64 space-y-2 overflow-y-auto px-3 py-3"
            style={{
              backgroundColor: "#e5ded8",
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.02) 0%, transparent 40%)",
            }}
          >
            {conversation.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-1.5 text-sm leading-snug text-[#111b21] shadow-sm",
                  msg.from === "user"
                    ? "ml-auto rounded-tr-none bg-[#dcf8c6]"
                    : "rounded-tl-none bg-white"
                )}
              >
                {msg.text}
                <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                  {msg.time}
                  {msg.from === "user" && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2">
            <div className="flex-1 rounded-full bg-white px-3.5 py-2 text-sm text-[#8696a0]">
              Escribí un mensaje…
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#075E54] text-white">
              <MessageCircle className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-5xl text-center text-xs text-muted-foreground lg:text-right">
        Ejemplo de cómo respondemos por WhatsApp, no una captura real de una consulta.
      </p>
    </section>
  );
}
