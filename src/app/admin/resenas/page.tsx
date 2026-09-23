import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { TestimonialsManager } from "@/app/admin/resenas/testimonials-manager";

export default async function ResenasAdminPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("testimonials")
    .select("id, name, location, business_type, rating, quote, published")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a /admin
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">Reseñas</h1>
        <p className="text-sm text-muted-foreground">
          Lo que se muestra en la sección de reseñas de la landing.
        </p>
      </div>

      <TestimonialsManager
        testimonials={(data ?? []).map((t) => ({ ...t, rating: Number(t.rating) }))}
      />
    </div>
  );
}
