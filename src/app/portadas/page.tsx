import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero6, Hero7, Hero8, Hero9, Hero10 } from "@/components/marketing/hero-variants";

// Página temporal para elegir la portada nueva. No se indexa ni va al sitemap.
export const metadata: Metadata = {
  title: "Portadas de prueba",
  robots: { index: false, follow: false },
};

const variants = [
  { id: 6, name: "Fondo de panel, el sistema a la vista", Component: Hero6 },
  { id: 7, name: "Centrada, el panel asoma abajo", Component: Hero7 },
  { id: 8, name: "Del cuaderno a Pesito", Component: Hero8 },
  { id: 9, name: "Mostrador y celular", Component: Hero9 },
  { id: 10, name: "Un día en el negocio", Component: Hero10 },
];

export default function PortadasPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {variants.map(({ id, name, Component }) => (
          <div key={id} id={`p${id}`}>
            <p className="bg-foreground px-4 py-2 text-center text-sm font-semibold text-background">
              Opción {id}: {name}
            </p>
            <Component />
          </div>
        ))}
      </main>
    </>
  );
}
