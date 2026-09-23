import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function Testimonials() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, name, location, business_type, rating, quote")
    .eq("published", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(9);

  const testimonials = data ?? [];
  if (testimonials.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Kiosqueros y almaceneros que ya lo usan
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Esto nos dicen los dueños de negocio que se pasaron a Pesito.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-card border border-border bg-card p-6"
          >
            <div className="flex items-center gap-0.5 text-warning">
              {Array.from({ length: t.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {t.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[t.business_type, t.location].filter(Boolean).join(" · ") || "Cliente Pesito"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
