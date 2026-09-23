import Link from "next/link";
import { ArrowRight, LayoutDashboard, Package, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cómo funciona Pesito, paso a paso",
  description:
    "Del registro a la primera venta y la facturación: los 5 pasos reales para empezar a usar Pesito en tu comercio, sin vueltas.",
  path: "/como-funciona",
});

const steps = [
  {
    icon: UserPlus,
    title: "Creás tu cuenta y tu negocio",
    description:
      "Te registrás con tu email, le ponés nombre a tu negocio y elegís tu rubro entre los que ya tenemos (kiosco, almacén, indumentaria, farmacia, ferretería, gastronomía, servicios y más). No pedimos tarjeta para arrancar.",
  },
  {
    icon: Package,
    title: "Cargás tu catálogo",
    description:
      "Sumás tus productos a mano o escaneando el código de barras. Podés cargarlos por unidad, por peso o con variantes (talle, color, gramaje), con marca, costo y precio — lo mínimo obligatorio es nombre y precio, el resto lo completás cuando puedas.",
  },
  {
    icon: ShoppingCart,
    title: "Abrís la caja y vendés",
    description:
      "Desde el Punto de Venta buscás o escaneás el producto, elegís el medio de pago (efectivo, tarjeta, transferencia, QR o uno propio que hayas cargado) y cobrás. Si es en efectivo, te calcula el vuelto solo.",
  },
  {
    icon: LayoutDashboard,
    title: "Controlás stock, fiado y reportes desde un solo lugar",
    description:
      "El stock se descuenta solo con cada venta y te avisa si algo se queda sin unidades. El fiado de cada cliente queda en su cuenta corriente, sin cuaderno ni memoria. Y los reportes de ventas, productos y métodos de pago te dicen sin adivinar cómo te fue.",
  },
  {
    icon: Receipt,
    title: "Facturás en ARCA (si lo necesitás)",
    description:
      "Si tu negocio factura, activás la facturación electrónica como complemento: comprobantes A, B o C con CAE automático. Es opcional y no hace falta para vender — muchos negocios arrancan sin facturar y lo activan después.",
  },
];

export default function ComoFuncionaPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo funciona Pesito",
    description: metadata.description,
    url: `${siteUrl}/como-funciona`,
    step: steps.map((s) => ({
      "@type": "HowToStep",
      name: s.title,
      text: s.description,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Cómo funciona Pesito, paso a paso
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Sin capacitación ni manual de 40 páginas. Esto es literalmente lo que hacés, en
              orden, desde que te registrás hasta que facturás si te hace falta.
            </p>
          </div>

          <ol className="mt-14 space-y-10">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <step.icon className="h-5 w-5" />
                  </span>
                  {i < steps.length - 1 && (
                    <span aria-hidden className="mt-2 h-full w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Paso {i + 1}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">Empezá los 5 pasos ahora mismo</h2>
            <p className="max-w-md text-primary-foreground/85">
              El primero te lleva dos minutos y no pedimos tarjeta.
            </p>
            <Link href="/registro">
              <Button size="lg" variant="onColor">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsappFloatButton />
    </>
  );
}
