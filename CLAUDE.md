@AGENTS.md

# Reglas del proyecto (aprendidas a los golpes)

- Listados de Supabase: usar `fetchAll` / `fetchAllIn` de `src/lib/supabase/fetch-all.ts`. PostgREST corta en 1000 filas sin avisar y un `.in()` con ~250+ ids falla por URL larga (devuelve `data: null`, que parece "sin filas").
- POS: no usar `revalidatePath` ni `router.refresh()` después de cobrar. En esta versión de Next cualquier `revalidatePath` dentro de un server action re-renderiza la página actual entera (en el POS = todo el catálogo y los clientes). La acción devuelve lo que cambió y el cliente lo aplica.
- Migraciones que redefinen una función: usar exactamente la misma firma (cantidad y tipos de parámetros) que la vigente, o hacer `drop` de la vieja. `create or replace` con otra firma crea un overload aparte (así se rompió la prueba Pro, ver 0037).
- Sesión en server: `supabase.auth.getClaims()` (verifica el JWT localmente, el proyecto firma con ES256), no `getUser()`.
- Fechas/horas en pantalla: `formatDateTime` / `formatTime` de `src/lib/utils.ts` (normalizan espacios para no romper la hidratación).
- SEO/GEO en todo lo público (pedido del usuario, siempre):
  - Cada página pública usa `pageMetadata` (`src/lib/seo.ts`): título de ≤60 caracteres, descripción de ≤155, canonical. Una sola `h1` y títulos en orden (h2, h3).
  - Datos estructurados JSON-LD: `SoftwareApplication` con precios (desde `plan-features`), `FAQPage` en preguntas, `BlogPosting` con autor `Person` (Tadeo, de Pesito) y `inLanguage: "es-AR"`.
  - Fuentes únicas para no desalinear landing, JSON-LD, sitemap y `llms.txt`: planes en `src/lib/plan-features.ts`, preguntas en `src/lib/faq-data.ts`, blog en `src/lib/blog-data.ts`. Una página pública nueva va al sitemap y a `llms.txt`.
  - GEO (que las IA respondan bien sobre Pesito): respuestas claras y autocontenidas, nombrando a Pesito y las funciones concretas; decir lo que no hace (p. ej. factura electrónica) y marcar "pronto" lo que no existe. Nunca prometer funciones que el sistema no tiene.
  - Texto visible en una sola pieza (template string) en vez de `{a} {b}` sueltos, que React parte en el HTML.
  - La web pública no importa código del panel (íconos, nav, etc.): cuida la velocidad (PageSpeed).
  - Usar "negocio", no "comercio de barrio", en los textos de marca.
- Planes (pedido del usuario, siempre): toda función nueva define qué planes la usan. Si no es para todos, se agrega a `featureMinPlan` en `src/lib/plan-access.ts` y se controla con `canUse` en la página/acción del servidor (aviso con `ProLockedCard`; la prueba Pro cuenta como Pro). Límites de usuarios/cajas/sucursales en `planLimits` (controles en `src/lib/plan-limits.ts`). Después, alinear los textos públicos: `plan-features.ts` (cards y tabla `planComparison`), `faq-data.ts`, blog y `llms.txt`. Lo que se anuncia y todavía no existe va como "Pronto" y a la tasklist "Funciones pendientes" de `PROGRESS.md`.
- Estado y pendientes del trabajo: ver `PROGRESS.md`.
- Git: trabajar directo sobre la rama principal (`claude/sharp-carson-p8zpd2`, no hay `main`), sin ramas ni PRs. Commitear y pushear cada cambio terminado.
