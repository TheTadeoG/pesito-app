import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Política de privacidad",
  description: "Cómo Pesito recopila, usa y protege los datos de tu negocio y tus clientes.",
  path: "/privacidad",
});

export default function PrivacidadPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold text-foreground">Política de privacidad</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última actualización: septiembre de 2026</p>

          <div className="prose-pesito mt-10 space-y-8 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Qué datos recopilamos</h2>
              <p className="mt-2 text-muted-foreground">
                Para crear tu cuenta guardamos tu email y la contraseña (encriptada). Para operar tu
                negocio, guardamos los datos que vos cargás: productos, ventas, compras, clientes,
                proveedores y movimientos de caja. Estos datos pertenecen a tu organización y no se
                comparten con otras cuentas de Pesito.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Cómo los usamos</h2>
              <p className="mt-2 text-muted-foreground">
                Usamos esta información únicamente para brindarte el servicio: mostrar tus reportes,
                calcular tu stock, procesar tus ventas y compras, y comunicarnos con vos por soporte.
                No vendemos ni compartimos tus datos con terceros para fines publicitarios.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Dónde se almacenan</h2>
              <p className="mt-2 text-muted-foreground">
                Los datos se almacenan en Supabase (infraestructura sobre PostgreSQL) con acceso
                restringido por organización mediante políticas de seguridad a nivel de fila. Usamos
                Vercel para el hosting de la aplicación y para métricas de rendimiento (Speed
                Insights), que no incluyen datos personales identificables de tus clientes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Tus derechos</h2>
              <p className="mt-2 text-muted-foreground">
                Podés pedir la exportación o eliminación de tu cuenta y tus datos en cualquier momento
                escribiendo a{" "}
                <a href="mailto:soporte@pesito.app" className="text-primary hover:underline">
                  soporte@pesito.app
                </a>
                . Vas a recibir una respuesta en un plazo razonable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Cambios a esta política</h2>
              <p className="mt-2 text-muted-foreground">
                Si actualizamos esta política de forma relevante, te avisamos por email o dentro de la
                aplicación antes de que entre en vigencia.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Contacto</h2>
              <p className="mt-2 text-muted-foreground">
                Ante cualquier consulta sobre privacidad, escribinos a{" "}
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
