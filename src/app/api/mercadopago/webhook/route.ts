import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/mercadopago";
import { syncFromMercadoPago } from "@/lib/billing";

// Avisos de Mercado Pago (suscripciones y sus cobros). Se verifica la firma
// (MP_WEBHOOK_SECRET) y después se consulta la API con nuestro token: lo
// que manda el aviso no se usa directamente. Responde 200 rápido; si algo
// falla responde 500 y Mercado Pago reintenta.
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    topic?: string;
    data?: { id?: string | number };
  };
  const topic = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);

  const signature = verifyWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (signature === false) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignored: "sin id" });

  try {
    const orgId = await syncFromMercadoPago(topic, dataId);
    return NextResponse.json({ ok: true, handled: Boolean(orgId) });
  } catch (e) {
    console.error("Webhook de Mercado Pago", topic, dataId, e);
    return NextResponse.json({ error: "no pudimos procesarlo" }, { status: 500 });
  }
}
