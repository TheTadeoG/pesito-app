import { StaggerIn } from "@/components/marketing/stagger-in";

const rows = [
  {
    from: "El cuaderno",
    before: "Anotás el fiado en una libreta y a fin de mes no cierra.",
    after: "Cada cliente tiene su cuenta corriente. Ves quién te debe y cuánto, al instante.",
  },
  {
    from: "La calculadora",
    before: "Cerrás la caja y faltan $2.000. ¿De dónde?",
    after: "Abrís y cerrás la caja y ves el efectivo esperado, así las diferencias se notan enseguida.",
  },
  {
    from: "La memoria",
    before: "Se acaba lo que más vendés y te enterás cuando ya no queda.",
    after: "El stock baja con cada venta y te avisa antes de que se acabe.",
  },
];

export function Versus() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <h2 className="max-w-3xl text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
        Lo que hoy hacés a mano, <span className="text-primary">Pesito lo hace solo.</span>
      </h2>
      <StaggerIn className="mt-12 border-t border-border">
        {rows.map((row) => (
          <div
            key={row.from}
            className="grid gap-3 border-b border-border py-7 md:grid-cols-2 md:gap-12"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {row.from}
              </p>
              <p className="mt-2 text-lg text-muted-foreground line-through decoration-danger/50 sm:text-xl">
                {row.before}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pesito</p>
              <p className="mt-2 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
                {row.after}
              </p>
            </div>
          </div>
        ))}
      </StaggerIn>
    </section>
  );
}
