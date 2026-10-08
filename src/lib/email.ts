// Envío de emails desde el servidor con la API de Resend (los de Supabase Auth
// salen por SMTP aparte). Es opcional: sin RESEND_API_KEY no hace nada.
// Sólo servidor.
const FROM = "Pesito <no-responder@pesito.com.ar>";

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [input.to], subject: input.subject, text: input.text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("Resend", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("Resend", e);
    return false;
  }
}
