import Link from "next/link";
import { Lock } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PosClient } from "@/app/(dashboard)/pos/pos-client";

export default async function PosPage() {
  const { userId, organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: openRegister } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!openRegister) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Lock className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">
            Abrí tu caja para empezar a vender
          </h2>
          <p className="text-sm text-muted-foreground">
            Necesitás abrir la caja del día antes de poder cobrar ventas.
          </p>
          <Link href="/caja">
            <Button className="mt-2">Abrir Mi Caja</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const [{ data: products }, { data: customers }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, sku, price, stock, unit")
      .eq("org_id", organization.id)
      .eq("active", true)
      .order("name")
      .limit(500),
    supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", organization.id)
      .order("name")
      .limit(300),
  ]);

  return (
    <PosClient
      orgId={organization.id}
      cashRegisterId={openRegister.id}
      products={(products ?? []).map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) }))}
      customers={customers ?? []}
    />
  );
}
