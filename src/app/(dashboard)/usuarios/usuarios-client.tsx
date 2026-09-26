"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Info, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { roleLabels } from "@/lib/roles";
import { useToast } from "@/components/toast/toast-provider";
import {
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  createDirectMember,
  updateMemberCredentials,
} from "@/app/(dashboard)/usuarios/actions";
import { setMemberBranch } from "@/lib/actions/branches";

interface MemberRow {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "vendedor";
  email: string | null;
  username: string | null;
  created_at: string;
  branch_id?: string | null;
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
  branches,
  usersLimit,
  planName,
}: {
  usersLimit: number;
  planName: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
  siteUrl: string;
  branches: { id: string; name: string; is_main: boolean }[];
}) {
  const mainBranchId = branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "";
  const router = useRouter();
  const { showSuccess } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "vendedor">("vendedor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showDirectCreate, setShowDirectCreate] = useState(false);
  const [directUsername, setDirectUsername] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directRole, setDirectRole] = useState<"admin" | "vendedor">("vendedor");
  const [directCreating, setDirectCreating] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directCreated, setDirectCreated] = useState<{ username: string; password: string } | null>(
    null
  );

  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<{ username: string; password: string | null } | null>(
    null
  );

  // El equipo puede sumar gente desde otro dispositivo (acepta una
  // invitación, o el dueño crea un usuario interno en otra pestaña) sin que
  // esta pantalla se entere sola. Como no hay nada abierto (diálogos) que
  // el refresh pueda interrumpir, refrescamos solos: al volver a la
  // pestaña (visibilitychange/focus, que ya cubre el caso típico de "volví
  // a esta tab") y cada 60s como red de contención mientras queda abierta
  // en primer plano — no hace falta cada 10s para algo que cambia con poca
  // frecuencia (alguien se suma al equipo).
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") router.refresh();
    }
    const interval = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

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

  async function copyText(text: string, message = "¡Copiado!") {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(message);
    } catch {
      // clipboard API bloqueada (permisos/http): no hay mucho más que hacer.
    }
  }

  async function handleRoleChange(membershipId: string, role: "admin" | "vendedor") {
    setBusyId(membershipId);
    await updateMemberRole(membershipId, role);
    setBusyId(null);
  }

  async function handleBranchChange(membershipId: string, branchId: string) {
    setBusyId(membershipId);
    const result = await setMemberBranch(membershipId, branchId);
    setBusyId(null);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  async function handleRemove(member: MemberRow) {
    const label = member.username ?? member.email ?? "este usuario";
    if (
      !confirm(
        `¿Quitar a ${label} del equipo? Si tiene una caja abierta, se cierra automáticamente.`
      )
    )
      return;
    setBusyId(member.id);
    await removeMember(member.id);
    setBusyId(null);
  }

  async function handleRevoke(invitationId: string) {
    setBusyId(invitationId);
    await revokeInvitation(invitationId);
    setBusyId(null);
  }

  function closeDirectDialog() {
    setShowDirectCreate(false);
    setDirectUsername("");
    setDirectPassword("");
    setDirectRole("vendedor");
    setDirectError(null);
    setDirectCreated(null);
  }

  function generatePassword() {
    const chars = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setDirectPassword(out);
  }

  async function handleDirectCreate() {
    setDirectCreating(true);
    setDirectError(null);
    const result = await createDirectMember(directUsername, directPassword, directRole);
    setDirectCreating(false);
    if (result.error || !result.username) {
      setDirectError(result.error ?? "No pudimos crear el usuario.");
      return;
    }
    setDirectCreated({ username: result.username, password: directPassword });
  }

  function openEdit(member: MemberRow) {
    setEditingMember(member);
    setEditUsername(member.username?.split("#")[0] ?? "");
    setEditPassword("");
    setEditError(null);
    setEditResult(null);
  }

  function closeEditDialog() {
    setEditingMember(null);
    setEditUsername("");
    setEditPassword("");
    setEditError(null);
    setEditResult(null);
  }

  function generateEditPassword() {
    const chars = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setEditPassword(out);
  }

  async function handleEditSave() {
    if (!editingMember) return;
    setEditSaving(true);
    setEditError(null);
    const result = await updateMemberCredentials(editingMember.id, editUsername, editPassword);
    setEditSaving(false);
    if (result.error || !result.username) {
      setEditError(result.error ?? "No pudimos guardar los cambios.");
      return;
    }
    setEditResult({ username: result.username, password: result.password ?? null });
  }

  const usersUsed = members.length + invitations.length;
  const hasBranches = branches.length > 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-5 py-5 lg:grid-cols-3">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4 text-muted-foreground" />
              Rol: qué puede hacer cada uno
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">{`${roleLabels.owner}: `}</span>
                todo. Hay uno solo por negocio y nadie le puede cambiar el rol ni quitarlo.
              </li>
              <li>
                <span className="font-medium text-foreground">{`${roleLabels.admin}: `}</span>
                casi lo mismo que el dueño: gestiona usuarios, ve En vivo y los reportes de todo el
                equipo, y cambia de sucursal.
              </li>
              <li>
                <span className="font-medium text-foreground">{`${roleLabels.vendedor}: `}</span>
                vende, abre y cierra su propia caja, carga compras y clientes. No gestiona
                usuarios ni ve En vivo.
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Sucursal asignada</p>
            <p className="text-sm text-muted-foreground">
              {hasBranches
                ? "Es el local donde trabaja esa persona: su caja, sus ventas y el stock que descuenta son de esa sucursal. Los vendedores trabajan siempre en la suya; dueños y administradores pueden cambiar de sucursal desde el menú."
                : "Si sumás más locales (Plan IA), acá elegís en qué sucursal trabaja cada persona: su caja, sus ventas y el stock que descuenta."}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Cómo ingresa cada uno</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Usuario y contraseña: </span>
              lo creás vos, sin email (ej. juan#4821). Podés cambiarle la contraseña cuando quieras.
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Invitación por link: </span>
              la persona se registra con su propio email. El link vence a los 7 días.
            </p>
            <p className="pt-1 text-sm text-foreground">
              {`Usuarios: ${usersUsed} de ${usersLimit} (${planName}). Las invitaciones pendientes también cuentan.`}
            </p>
            {usersUsed > usersLimit && (
              <p className="rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">
                Tenés más usuarios de los que incluye tu plan: los que ya están siguen andando, pero
                para sumar otro tenés que pasar a un plan con más usuarios.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setShowDirectCreate(true)}>
          <UserPlus className="h-4 w-4" />
          Crear usuario y contraseña
        </Button>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4" />
          Invitar por link
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu equipo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="hidden items-center justify-between gap-3 px-5 py-2 text-xs font-medium text-muted-foreground sm:flex">
              <span>Persona y cómo ingresa</span>
              <span className="flex gap-2">
                {hasBranches && <span className="w-40">Sucursal asignada</span>}
                <span className="w-40">Rol</span>
                <span className="w-[5.5rem]" />
              </span>
            </div>
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
                      {member.username ?? member.email ?? "Sin email"}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(vos)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.username
                        ? "Ingresa con usuario y contraseña"
                        : "Ingresa con su email"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {branches.length > 1 && !isOwner && (
                      <div className="w-40">
                      <Select
                        value={member.branch_id ?? mainBranchId}
                        onChange={(e) => handleBranchChange(member.id, e.target.value)}
                        disabled={busyId === member.id}
                        className="h-9 w-40"
                        aria-label="Sucursal"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                      </div>
                    )}
                    {isOwner ? (
                      <Badge tone="accent">{roleLabels.owner}</Badge>
                    ) : (
                      <div className="w-40">
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
                      </div>
                    )}
                    {!isOwner && member.username && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(member)}
                        aria-label="Editar usuario y contraseña"
                        title="Editar usuario y contraseña"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                      onClick={() => copyText(`${siteUrl}/invitacion/${inv.code}`, "¡Link copiado!")}
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
              <Button type="button" size="sm" onClick={() => copyText(generatedLink, "¡Link copiado!")}>
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

      <Dialog
        open={showDirectCreate}
        onClose={closeDirectDialog}
        title="Crear usuario y contraseña"
        description="Para empleados que no usan email: elegís vos el usuario y la contraseña, y se lo pasás."
      >
        {directCreated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anotá estos datos y pasáselos a tu empleado — la contraseña no se puede volver a ver
              después de cerrar esto. Si la necesitás de nuevo, podés cambiarla cuando quieras con
              el botón de editar (lápiz) en la lista de usuarios.
            </p>
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usuario</span>
                <span className="font-mono font-semibold text-foreground">
                  {directCreated.username}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Contraseña</span>
                <span className="font-mono font-semibold text-foreground">
                  {directCreated.password}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                copyText(
                  `Usuario: ${directCreated.username}\nContraseña: ${directCreated.password}`,
                  "¡Usuario y contraseña copiados!"
                )
              }
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar usuario y contraseña
            </Button>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={closeDirectDialog}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Usuario</label>
              <Input
                value={directUsername}
                onChange={(e) => setDirectUsername(e.target.value)}
                placeholder="juan"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Sin espacios ni acentos, 3 a 20 caracteres. Le vamos a agregar un código al final
                (ej. {directUsername.trim() || "juan"}#4821) para que no choque con el mismo
                nombre en otro negocio. Con esto entra en vez de un email.
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Contraseña</label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Generar una
                </button>
              </div>
              <Input
                value={directPassword}
                onChange={(e) => setDirectPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Rol</label>
              <Select
                value={directRole}
                onChange={(e) => setDirectRole(e.target.value as "admin" | "vendedor")}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {directRole === "admin"
                  ? "Puede gestionar productos, clientes, proveedores y también invitar y gestionar usuarios."
                  : "Puede vender, cargar compras y ver el catálogo, sin gestionar el equipo."}
              </p>
            </div>

            {directError && (
              <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
                {directError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDirectDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDirectCreate}
                disabled={directCreating || !directUsername || !directPassword}
              >
                {directCreating ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editingMember !== null}
        onClose={closeEditDialog}
        title="Editar usuario y contraseña"
        description="Cambiá el nombre de usuario y/o pisá la contraseña por una nueva."
      >
        {editResult ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {editResult.password
                ? "Anotá estos datos y pasáselos a tu empleado — la contraseña no se puede volver a ver después de cerrar esto, pero la podés cambiar de nuevo cuando quieras desde acá."
                : "El usuario se actualizó. Pasáselo a tu empleado."}
            </p>
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usuario</span>
                <span className="font-mono font-semibold text-foreground">
                  {editResult.username}
                </span>
              </div>
              {editResult.password && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Contraseña nueva</span>
                  <span className="font-mono font-semibold text-foreground">
                    {editResult.password}
                  </span>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                copyText(
                  editResult.password
                    ? `Usuario: ${editResult.username}\nContraseña: ${editResult.password}`
                    : `Usuario: ${editResult.username}`,
                  editResult.password ? "¡Usuario y contraseña copiados!" : "¡Usuario copiado!"
                )
              }
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Usuario</label>
              <Input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="juan"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Si lo cambiás, le agregamos un código nuevo automáticamente (ej.{" "}
                {editUsername.trim() || "juan"}#4821).
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Nueva contraseña (opcional)
                </label>
                <button
                  type="button"
                  onClick={generateEditPassword}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Generar una
                </button>
              </div>
              <Input
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Dejalo vacío para no cambiarla"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                No podés ver la contraseña actual, pero podés poner una nueva cuando quieras.
              </p>
            </div>

            {editError && (
              <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{editError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleEditSave} disabled={editSaving || !editUsername}>
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
