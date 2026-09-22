import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso del sistema de punto de venta Pesito.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold text-foreground">Términos y condiciones</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última actualización: septiembre de 2026</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. El servicio</h2>
              <p className="mt-2 text-muted-foreground">
                Pesito es un sistema de punto de venta, inventario, clientes y caja pensado para
                kioscos y almacenes. Al crear una cuenta aceptás estos términos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Tu cuenta</h2>
              <p className="mt-2 text-muted-foreground">
                Sos responsable de mantener la confidencialidad de tu contraseña y de la actividad
                que ocurra dentro de tu organización. Avisanos apenas detectes un uso no autorizado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Tus datos</h2>
              <p className="mt-2 text-muted-foreground">
                Los datos que cargás (productos, ventas, clientes, etc.) son tuyos. Podés exportarlos
                o pedir que los borremos escribiendo a soporte. Ver la{" "}
                <Link href="/privacidad" className="text-primary hover:underline">
                  Política de privacidad
                </Link>{" "}
                para más detalle.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Planes y pagos</h2>
              <p className="mt-2 text-muted-foreground">
                Los precios y funciones de cada plan están detallados en la sección de{" "}
                <Link href="/#precios" className="text-primary hover:underline">
                  Precios
                </Link>{" "}
                de nuestra página. Podés cambiar o cancelar tu plan en cualquier momento desde tu
                cuenta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Disponibilidad</h2>
              <p className="mt-2 text-muted-foreground">
                Hacemos lo posible por mantener el servicio disponible de forma continua, pero no
                garantizamos un funcionamiento libre de interrupciones. Te avisaremos ante
                mantenimientos programados que puedan afectar el servicio.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Cambios en estos términos</h2>
              <p className="mt-2 text-muted-foreground">
                Podemos actualizar estos términos para reflejar cambios en el producto. Te avisamos
                antes de que un cambio relevante entre en vigencia.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Contacto</h2>
              <p className="mt-2 text-muted-foreground">
                Ante cualquier consulta, escribinos a{" "}
                <a href="mailto:soporte@pesito.app" className="text-primary hover:underline">
                  soporte@pesito.app
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
