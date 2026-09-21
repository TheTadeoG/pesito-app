import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KioscoForm } from "@/app/onboarding/kiosco-form";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Creá tu kiosco</CardTitle>
          <CardDescription>
            Último paso: contanos cómo se llama tu negocio para configurar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KioscoForm />
        </CardContent>
      </Card>
    </div>
  );
}
