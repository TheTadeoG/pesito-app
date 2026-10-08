"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { submitFeedback } from "@/app/(dashboard)/feedback/actions";
import { FEEDBACK_MAX, FEEDBACK_MIN, type FeedbackKind } from "@/lib/feedback";
import { whatsappLink } from "@/lib/whatsapp";

const copy: Record<
  FeedbackKind,
  { title: string; description: string; label: string; placeholder: string; thanks: string }
> = {
  suggestion: {
    title: "Contanos qué te falta",
    description: "Una función que te serviría o algo que se puede mejorar. Lo leemos todo.",
    label: "Tu sugerencia",
    placeholder: "Por ejemplo: me gustaría poder…",
    thanks: "Lo leemos todos. Si es algo que le sirve a muchos negocios, lo sumamos.",
  },
  problem: {
    title: "Reportar un problema",
    description: "Contanos qué pasó y en qué pantalla, así lo podemos revisar.",
    label: "¿Qué pasó?",
    placeholder: "Por ejemplo: al cobrar con tarjeta, me aparece un error…",
    thanks: "Lo vamos a revisar. Si es urgente, escribinos también por WhatsApp.",
  },
};

export function FeedbackDialog({
  kind,
  orgName,
  onClose,
}: {
  kind: FeedbackKind | null;
  orgName: string;
  onClose: () => void;
}) {
  // Se monta sólo mientras está abierto: cada apertura arranca con el formulario vacío.
  if (!kind) return null;
  return <FeedbackForm kind={kind} orgName={orgName} onClose={onClose} />;
}

function FeedbackForm({ kind, orgName, onClose }: { kind: FeedbackKind; orgName: string; onClose: () => void }) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const text = copy[kind];
  const length = message.trim().length;

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitFeedback({ kind, message, page: pathname });
      if (res.error) setError(res.error);
      else setSent(true);
    });
  }

  return (
    <Dialog open onClose={onClose} title={sent ? "¡Gracias!" : text.title} description={sent ? undefined : text.description}>
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-success-bg px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <p className="text-sm text-foreground">{`Recibimos tu mensaje. ${text.thanks}`}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {kind === "problem" && (
              <a
                href={whatsappLink(`Hola! Soy de ${orgName} y te acabo de reportar un problema en Pesito.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Escribir por WhatsApp
              </a>
            )}
            <Button type="button" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <div>
            <Label htmlFor="feedback-message" required>
              {text.label}
            </Label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={FEEDBACK_MAX}
              autoFocus
              required
              placeholder={text.placeholder}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{`${length} / ${FEEDBACK_MAX}`}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Junto con tu mensaje enviamos el nombre de tu negocio, tu email y la pantalla en la que estás, para poder
            responderte.
          </p>
          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || length < FEEDBACK_MIN}>
              {pending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
