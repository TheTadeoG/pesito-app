import { StaggerIn } from "@/components/marketing/stagger-in";

// Lo que más tiempo le ahorra al comerciante, en orden. Todo existe hoy:
// cada fila nombra el plan que lo incluye (vacío = ya viene en el Plan Gratis).
const rows = [
  {
    before: "Te aumenta el proveedor y cambiás los precios de a uno, producto por producto.",
    after: "Subís precios o costos por proveedor o marca en un solo paso. Si te equivocás, lo deshacés.",
    plan: "Plan Pro",
  },
  {
    before: "Cargás tu catálogo entero a mano, artículo por artículo.",
    after: "Lo subís de una vez desde una planilla de Excel.",
    plan: "Plan Esencial",
  },
  {
    before: "Marcás los precios con birome y no tenés códigos de barras propios.",
    after: "Generás códigos de barras propios e imprimís las etiquetas con el precio.",
    plan: "Plan Esencial",
  },
  {
    before: "Armás el pedido a cada proveedor de memoria y te falta lo que más vendés.",
    after: "Pesito calcula qué pedir a cada proveedor y cuánto, y lo mandás por WhatsApp.",
    plan: "Plan IA",
  },
  {
    before: "Anotás el fiado en una libreta y a fin de mes no cierra.",
    after: "Cada cliente tiene su cuenta corriente. Ves quién te debe y cuánto, al instante.",
    plan: "",
  },
  {
    before: "Cerrás la caja con la calculadora y faltan pesos que no sabés de dónde salen.",
    after: "Ves el efectivo esperado al cerrar, así las diferencias se notan enseguida.",
    plan: "",
  },
];

export function Versus() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
          Lo que hoy te lleva horas, <span className="text-primary">Pesito lo hace en un paso</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Las tareas que más tiempo te comen cada semana, resueltas.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="mb-3 hidden gap-3 px-1 text-xs font-semibold uppercase tracking-wide md:grid md:grid-cols-2">
          <span className="text-muted-foreground">Hoy, a mano</span>
          <span className="text-primary">Con Pesito</span>
        </div>
        <StaggerIn className="space-y-3">
          {rows.map((row) => (
            <div key={row.before} className="grid overflow-hidden rounded-card border border-border md:grid-cols-2">
              <p className="bg-muted/50 p-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {row.before}
              </p>
              <div className="border-t border-border bg-card p-5 md:border-l md:border-t-0">
                <p className="text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                  {row.after}
                </p>
                {row.plan && (
                  <span className="mt-3 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {row.plan}
                  </span>
                )}
              </div>
            </div>
          ))}
        </StaggerIn>
      </div>
    </section>
  );
}
