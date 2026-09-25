@AGENTS.md

# Reglas del proyecto (aprendidas a los golpes)

- Listados de Supabase: usar `fetchAll` / `fetchAllIn` de `src/lib/supabase/fetch-all.ts`. PostgREST corta en 1000 filas sin avisar y un `.in()` con ~250+ ids falla por URL larga (devuelve `data: null`, que parece "sin filas").
- POS: no usar `revalidatePath` ni `router.refresh()` después de cobrar. En esta versión de Next cualquier `revalidatePath` dentro de un server action re-renderiza la página actual entera (en el POS = todo el catálogo y los clientes). La acción devuelve lo que cambió y el cliente lo aplica.
- Migraciones que redefinen una función: usar exactamente la misma firma (cantidad y tipos de parámetros) que la vigente, o hacer `drop` de la vieja. `create or replace` con otra firma crea un overload aparte (así se rompió la prueba Pro, ver 0037).
- Sesión en server: `supabase.auth.getClaims()` (verifica el JWT localmente, el proyecto firma con ES256), no `getUser()`.
- Fechas/horas en pantalla: `formatDateTime` / `formatTime` de `src/lib/utils.ts` (normalizan espacios para no romper la hidratación).
- Estado y pendientes del trabajo: ver `PROGRESS.md`.
