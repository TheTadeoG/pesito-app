import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Tarjeta de las vistas previas al compartir un link (WhatsApp, redes, mensajes): el logo real de Pesito sobre el
// azul de la marca, un título corto y, abajo, datos concretos. Todas las páginas usan la misma para que se reconozcan.

export const OG_SIZE = { width: 1200, height: 630 };

async function logoDataUri(): Promise<string> {
  // Estas imágenes se generan al compilar (no usan nada del pedido), así que se lee el archivo de public/.
  const buf = await readFile(join(process.cwd(), "public", "logo-icon.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function renderOgCard({ title, subtitle, chips }: { title: string; subtitle: string; chips: string[] }) {
  const logo = await logoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #021b2e 0%, #05304a 100%)",
          color: "#ffffff",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -140,
            top: -140,
            width: 520,
            height: 520,
            borderRadius: 260,
            background: "rgba(0, 200, 117, 0.18)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
          <img src={logo} width={92} height={92} alt="" style={{ borderRadius: 22 }} />
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
            <div>pesito</div>
            <div style={{ color: "#00c875" }}>.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1056 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 34, lineHeight: 1.3, color: "#b6cddd" }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 700,
                color: "#021b2e",
                background: "#00c875",
                borderRadius: 999,
                padding: "10px 26px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
