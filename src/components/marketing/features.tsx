import {
  BarChart3,
  Boxes,
  Receipt,
  ScanBarcode,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const features = [
  {
    icon: ShoppingCart,
    title: "Punto de venta ágil",
    description:
      "Buscá por nombre o escaneá el código de barras y cobrá en segundos, con doble Enter para procesar la venta.",
  },
  {
    icon: Boxes,
    title: "Control de inventario",
    description:
      "Stock actualizado en cada venta, alertas de productos por agotarse y carga rápida de mercadería nueva.",
  },
  {
    icon: Wallet,
    title: "Caja diaria clara",
    description:
      "Abrí y cerrá tu caja con el monto inicial, mirá el efectivo esperado y evitá diferencias a fin del día.",
  },
  {
    icon: Users,
    title: "Clientes y fiado",
    description:
      "Guardá tus clientes habituales, llevá la cuenta corriente y no perdás más el hilo de quién te debe.",
  },
  {
    icon: BarChart3,
    title: "Reportes simples",
    description:
      "Ventas del día, productos más vendidos y el estado de tu negocio de un vistazo, sin planillas.",
  },
  {
    icon: Sparkles,
    title: "Recomendaciones con IA",
    description:
      "Sugerencias de reposición y productos de baja rotación para que tu capital no quede dormido en la góndola.",
  },
  {
    icon: ScanBarcode,
    title: "Balanza y códigos",
    description:
      "Compatible con lectores de código de barras y balanzas para productos que se venden por peso.",
  },
  {
    icon: Receipt,
    title: "Multiusuario",
    description:
      "Sumá a tus empleados con su propio acceso, cada uno con su caja y su historial de ventas.",
  },
];

export function Features() {
  return (
    <section id="funciones" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Todo lo que necesita tu negocio, en un solo lugar
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Pesito junta en una sola app lo que hoy manejás con cuaderno,
          calculadora y memoria.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-card border border-border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-primary/5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <feature.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
