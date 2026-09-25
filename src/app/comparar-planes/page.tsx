import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Minus } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { WhatsappFloatButton } from "@/components/marketing/whatsapp-float-button";
import { Button } from "@/components/ui/button";
import { faqCategories } from "@/lib/faq-data";
import {
  ANNUAL_DISCOUNT,
  planComparison,
  planDefinitions,
  type ComparisonValue,
} from "@/lib/plan-features";
import { pageMetadata } from "@/lib/seo";
import { cn, formatCurrency } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Comparar planes: Gratis, Esencial, Pro e IA",
  description:
    "Compará los planes de Pesito lado a lado: ventas por mes, usuarios, sucursales, caja, fiado, stock y reportes. Empezá gratis y cambiá cuando quieras.",
  path: "/comparar-planes",
});

const columns = [planDefinitions.gratis, planDefinitions.esencial, planDefinitions.pro, planDefinitions.ia];
const highlighted = "pro";
const planFaqs = faqCategories.find((c) => c.title === "Empezar y planes")?.faqs ?? [];

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto h-4 w-4 text-success" aria-hidden />
        <span className="sr-only">Incluido</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-hidden />
        <span className="sr-only">No incluido</span>
      </>
    );
  }
  return <>{value}</>;
}

export default function CompararPlanesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "es-AR",
    mainEntity: planFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
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
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Comparar planes de Pesito
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Todas las funciones de cada plan, lado a lado. El Plan Gratis no vence y no pide
              tarjeta; pasás a un plan pago recién cuando tu negocio lo necesite.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-card border border-border bg-card">
            <table className="w-full min-w-[360px] border-collapse text-xs sm:text-sm">
              <caption className="sr-only">
                Comparación de los planes Gratis, Esencial, Pro e IA de Pesito
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="sticky left-0 z-10 w-[38%] bg-card px-3 py-3 text-left font-medium text-muted-foreground sm:p-4">
                    Precio por mes
                  </th>
                  {columns.map((plan) => (
                    <th
                      key={plan.plan}
                      scope="col"
                      className={cn(
                        "px-1.5 py-3 text-center font-semibold sm:p-4",
                        plan.plan === "gratis" && "bg-muted/40 text-muted-foreground",
                        plan.plan === highlighted && "bg-primary/5 text-primary",
                        plan.plan !== "gratis" && plan.plan !== highlighted && "text-foreground"
                      )}
                    >
                      {plan.name.replace("Plan ", "")}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {plan.price === 0 ? "$0" : formatCurrency(plan.price)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {planComparison.map((group) => (
                <tbody key={group.title}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={columns.length + 1}
                      className="border-b border-border bg-muted/30 px-3 py-2 text-left text-[11px] font-semibold uppercase sm:px-4 sm:text-xs tracking-wide text-muted-foreground"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-3 text-left font-normal text-foreground sm:p-4">
                        {row.label}
                      </th>
                      {columns.map((plan) => (
                        <td
                          key={plan.plan}
                          className={cn(
                            "px-1.5 py-3 text-center sm:p-4",
                            plan.plan === "gratis" ? "bg-muted/40 text-muted-foreground" : "text-foreground",
                            plan.plan === highlighted && "bg-primary/5 font-medium"
                          )}
                        >
                          <Cell value={row.values[plan.plan]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>
              {`Precios en pesos argentinos, IVA incluido. Pagando anual tenés un ${ANNUAL_DISCOUNT * 100}% de descuento.`}
            </li>
            <li>
              Al crear tu cuenta tenés 14 días del Plan Pro gratis; cuando terminan seguís en el Plan
              Gratis sin perder datos.
            </li>
            <li>
              Ningún plan emite factura electrónica de ARCA/AFIP todavía: el ticket de venta es un
              comprobante interno.
            </li>
          </ul>

          <div className="mt-8 flex justify-center">
            <Link href="/#precios" className="text-sm font-medium text-primary hover:underline">
              Ver los planes con precio anual →
            </Link>
          </div>

          {planFaqs.length > 0 && (
            <section className="mx-auto mt-16 max-w-3xl">
              <h2 className="text-2xl font-semibold text-foreground">Preguntas sobre los planes</h2>
              <div className="mt-6 space-y-3">
                {planFaqs.map((faq) => (
                  <details key={faq.question} className="group rounded-card border border-border bg-card p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                      {faq.question}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <div className="mt-14 flex flex-col items-center gap-4 rounded-card bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold">Empezá con el Plan Gratis</h2>
            <p className="max-w-md text-primary-foreground/85">
              Sin tarjeta y sin vencimiento. Y 14 días del Plan Pro de regalo para probar todo.
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
