import { ChevronDown } from "lucide-react";

export const faqs = [
  {
    question: "¿Necesito internet para usar Pesito?",
    answer:
      "Sí, Pesito funciona en la nube: necesitás una conexión a internet (wifi o datos) para cobrar ventas, actualizar el stock y ver tus reportes desde cualquier dispositivo.",
  },
  {
    question: "¿Sirve para un negocio chico o solo para uno grande?",
    answer:
      "Pesito está pensado primero para el comercio de barrio, sea cual sea tu rubro: el plan gratuito te alcanza para arrancar con un solo usuario, y podés crecer a un plan pago a medida que tu negocio crece.",
  },
  {
    question: "¿Puedo usar lector de código de barras?",
    answer:
      "Sí. El buscador del Punto de Venta acepta tanto el texto de un lector de código de barras como la búsqueda manual por nombre del producto.",
  },
  {
    question: "¿Qué pasa si un cliente me debe (fiado)?",
    answer:
      "Podés cargar tus clientes habituales y cobrar una venta como \"fiado\": Pesito lleva la cuenta corriente de cada cliente y te permite registrar sus pagos cuando saldan la deuda.",
  },
  {
    question: "¿Cada empleado tiene su propia caja?",
    answer:
      "Sí, cada usuario abre y cierra su propia caja con su monto inicial de efectivo, independiente de la caja de sus compañeros, para que sea fácil detectar diferencias.",
  },
  {
    question: "¿Tiene costo el plan gratuito?",
    answer:
      "No, el plan Gratis de Pesito no tiene costo y no pide tarjeta de crédito. Podés pasarte al plan Pro cuando necesites usuarios y clientes ilimitados.",
  },
];

export function Faq() {
  return (
    <section id="preguntas-frecuentes" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Preguntas frecuentes
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Lo que más nos preguntan los comerciantes de barrio.
        </p>
      </div>

      <div className="mt-10 space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-card border border-border bg-card p-5 open:pb-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
              {faq.question}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
