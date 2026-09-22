export type Role = "owner" | "admin" | "vendedor";

export const roleLabels: Record<Role, string> = {
  owner: "Dueño",
  admin: "Administrador",
  vendedor: "Vendedor",
};

export function isOrgAdmin(role: string): boolean {
  return role === "owner" || role === "admin";
}
