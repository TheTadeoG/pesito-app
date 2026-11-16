import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoIcon } from "@/components/marketing/logo-icon";
import { Wordmark } from "@/components/marketing/wordmark";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav, type AdminNavItem } from "@/app/admin/admin-nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
  const now = Date.now();
  // Lo que pide atención, para las insignias del menú. Si falta alguna migración, esa cuenta queda en 0.
  const [{ count: feedbackNew }, { count: errorsOpen }, { count: trialsEnding }] = await Promise.all([
    admin.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("app_errors").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin
      .from("organization_subscriptions")
      .select("org_id", { count: "exact", head: true })
      .eq("plan", "gratis")
      .gt("pro_trial_ends_at", new Date(now).toISOString())
      .lte("pro_trial_ends_at", new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const items: AdminNavItem[] = [
    { href: "/admin", label: "Resumen", badge: trialsEnding ?? 0 },
    { href: "/admin/negocios", label: "Negocios" },
    { href: "/admin/remarketing", label: "Remarketing" },
    { href: "/admin/mensajes", label: "Mensajes", badge: feedbackNew ?? 0 },
    { href: "/admin/errores", label: "Errores", badge: errorsOpen ?? 0 },
    { href: "/admin/resenas", label: "Reseñas" },
    { href: "/admin/precios", label: "Precios" },
    { href: "/admin/contenido", label: "Estadísticas y contenido" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <LogoIcon />
          <Wordmark className="text-xl" />
          <span className="ml-1 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Panel interno
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}>
            <Button variant="outline" size="icon" aria-label="Cerrar sesión" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
        <aside className="lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <AdminNav items={items} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
