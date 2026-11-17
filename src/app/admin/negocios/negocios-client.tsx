"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { SEGMENTS, ago, inSegment, whatsappNumber, type AdminOrg, type SegmentId } from "@/lib/admin-shared";
import { planLabels, planOrder, type Plan } from "@/lib/subscription";
import { cn, formatDate } from "@/lib/utils";
import { updateOrgPlan } from "@/app/admin/actions";
import { addOrgNote, getOrgDetail, giveTrialDays, setOrgInternal, type OrgDetail } from "@/app/admin/negocios/actions";

type Sort = "reciente" | "venta" | "nombre";

function planChip(org: AdminOrg, now: number): { label: string; tone: string } {
  if (org.paymentStatus === "past_due") return { label: `${planLabels[org.plan as Plan] ?? org.plan} (cobro fallido)`, tone: "bg-danger-bg text-danger" };
  if (org.plan !== "gratis") return { label: planLabels[org.plan as Plan] ?? org.plan, tone: "bg-success-bg text-success" };
  if (org.trialEndsAt) {
    const active = new Date(org.trialEndsAt).getTime() > now;
    return { label: active ? "Prueba Pro" : "Prueba vencida", tone: active ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger" };
  }
  return { label: "Gratis", tone: "bg-muted text-muted-foreground" };
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

/** Lista de datos chicos (productos, marcas, proveedores) como etiquetas; se desenfocan con "Ocultar datos". */
function Chips({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="admin-sensitive flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-foreground">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function planNote(org: AdminOrg, now: number): string {
  if (org.internal && org.plan !== "gratis") return "cuenta propia (no cuenta como cliente)";
  if (org.plan === "gratis" && org.trialEndsAt) {
    const days = Math.ceil((new Date(org.trialEndsAt).getTime() - now) / 86_400_000);
    return days > 0 ? `quedan ${days} ${days === 1 ? "día" : "días"}` : `venció ${formatDate(org.trialEndsAt)}`;
  }
  if (org.plan !== "gratis") {
    const year = org.cycle === "anual";
    const left = org.periodEnd ? Math.ceil((new Date(org.periodEnd).getTime() - now) / 86_400_000) : null;
    const until = org.periodEnd ? `${left !== null && left <= 0 ? "venció" : "vence"} ${formatDate(org.periodEnd)}` : "";
    // Pago único o débito cancelado: no se renueva solo, se muestra hasta cuándo está pago.
    if (org.paymentStatus === "cancelled") {
      return org.hasDebit ? `débito cancelado · ${until}` : `pago único de ${year ? "1 año" : "1 mes"} · no se renueva solo · ${until}`;
    }
    if (org.hasDebit) return `débito automático ${year ? "anual" : "mensual"} · se renueva solo`;
    if (!org.paidViaMp) return "asignado a mano (no pagó)";
    return year ? "anual" : "mensual";
  }
  return "";
}

export function NegociosClient({ initialOrgs, now, initialSeg, initialOrgId }: { initialOrgs: AdminOrg[]; now: number; initialSeg: SegmentId; initialOrgId: string | null }) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [seg, setSeg] = useState<SegmentId>(initialSeg);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("reciente");
  const [selectedId, setSelectedId] = useState<string | null>(initialOrgId);

  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.id, orgs.filter((o) => inSegment(o, s.id, now)).length])) as Record<SegmentId, number>, [orgs, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const list = orgs.filter((o) => {
      if (!inSegment(o, seg, now)) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.ownerName ?? "").toLowerCase().includes(q) ||
        (o.ownerEmail ?? "").toLowerCase().includes(q) ||
        (qDigits.length >= 4 && (o.phone ?? "").replace(/\D/g, "").includes(qDigits))
      );
    });
    const byDate = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    return [...list].sort((a, b) =>
      sort === "nombre" ? a.name.localeCompare(b.name, "es") : sort === "venta" ? byDate(b.lastSaleAt) - byDate(a.lastSaleAt) : byDate(b.createdAt) - byDate(a.createdAt)
    );
  }, [orgs, seg, query, sort, now]);

  const { page, pageSize, start, end, setPage, setPageSize } = usePagination(filtered.length, `${seg}|${query}|${sort}`, "admin-negocios-page-size", 25);
  const visible = filtered.slice(start, end);
  const selected = orgs.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Negocios</h1>
          <p className="text-sm text-muted-foreground">Todos los que se registraron, qué hicieron y cómo contactarlos.</p>
        </div>
        <Link href="/admin/export/clientes">
          <Button variant="outline" size="sm">Exportar la lista (CSV)</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Segmentos">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={seg === s.id}
            onClick={() => setSeg(s.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
              seg === s.id ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            {s.label} <span className="opacity-70">{counts[s.id]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por negocio, dueño, email o teléfono…" className="pl-9" />
              </div>
              <div className="w-48">
                <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
                  <option value="reciente">Más nuevos primero</option>
                  <option value="venta">Última venta</option>
                  <option value="nombre">Por nombre</option>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[620px] divide-y divide-border text-sm">
                <div className="grid grid-cols-[2.2fr_1.2fr_1.6fr_1fr] gap-3 px-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span>Negocio</span><span>Plan</span><span>Uso</span><span>Última venta</span>
                </div>
                {visible.length === 0 && <p className="px-2 py-8 text-center text-muted-foreground">No hay negocios con ese filtro.</p>}
                {visible.map((o) => {
                  const chip = planChip(o, now);
                  const note = planNote(o, now);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={cn("grid w-full grid-cols-[2.2fr_1.2fr_1.6fr_1fr] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50", selectedId === o.id && "bg-accent/60")}
                    >
                      <span className="min-w-0">
                        <span className="admin-sensitive block truncate font-semibold text-foreground">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{`${o.type} · alta ${ago(o.createdAt, now)}`}</span>
                      </span>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", chip.tone)}>{chip.label}</span>
                        {note && <span className="text-xs text-muted-foreground">{note}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{`${o.productCount} productos · ${o.saleCount} ventas`}</span>
                      <span className={cn("text-xs font-semibold", o.saleCount === 0 ? "text-warning" : "text-foreground")}>{o.lastSaleAt ? ago(o.lastSaleAt, now) : "—"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <PaginationBar total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} noun="negocios" />
          </CardContent>
        </Card>

        <div className="lg:w-[400px] lg:shrink-0 xl:w-[440px]">
          {selected ? (
            <Ficha
              key={selected.id}
              org={selected}
              now={now}
              onChange={(patch) => setOrgs((cur) => cur.map((o) => (o.id === selected.id ? { ...o, ...patch } : o)))}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Elegí un negocio para ver su ficha: contacto, plan, qué hizo y notas.</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Ficha({ org, now, onChange }: { org: AdminOrg; now: number; onChange: (patch: Partial<AdminOrg>) => void }) {
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getOrgDetail(org.id).then(
      (d) => {
        if (!cancelled) {
          setDetail(d);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [org.id]);

  const chip = planChip(org, now);
  const wa = whatsappNumber(org.phone);
  const firstName = (org.ownerName ?? "").split(" ")[0];
  const waText = encodeURIComponent(`Hola${firstName ? ` ${firstName}` : ""}, soy Tadeo de Pesito. Vi que te registraste con ${org.name}. ¿Cómo te está yendo? Si necesitás una mano para arrancar, avisame.`);
  const trialLeftDays = org.plan === "gratis" && org.trialEndsAt ? Math.ceil((new Date(org.trialEndsAt).getTime() - now) / 86_400_000) : null;

  function give(days: number) {
    setMessage(null);
    startTransition(async () => {
      const res = await giveTrialDays(org.id, days);
      if (res.error || !res.trialEndsAt) {
        setMessage({ text: res.error ?? "No pudimos dar los días.", tone: "error" });
        return;
      }
      onChange({ trialEndsAt: res.trialEndsAt });
      if (res.note) setDetail((d) => (d ? { ...d, notes: [res.note!, ...d.notes] } : d));
      setMessage({ text: `Listo: ${days} días más de prueba Pro (hasta el ${formatDate(res.trialEndsAt)}).`, tone: "ok" });
    });
  }

  function assign(plan: Plan) {
    setMessage(null);
    startTransition(async () => {
      const res = await updateOrgPlan(org.id, plan);
      if (res.error) {
        setMessage({ text: res.error, tone: "error" });
        return;
      }
      onChange({ plan, ...(plan !== "gratis" ? { trialEndsAt: null } : {}) });
      setMessage({ text: `Ahora está en el Plan ${planLabels[plan]}. No se cobró nada.`, tone: "ok" });
    });
  }

  function saveNote() {
    if (!noteText.trim()) return;
    startTransition(async () => {
      const res = await addOrgNote(org.id, noteText);
      if (res.error || !res.note) {
        setMessage({ text: res.error ?? "No pudimos guardar la nota.", tone: "error" });
        return;
      }
      setDetail((d) => (d ? { ...d, notes: [res.note!, ...d.notes] } : d));
      setNoteText("");
    });
  }

  return (
    <Card className="border-2 border-primary">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="admin-sensitive truncate text-lg font-bold text-foreground">{org.name}</h2>
            <p className="text-xs text-muted-foreground">{`${org.type} · alta el ${formatDate(org.createdAt)}`}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", chip.tone)}>{chip.label}</span>
        </div>

        <section className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Contacto</h3>
          <div className="admin-sensitive space-y-0.5 text-sm text-foreground">
            <p>{org.ownerName ?? "Dueño sin nombre"}</p>
            <p className="break-all text-muted-foreground">{org.ownerEmail ?? "Sin email"}</p>
            <p className="text-muted-foreground">{org.phone ?? "Sin teléfono"}</p>
            <p className="text-xs text-muted-foreground">{org.lastSignIn ? `Entró por última vez ${ago(org.lastSignIn, now)}` : "Todavía no volvió a entrar"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={`https://wa.me/${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
                Escribir por WhatsApp
              </a>
            )}
            {org.ownerEmail && (
              <a href={`mailto:${org.ownerEmail}`} className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                Mandar un mail
              </a>
            )}
          </div>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Plan y prueba</h3>
          {trialLeftDays !== null && (
            <p className="text-sm text-foreground">
              {trialLeftDays > 0 ? `Prueba Pro hasta el ${formatDate(org.trialEndsAt!)} · ` : `La prueba Pro venció el ${formatDate(org.trialEndsAt!)} · `}
              <b>{trialLeftDays > 0 ? `quedan ${trialLeftDays} ${trialLeftDays === 1 ? "día" : "días"}` : "ya no está activa"}</b>
            </p>
          )}
          {org.plan !== "gratis" && (
            <div className="space-y-0.5">
              <p className="text-sm text-foreground">{`Plan ${planLabels[org.plan as Plan] ?? org.plan}${org.invoicePack ? ` · paquete de ${org.invoicePack} facturas` : ""}`}</p>
              {planNote(org, now) && <p className="text-xs text-muted-foreground">{`Forma de pago: ${planNote(org, now)}`}</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {org.plan === "gratis" && (
              <>
                {[7, 14, 30].map((d) => (
                  <Button key={d} type="button" variant="outline" size="sm" disabled={pending} onClick={() => give(d)}>{`Dar ${d} días`}</Button>
                ))}
              </>
            )}
            <div className="w-40">
              <Select value={org.plan} disabled={pending} onChange={(e) => assign(e.target.value as Plan)} aria-label="Asignar un plan a mano">
                {planOrder.map((p) => (
                  <option key={p} value={p}>{`Plan ${planLabels[p]}`}</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Dar días o asignar un plan no cobra nada y queda anotado.</p>
          <label className="flex cursor-pointer items-start gap-2 pt-1 text-sm text-foreground">
            <input
              type="checkbox"
              checked={org.internal}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.checked;
                setMessage(null);
                startTransition(async () => {
                  const res = await setOrgInternal(org.id, next);
                  if (res.error) setMessage({ text: res.error, tone: "error" });
                  else {
                    onChange({ internal: next });
                    setMessage({ text: next ? "Marcado como cuenta propia: ya no cuenta como cliente que paga." : "Ya cuenta como un cliente más.", tone: "ok" });
                  }
                });
              }}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              Es una cuenta propia o de prueba
              <span className="block text-xs text-muted-foreground">No cuenta en “Pagan”, el embudo ni el remarketing.</span>
            </span>
          </label>
          {message && <p className={cn("rounded-lg px-3 py-2 text-sm", message.tone === "ok" ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>{message.text}</p>}
        </section>

        <section className="space-y-2.5 border-t border-border pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">A qué se dedica</h3>
          <p className="text-sm text-foreground">
            <b>{org.type}</b>
            {detail && detail.profile.branches > 1 ? ` · ${detail.profile.branches} sucursales` : ""}
            {detail && detail.profile.debtors > 0 ? ` · fía a ${detail.profile.debtors} ${detail.profile.debtors === 1 ? "cliente" : "clientes"}` : ""}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : detail ? (
            <div className="space-y-2.5">
              <Chips
                title={detail.profile.topProducts.length > 0 ? "Lo que más vende" : "Algunos productos cargados"}
                items={detail.profile.topProducts.length > 0 ? detail.profile.topProducts.map((p) => `${p.name} (${p.units.toLocaleString("es-AR")})`) : detail.profile.recentProducts}
                empty="Todavía no cargó productos."
              />
              <Chips title="Marcas con más productos" items={detail.profile.topBrands.map((b) => `${b.name} (${b.count})`)} empty="Sin marcas cargadas." />
              <Chips title="Proveedores" items={detail.profile.suppliers} empty="Sin proveedores cargados." />
              {detail.profile.salesSampled > 0 && (
                <p className="text-xs text-muted-foreground">
                  {`En sus últimas ${detail.profile.salesSampled} ventas: ticket promedio ${money(detail.profile.avgTicket ?? 0)}`}
                  {detail.profile.paymentMix.length > 0 ? ` · cobra ${detail.profile.paymentMix.map((m) => `${m.label.toLowerCase()} ${m.pct}%`).join(", ")}` : ""}
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Qué hizo</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(detail?.usage ?? []).map((u) => (
                <div key={u.label} className="rounded-lg bg-muted/60 px-2.5 py-2">
                  <p className="text-lg font-bold leading-tight text-foreground">{u.value}</p>
                  <p className="text-[11px] text-muted-foreground">{u.label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Línea de tiempo</h3>
          {!loading && (detail?.timeline.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>}
          {(detail?.timeline ?? []).map((t, i) => (
            <p key={`${t.at}-${i}`} className="grid grid-cols-[78px_1fr] gap-2 text-sm leading-snug">
              <span className="text-muted-foreground">{ago(t.at, now)}</span>
              <span className="text-foreground">{t.what}</span>
            </p>
          ))}
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notas internas</h3>
          {detail && !detail.notesAvailable && <p className="text-xs text-warning">Falta aplicar la migración 0091 para guardar notas.</p>}
          {(detail?.notes ?? []).map((n) => (
            <div key={n.id} className="admin-sensitive rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed">
              <p className="text-foreground">{n.body}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
            </div>
          ))}
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Con quién hablaste, qué acordaron…"
            aria-label="Nueva nota"
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Button type="button" size="sm" variant="outline" disabled={pending || !noteText.trim()} onClick={saveNote}>
            Guardar la nota
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
