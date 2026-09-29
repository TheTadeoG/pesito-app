import { StaggerIn } from "@/components/marketing/stagger-in";
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
      "Con el Plan IA: sugerencia de precios cuando sube el costo, qué reponer y cuánto, y los productos de baja rotación, para que tu capital no quede dormido en la góndola.",
  },
  {
    icon: ScanBarcode,
    title: "Balanza y códigos",
    description:
      "Compatible con lectores de código de barras, y productos por peso con la cantidad en kilos. La conexión con balanzas llega pronto.",
  },
  {
    icon: Receipt,
    title: "Multiusuario",
    description:
      "Sumá a tus empleados con su propio acceso, cada uno con su caja y su historial de ventas.",
  },
];

// Bento: 8 funciones, 8 celdas (3+3 / 2+2+2 / 2+2+2), con algunas celdas de color
// para que la grilla tenga ritmo. Las dos primeras son las que más se usan.
const cells = [
  { span: "lg:col-span-3", tone: "deep" },
  { span: "lg:col-span-3", tone: "tint" },
  { span: "lg:col-span-2", tone: "card" },
  { span: "lg:col-span-2", tone: "card" },
  { span: "lg:col-span-2", tone: "card" },
  { span: "lg:col-span-2", tone: "block" },
  { span: "lg:col-span-2", tone: "card" },
  { span: "lg:col-span-2", tone: "card" },
] as const;

const tones = {
  deep: { box: "border-transparent bg-deep text-deep-foreground", icon: "bg-lime/15 text-lime", text: "text-deep-muted" },
  block: { box: "border-transparent bg-block text-white", icon: "bg-white/15 text-white", text: "text-white/80" },
  tint: { box: "border-border bg-muted/60 text-foreground", icon: "bg-accent text-accent-foreground", text: "text-muted-foreground" },
  card: { box: "border-border bg-card text-foreground", icon: "bg-accent text-accent-foreground", text: "text-muted-foreground" },
} as const;

export function Features() {
  return (
    <section id="funciones" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
          Todo lo que necesita tu negocio, <span className="text-primary">en un solo lugar</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Pesito junta en una sola app lo que hoy manejás con cuaderno,
          calculadora y memoria.
        </p>
      </div>

      <StaggerIn className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {features.map((feature, i) => {
          const cell = cells[i] ?? { span: "lg:col-span-2", tone: "card" as const };
          const tone = tones[cell.tone];
          return (
            <div
              key={feature.title}
              className={`rounded-card border p-6 transition-shadow hover:shadow-lg hover:shadow-primary/5 sm:p-7 ${cell.span} ${tone.box}`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone.icon}`}>
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
              <p className={`mt-2 max-w-md text-sm leading-relaxed ${tone.text}`}>
                {feature.description}
              </p>
            </div>
          );
        })}
      </StaggerIn>
    </section>
  );
}
