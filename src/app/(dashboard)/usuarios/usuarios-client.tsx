"use client";

import { useState } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { roleLabels } from "@/lib/roles";
import { useToast } from "@/components/toast/toast-provider";
import {
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
} from "@/app/(dashboard)/usuarios/actions";

interface MemberRow {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "vendedor";
  email: string | null;
  created_at: string;
}

interface InvitationRow {
  id: string;
  code: string;
  role: "admin" | "vendedor";
  created_at: string;
  expires_at: string;
}

export function UsuariosClient({
  members,
  invitations,
  currentUserId,
  siteUrl,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
  siteUrl: string;
}) {
  const { showSuccess } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "vendedor">("vendedor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleInvite() {
    setInviting(true);
    setInviteError(null);
    const result = await createInvitation(inviteRole);
    setInviting(false);
    if (result.error || !result.code) {
      setInviteError(result.error ?? "No pudimos crear la invitación.");
      return;
    }
    setGeneratedLink(`${siteUrl}/invitacion/${result.code}`);
  }

  function closeInviteDialog() {
    setShowInvite(false);
    setInviteRole("vendedor");
    setInviteError(null);
    setGeneratedLink(null);
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      showSuccess("¡Link copiado!");
    } catch {
      // clipboard API bloqueada (permisos/http): no hay mucho más que hacer.
    }
  }

  async function handleRoleChange(membershipId: string, role: "admin" | "vendedor") {
    setBusyId(membershipId);
    await updateMemberRole(membershipId, role);
    setBusyId(null);
  }

  async function handleRemove(member: MemberRow) {
    if (!confirm(`¿Quitar a ${member.email ?? "este usuario"} del equipo?`)) return;
    setBusyId(member.id);
    await removeMember(member.id);
    setBusyId(null);
  }

  async function handleRevoke(invitationId: string) {
    setBusyId(invitationId);
    await revokeInvitation(invitationId);
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4" />
          Invitar usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu equipo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.map((member) => {
              const isSelf = member.user_id === currentUserId;
              const isOwner = member.role === "owner";
              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.email ?? "Sin email"}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(vos)</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <Badge tone="accent">{roleLabels.owner}</Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value as "admin" | "vendedor")
                        }
                        disabled={busyId === member.id || isSelf}
                        className="h-9 w-40"
                      >
                        <option value="admin">{roleLabels.admin}</option>
                        <option value="vendedor">{roleLabels.vendedor}</option>
                      </Select>
                    )}
                    {!isOwner && !isSelf && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemove(member)}
                        disabled={busyId === member.id}
                        aria-label="Quitar"
                        title="Quitar del equipo"
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Invitación como {roleLabels[inv.role]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expira el {new Date(inv.expires_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(`${siteUrl}/invitacion/${inv.code}`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar link
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRevoke(inv.id)}
                      disabled={busyId === inv.id}
                      aria-label="Cancelar invitación"
                      title="Cancelar invitación"
                    >
                      <X className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showInvite}
        onClose={closeInviteDialog}
        title="Invitar usuario"
        description="Generá un link para que se sume a tu equipo con el rol que elijas."
      >
        {generatedLink ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compartile este link a tu empleado (por WhatsApp, por ejemplo). Vale por 7 días y se
              usa una sola vez.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {generatedLink}
              </span>
              <Button type="button" size="sm" onClick={() => copyLink(generatedLink)}>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={closeInviteDialog}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Rol</label>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "vendedor")}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {inviteRole === "admin"
                  ? "Puede gestionar productos, clientes, proveedores y también invitar y gestionar usuarios."
                  : "Puede vender, cargar compras y ver el catálogo, sin gestionar el equipo."}
              </p>
            </div>

            {inviteError && (
              <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
                {inviteError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeInviteDialog}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleInvite} disabled={inviting}>
                {inviting ? "Generando…" : "Generar link"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
