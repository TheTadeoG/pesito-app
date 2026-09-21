const steps = [
  {
    number: "1",
    title: "Creá tu kiosco",
    description: "Te registrás con tu email, le ponés nombre a tu negocio y ya tenés tu cuenta lista.",
  },
  {
    number: "2",
    title: "Cargá tus productos",
    description: "Sumá tu catálogo a mano o rápido con el escáner de código de barras.",
  },
  {
    number: "3",
    title: "Abrí la caja y vendé",
    description: "Empezá a cobrar desde el primer minuto: el stock y la caja se actualizan solos.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y border-border bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Empezar te lleva menos de 10 minutos
          </h2>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="relative text-center sm:text-left">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
