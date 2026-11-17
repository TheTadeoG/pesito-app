"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { UsuariosClient } from "@/app/(dashboard)/usuarios/usuarios-client";

const members = [
  { id: "u1", user_id: "me", role: "owner", email: "dueno@ejemplo.com", username: null, created_at: "2026-01-01T00:00:00Z", branch_id: "b1" },
  { id: "u2", user_id: "u2", role: "vendedor", email: null, username: "lucia", created_at: "2026-03-01T00:00:00Z", branch_id: "b1" },
];

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div id="shot" className="mx-auto min-h-[560px] max-w-4xl bg-background p-4">
        <UsuariosClient
          members={members as never}
          invitations={[{ id: "i1", code: "abc123", role: "vendedor", created_at: "2026-11-10T00:00:00Z", expires_at: "2026-12-10T00:00:00Z" }] as never}
          currentUserId="me"
          siteUrl="https://pesito.com.ar"
          branches={[{ id: "b1", name: "Casa central", is_main: true }]}
          usersLimit={6}
          planName="Plan Pro"
          pausedIds={[]}
          pausingSoon={null}
        />
      </div>
    </ToastProvider>
  );
}
