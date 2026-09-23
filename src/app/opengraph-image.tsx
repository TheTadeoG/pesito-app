import { ImageResponse } from "next/og";

// Imagen OG por defecto para todo el sitio — Next.js la usa como fallback
// para cualquier ruta que no defina la suya propia (ninguna la define
// hoy, así que ésta aplica a todas). Sin esto, compartir un link de
// Pesito en WhatsApp/Twitter/LinkedIn no mostraba ninguna imagen.
export const alt = "Pesito — sistema de punto de venta para el comercio de barrio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #047857 0%, #059669 55%, #10b981 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "rgba(255,255,255,0.16)",
            }}
          >
            <div style={{ fontSize: 56, color: "#ffffff" }}>$</div>
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#ffffff" }}>
            <div>pesito</div>
            <div style={{ color: "#bbf7d0" }}>.</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: "rgba(255,255,255,0.92)",
            maxWidth: 860,
            textAlign: "center",
          }}
        >
          Punto de venta, inventario, clientes y caja para el comercio de barrio
        </div>
      </div>
    ),
    { ...size }
  );
}
