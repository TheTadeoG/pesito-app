"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { AUDIENCES, ago, fillTemplate, inSegment, whatsappNumber, type AdminOrg, type SegmentId } from "@/lib/admin-shared";
import { cn } from "@/lib/utils";
import { giveTrialDays } from "@/app/admin/negocios/actions";
import { logContact } from "@/app/admin/remarketing/actions";

export interface ContactLog {
  at: string;
  who: string;
  what: string;
}

interface Props {
  initialOrgs: AdminOrg[];
  now: number;
  lastContacts: Record<string, { at: string; kind: string }>;
  log: ContactLog[];
  giftStats: { last30: number; orgs: number; converted: number };
  emails: { enabled: boolean; kinds: { kind: string; name: string; when: string; sent: number }[] };
  contactsAvailable: boolean;
}

const toneBorder = { warning: "border-l-warning", info: "border-l-primary", danger: "border-l-danger", success: "border-l-primary" } as const;

export function RemarketingClient({ initialOrgs, now, lastContacts: initialContacts, log, giftStats: initialGifts, emails, contactsAvailable }: Props) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [selected, setSelected] = useState<SegmentId>("prueba-por-vencer");
  const [contacts, setContacts] = useState(initialContacts);
  const [gifts, setGifts] = useState(initialGifts);
  const [templates, setTemplates] = useState<Record<string, string>>(() => Object.fromEntries(AUDIENCES.map((a) => [a.id, a.template])));
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => Object.fromEntries(AUDIENCES.map((a) => [a.id, orgs.filter((o) => inSegment(o, a.id, now)).length])) as Record<SegmentId, number>, [orgs, now]);
  const audience = AUDIENCES.find((a) => a.id === selected) ?? AUDIENCES[0];
  const list = useMemo(() => orgs.filter((o) => inSegment(o, audience.id, now)), [orgs, audience.id, now]);
  const { page, pageSize, start, end, setPage, setPageSize } = usePagination(list.length, audience.id, "admin-remarketing-page-size", 25);
  const visible = list.slice(start, end);

  function markContacted(org: AdminOrg, kind: "whatsapp" | "mail") {
    // Se anota sin frenar el link: si falla, sólo no queda registro.
    void logContact(org.id, kind, audience.id).then((res) => {
      if (res.at) setContacts((c) => ({ ...c, [org.id]: { at: res.at!, kind } }));
    });
  }

  function gift(org: AdminOrg, days: number) {
    setMessage(null);
    startTransition(async () => {
      const res = await giveTrialDays(org.id, days, audience.id);
      if (res.error || !res.trialEndsAt) {
        setMessage({ text: res.error ?? "No pudimos dar los días.", tone: "error" });
        return;
      }
      setOrgs((cur) => cur.map((o) => (o.id === org.id ? { ...o, trialEndsAt: res.trialEndsAt! } : o)));
      setGifts((g) => ({ ...g, last30: g.last30 + 1 }));
      setMessage({ text: `Listo: ${org.name} tiene ${days} días más de prueba Pro.`, tone: "ok" });
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Remarketing y pruebas</h1>
        <p className="text-sm text-muted-foreground">A quién escribirle hoy, con qué mensaje, y a quién regalarle días de prueba.</p>
      </div>

      {!contactsAvailable && (
        <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-foreground">
          Falta aplicar la migración 0092 en Supabase: sin ella no se anotan los contactos ni las pruebas regaladas.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={selected === a.id}
            onClick={() => setSelected(a.id)}
            className={cn(
              "flex flex-col gap-1.5 rounded-2xl border border-l-4 bg-card p-4 text-left transition-colors hover:bg-muted/40",
              toneBorder[a.tone],
              selected === a.id ? "border-primary ring-2 ring-primary/30" : "border-border"
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-sm font-bold leading-snug text-foreground">{a.title}</span>
              <span className="text-2xl font-bold leading-none text-foreground">{counts[a.id]}</span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">{a.sub}</span>
            <span className="text-xs font-bold text-primary">{a.action}</span>
          </button>
        ))}
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1 border-2 border-primary">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">
                {audience.title} <span className="font-medium text-muted-foreground">{`· ${list.length} ${list.length === 1 ? "negocio" : "negocios"}`}</span>
              </h2>
              <Link href={`/admin/negocios?seg=${audience.id}`} className="text-sm font-medium text-primary hover:underline">Ver en Negocios</Link>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3.5">
              <label htmlFor="rm-template" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mensaje (se completa con los datos de cada negocio)</label>
              <textarea
                id="rm-template"
                value={templates[audience.id]}
                onChange={(e) => setTemplates((t) => ({ ...t, [audience.id]: e.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Se completa solo: {"{nombre}"} {"{negocio}"} {"{dias}"} {"{uso}"}</span>
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setTemplates((t) => ({ ...t, [audience.id]: audience.template }))}>
                  Volver al mensaje original
                </button>
              </div>
            </div>

            {message && <p className={cn("rounded-lg px-3 py-2 text-sm", message.tone === "ok" ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>{message.text}</p>}

            <div className="overflow-x-auto">
              <div className="min-w-[640px] divide-y divide-border text-sm">
                <div className="grid grid-cols-[2fr_1.5fr_1.2fr_1.8fr] gap-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span>Negocio</span><span>Uso</span><span>Último contacto</span><span>Acción</span>
                </div>
                {visible.length === 0 && <p className="py-8 text-center text-muted-foreground">No hay negocios en esta lista.</p>}
                {visible.map((o) => {
                  const text = fillTemplate(templates[audience.id], o, now);
                  const wa = whatsappNumber(o.phone);
                  const last = contacts[o.id];
                  return (
                    <div key={o.id} className="grid grid-cols-[2fr_1.5fr_1.2fr_1.8fr] items-center gap-3 py-3">
                      <Link href={`/admin/negocios?org=${o.id}`} className="min-w-0">
                        <span className="admin-sensitive block truncate font-semibold text-foreground hover:underline">{o.name}</span>
                        <span className="admin-sensitive block truncate text-xs text-muted-foreground">{`${o.ownerName ?? "Dueño sin nombre"} · alta ${ago(o.createdAt, now)}`}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {`${o.productCount} productos · ${o.saleCount} ventas`}
                        {o.lastSaleAt ? <span className="block">{`Última venta ${ago(o.lastSaleAt, now)}`}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{last ? `${last.kind === "whatsapp" ? "WhatsApp" : "Mail"} ${ago(last.at, now)}` : "Nunca"}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {wa ? (
                          <a
                            href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markContacted(o, "whatsapp")}
                            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground hover:opacity-90"
                          >
                            WhatsApp
                          </a>
                        ) : (
                          <span className="rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">Sin teléfono</span>
                        )}
                        {o.ownerEmail && (
                          <a
                            href={`mailto:${o.ownerEmail}?subject=${encodeURIComponent("Pesito")}&body=${encodeURIComponent(text)}`}
                            onClick={() => markContacted(o, "mail")}
                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                          >
                            Mail
                          </a>
                        )}
                        {audience.canGiftTrial && (
                          <button type="button" disabled={pending} onClick={() => gift(o, 7)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
                            +7 días
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <PaginationBar total={list.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} noun="negocios" />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:w-[360px] lg:shrink-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pruebas regaladas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: gifts.last30, l: "en 30 días" },
                  { v: gifts.orgs, l: "negocios" },
                  { v: gifts.orgs > 0 ? `${Math.round((gifts.converted / gifts.orgs) * 100)}%` : "—", l: "terminaron pagando" },
                ].map((s) => (
                  <div key={s.l} className="rounded-lg bg-muted/60 px-2.5 py-2">
                    <p className="text-xl font-bold leading-tight text-foreground">{s.v}</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">{s.l}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Cada prueba regalada se anota con quién la dio y se mide si el negocio terminó pagando. También se pueden dar 7, 14 o 30 días desde la ficha de cada negocio.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Correos automáticos</CardTitle>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", emails.enabled ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>{emails.enabled ? "Prendidos" : "Apagados"}</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {emails.kinds.map((k) => (
                <div key={k.kind} className="flex items-start justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                  <span>
                    <span className="block font-semibold text-foreground">{k.name}</span>
                    <span className="block text-xs text-muted-foreground">{k.when}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{`${k.sent} enviados`}</span>
                </div>
              ))}
              {!emails.enabled && <p className="pt-1 text-xs text-muted-foreground">Se prenden cargando LIFECYCLE_EMAILS_ENABLED=true en Vercel (ver PROGRESS.md).</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos contactos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {log.length === 0 && <p className="text-sm text-muted-foreground">Todavía no anotaste ningún contacto.</p>}
              {log.map((c, i) => (
                <p key={`${c.at}-${i}`} className="grid grid-cols-[72px_1fr] gap-2 text-sm leading-snug">
                  <span className="text-muted-foreground">{ago(c.at, now)}</span>
                  <span className="text-foreground">
                    <b className="admin-sensitive">{c.who}</b> · {c.what}
                  </span>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
