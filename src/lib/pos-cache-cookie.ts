/** Cookie que avisa que este navegador ya tiene la copia del catálogo del POS (ver pos-catalog.tsx). */
export const POS_CACHE_COOKIE = "pesito-pos-cache";
export const posCacheCookieValue = (orgId: string, branchId: string | null) => `${orgId}.${branchId ?? "all"}`;
