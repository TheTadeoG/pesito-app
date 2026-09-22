import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KioscoForm } from "@/app/onboarding/kiosco-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/pos");
  }

  const initialName =
    typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Creá tu cuenta</CardTitle>
          <CardDescription>
            Último paso: contanos sobre tu negocio para configurar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KioscoForm initialName={initialName} />
        </CardContent>
      </Card>
    </div>
  );
}
