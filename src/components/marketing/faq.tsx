import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { featuredFaqs } from "@/lib/faq-data";


export function Faq() {
  return (
    <section id="preguntas-frecuentes" className="scroll-mt-20 mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Preguntas frecuentes
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Lo que más nos preguntan antes de empezar.
        </p>
      </div>

      <div className="mt-10 space-y-3">
        {featuredFaqs.map((faq) => (
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

      <div className="mt-6 text-center">
        <Link
          href="/preguntas-frecuentes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Ver todas las preguntas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
