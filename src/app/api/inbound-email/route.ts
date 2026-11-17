import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { buildForward, isForSupport, verifySvixSignature } from "@/lib/inbound-email";

// Correo que llega a soporte@pesito.com.ar (Resend Receiving): Resend avisa acá con un webhook firmado (`email.received`),
// se lee el mail completo con la API y se reenvía a la casilla del dueño (SUPPORT_FORWARD_TO). Todo lo demás que llegue al
// dominio queda sólo en el panel de Resend. Si algo falla responde 500 y Resend reintenta.
//
// Variables (Vercel): RESEND_API_KEY (ya está), RESEND_WEBHOOK_SECRET (el "Signing secret" del webhook, empieza con whsec_),
// SUPPORT_FORWARD_TO (la casilla de destino) y, si hiciera falta, SUPPORT_ADDRESS (por defecto soporte@pesito.com.ar).
const DEFAULT_SUPPORT_ADDRESS = "soporte@pesito.com.ar";

interface ReceivedEvent {
  type?: string;
  data?: { email_id?: string; to?: string[]; attachments?: unknown[] };
}

interface ReceivedEmail {
  from?: string;
  to?: string[];
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const forwardTo = process.env.SUPPORT_FORWARD_TO;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !forwardTo || !apiKey) {
    console.error("inbound-email: faltan RESEND_WEBHOOK_SECRET, SUPPORT_FORWARD_TO o RESEND_API_KEY");
    return NextResponse.json({ error: "no configurado" }, { status: 503 });
  }

  const body = await request.text();
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return NextResponse.json({ error: "firma inválida" }, { status: 401 });

  let event: ReceivedEvent;
  try {
    event = JSON.parse(body) as ReceivedEvent;
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: "otro evento" });

  const supportAddress = process.env.SUPPORT_ADDRESS || DEFAULT_SUPPORT_ADDRESS;
  if (!isForSupport(event.data.to, supportAddress)) return NextResponse.json({ ok: true, ignored: "no es para soporte" });

  let email: ReceivedEmail;
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.data.email_id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("inbound-email: no pudimos leer el mail", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "no pudimos leer el mail" }, { status: 500 });
    }
    email = (await res.json()) as ReceivedEmail;
  } catch (e) {
    console.error("inbound-email: leer el mail", e);
    return NextResponse.json({ error: "no pudimos leer el mail" }, { status: 500 });
  }

  const forward = buildForward({
    from: email.from ?? "",
    to: email.to ?? event.data.to ?? [],
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachmentCount: event.data.attachments?.length ?? 0,
  });
  const sent = await sendEmail({ to: forwardTo, subject: forward.subject, text: forward.text, html: forward.html, replyTo: forward.replyTo });
  if (!sent) return NextResponse.json({ error: "no pudimos reenviar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
