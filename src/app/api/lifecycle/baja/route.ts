import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/lifecycle-send";

// Baja de los correos automáticos de ayuda (link firmado de cada correo). GET muestra una
// confirmación y POST la aplica: así un programa que "abre" los links de los mails no da de baja a nadie.

const page = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center"><div style="max-width:420px"><h1 style="font-size:22px">${title}</h1>${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const o = request.nextUrl.searchParams.get("o") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  if (!UUID.test(o) || !verifyUnsubscribeToken(o, t)) return page("Link inválido", "<p>Este link no es válido o venció.</p>", 400);
  return page(
    "¿Dejar de recibir estos correos?",
    `<p style="color:#555">Son los mensajes de ayuda de Pesito (primeros pasos, fin de la prueba). Los avisos de cobro del plan siguen llegando dentro de la app.</p><form method="post"><input type="hidden" name="o" value="${o}"><input type="hidden" name="t" value="${t}"><button style="padding:10px 18px;border-radius:10px;border:none;background:#059669;color:#fff;font-weight:600;cursor:pointer">Sí, no quiero recibirlos</button></form>`
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const o = String(form.get("o") ?? "");
  const t = String(form.get("t") ?? "");
  if (!UUID.test(o) || !verifyUnsubscribeToken(o, t)) return page("Link inválido", "<p>Este link no es válido o venció.</p>", 400);
  const { error } = await createAdminClient().from("lifecycle_optout").upsert({ org_id: o });
  if (error) {
    console.error("lifecycle_optout:", error.message);
    return page("No pudimos hacerlo", "<p>Probá de nuevo en un rato o escribinos a soporte@pesito.com.ar.</p>", 500);
  }
  return page("Listo", "<p>No te mandamos más estos correos.</p>");
}
