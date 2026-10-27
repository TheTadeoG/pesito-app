import { requireOrgContext } from "@/lib/org";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { loadAlertSettings } from "@/lib/alert-settings";
import { alertValue } from "@/lib/alert-config";
import { loadMarketPrices, statsFor } from "@/lib/market-data";
import { diffPct, normalizeEan, pricePosition, suggestPrice, MARKET_STORES } from "@/lib/market-prices";
import { PricesTable, type PriceRow } from "./prices-table";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { businessTypes } from "@/lib/business-types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";

async function NotesSection({ orgId, allowed }: { orgId: string; allowed: boolean }) {
  const supabase = await createClient();
  if (!allowed) {
    return (
      <ProLockedCard
        title="Análisis de mercado"
        plan={featureMinPlan.marketAnalysis}
        preview="list"
        description="Novedades, precios de referencia y tendencias de tu rubro, preparadas por Pesito."
      />
    );
  }

  const { data, error } = await supabase.rpc("market_insights_for", { p_org_id: orgId });
  if (error) throw new Error("No pudimos cargar el análisis de mercado.");
  const notes = data ?? [];

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía no hay notas para tu rubro. Las vamos sumando: volvé pronto.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Información de mercado que reúne y revisa Pesito para tu rubro. Es orientativa: no
        reemplaza tus propios números.
      </p>
      {notes.map((n) => (
        <Card key={n.id}>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">{n.title}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {businessTypes.find((b) => b.value === n.business_type)?.label ?? "Todos los rubros"}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDate(n.published_at)}</span>
            </div>
            <p className="whitespace-pre-line text-sm text-foreground">{n.body}</p>
            {n.source && <p className="text-xs text-muted-foreground">{`Fuente: ${n.source}`}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function MercadoPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  const canPrices = canUse(subscription, "supermarketPrices");
  const insights = canUse(subscription, "marketPriceInsights");

  let prices: React.ReactNode;
  if (!canPrices) {
    prices = (
      <ProLockedCard
        title="Precios de supermercados"
        plan={featureMinPlan.supermarketPrices}
        preview="comparison"
        description="Mirá cuánto cuestan tus productos en Carrefour, Jumbo, Disco y Vea (por código de barras) y compará con tus precios."
      />
    );
  } else {
    const [settings, products] = await Promise.all([
      loadAlertSettings(supabase, organization.id),
      fetchAll((from, to) =>
        supabase
          .from("products")
          .select("id, name, brand, barcode, cost, price")
          .eq("org_id", organization.id)
          .eq("active", true)
          .order("name")
          .range(from, to)
      ),
    ]);
    const limits = { highPct: alertValue(settings, "market-expensive"), lowPct: alertValue(settings, "market-cheap") };
    const withEan = products.filter((p) => normalizeEan(p.barcode));
    const map = await loadMarketPrices(supabase, organization.id, withEan.map((p) => p.barcode));
    const rows: PriceRow[] = [];
    let lastMonth = "";
    for (const p of withEan) {
      const ean = normalizeEan(p.barcode) as string;
      const found = map.get(ean);
      const stats = statsFor(found);
      for (const r of found ?? []) if (r.month > lastMonth) lastMonth = r.month;
      const price = Number(p.price);
      const cost = p.cost === null ? null : Number(p.cost);
      if (!found || !stats) {
        // Todavía sin precios de súper: se lista igual (nombre y código), para poder buscarlo.
        rows.push({ id: p.id, name: p.name, brand: p.brand, ean, price, stores: {}, min: null, max: null, median: null, diff: null, position: null, suggested: null, reason: null });
        continue;
      }
      rows.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        ean,
        price,
        stores: Object.fromEntries(found.map((r) => [r.store, r.price])),
        min: stats.min,
        max: stats.max,
        median: stats.median,
        diff: price > 0 ? diffPct(price, stats) : null,
        position: price > 0 ? pricePosition(price, stats, limits) : null,
        suggested: insights ? suggestPrice(stats, cost).price : null,
        reason: insights ? suggestPrice(stats, cost).reason : null,
      });
    }
    // Para quien no tiene el Plan IA: cuántos hay, sin el detalle.
    const hiddenHigh = rows.filter((r) => r.position === "caro" || r.position === "muy-caro").length;
    const hiddenLow = rows.filter((r) => r.position === "barato" || r.position === "muy-barato").length;
    prices = (
      <PricesTable
        rows={insights ? rows : rows.map((r) => ({ ...r, diff: null, position: null }))}
        insights={insights}
        initialFilter={insights && (filtro === "caro" || filtro === "barato") ? filtro : "todos"}
        totalWithEan={withEan.length}
        totalProducts={products.length}
        lastMonth={lastMonth || null}
        stores={MARKET_STORES.map((s) => ({ id: s.id, label: s.label }))}
        locked={insights ? null : { plan: featureMinPlan.marketPriceInsights, high: hiddenHigh, low: hiddenLow }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">{prices}</section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Notas de tu rubro</h2>
        <NotesSection orgId={organization.id} allowed={canUse(subscription, "marketAnalysis")} />
      </section>
    </div>
  );
}
