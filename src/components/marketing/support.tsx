import { Mail, MessageSquareText, ShieldCheck, UserRound } from "lucide-react";

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
    icon: Mail,
    title: "Directo por mail",
    description: "Escribís a soporte@pesito.app y listo. Sin pasar por un chat automático.",
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
            lee cada mail y contesta en persona.
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

        <div className="rounded-card border border-border bg-card p-6">
          <p className="text-xs font-medium text-muted-foreground">
            Así te ayudamos, en la práctica:
          </p>
          <div className="mt-4 space-y-3">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-muted px-4 py-2.5 text-sm text-foreground">
              Se me trabó el cierre de caja, ¿qué hago?
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-primary/20 bg-accent px-4 py-2.5 text-sm text-accent-foreground">
              <p className="mb-1 text-xs font-semibold text-primary">Pesito</p>
              Fijate si te quedó una venta sin confirmar en el carrito, eso traba el cierre. Si no
              es eso, mandame el mensaje exacto y lo vemos juntos ahora.
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Ejemplo de cómo respondemos, no una captura real de un caso.
          </p>
        </div>
      </div>
    </section>
  );
}
