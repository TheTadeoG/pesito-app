# Estado del trabajo — optimización de costos Vercel/Supabase

Rama: `claude/sharp-carson-p8zpd2`. Todo lo de acá abajo ya está commiteado y
pusheado — este archivo es sólo para que una sesión nueva no tenga que
re-leer toda la conversación anterior.

## Por qué existe esto

El usuario pidió bajar cuánta información se transfiere y cuántas veces se
repite ida y vuelta a Vercel/Supabase, para optimizar costos, sin romper
nada. Se hizo en varios pasos chicos y seguros (no una reescritura grande),
verificando build + lint + typecheck en cada uno antes de pushear.

## Qué se hizo, en orden (más reciente primero)

1. **`next.config.ts`** — `experimental.staleTimes.dynamic = 30`. El layout
   del dashboard (sesión + suscripción + caja) se reusa hasta 30s entre
   navegaciones en vez de recalcularse en cada click. Seguro: las acciones
   que cambian plata (checkout, abrir/cerrar caja) ya fuerzan datos
   frescos con `router.refresh()`/`revalidatePath`, así que nunca muestran
   algo viejo.
2. **`src/components/dashboard/sidebar.tsx` + `mobile-nav.tsx`** —
   `prefetch={false}` en los ~14 links del menú (antes Next.js los
   precargaba TODOS apenas se veía el sidebar, disparando el layout del
   dashboard de más aunque nadie los visitara). En el sidebar de escritorio
   se agregó en cambio `onMouseEnter={() => router.prefetch(item.href)}`
   para que la navegación real siga sintiéndose instantánea sin
   precargar los 14 de una.
3. **`src/lib/org.ts`** — `requireOrgContext()` envuelta en `cache()` de
   React: se llamaba una vez en el layout y otra en cada página,
   duplicando la consulta de sesión+membership por request.
4. **`src/lib/caja.ts`** — nueva `getCachedCashOnHand(cashRegisterId,
   openingAmount)`, cacheada por request y **por ID de caja registradora**
   (no por usuario ni por negocio — a propósito, para seguir siendo
   correcta si a futuro hay varios vendedores compartiendo una caja o
   varias sucursales). El layout y la página de Caja calculaban el mismo
   desglose de 6-8 consultas por separado; ahora se reusa.
5. **`src/app/(dashboard)/layout.tsx`** — la consulta de suscripción y la
   de "¿hay caja abierta?" pasaron de secuenciales a `Promise.all`.
6. **`src/app/(dashboard)/usuarios/usuarios-client.tsx`** — el polling
   automático de la lista de usuarios bajó de cada 10s a cada 60s (el
   refresco instantáneo al volver a la pestaña, vía visibilitychange/
   focus, queda igual).

## Medido en Vercel (dato real, no estimado)

El usuario probó en producción (login + 1 venta + 1 compra + abrir/cerrar/
abrir caja) con todo lo de arriba ya desplegado: **76 Vercel Functions, 1MB
de transferencia** en esa sesión de prueba (ventana de 5 min en Vercel
Observability). Antes de estos cambios, sólo *una* carga de pantalla sin
hacer nada generaba más invocaciones que eso — por la precarga automática
del menú (ver punto 2). No hay una medición real de "antes" en MB para
comparar 1 a 1 (no se capturó ese gráfico antes de los cambios), sólo la
estimación razonada de que bajó ~90%+.

## Pendiente / en curso

**Tarea en curso**: simular un "cliente mediano" (no un kiosco chico) en la
web real (`https://www.pesito.com.ar`) — crear una cuenta de prueba
(marcarla claramente como test, ej. nombre de negocio "PRUEBA - ..."),
cargar un catálogo más grande, registrar varias ventas/compras variadas,
abrir/cerrar caja, y mirar los números reales de Vercel Observability
después. Esto se frenó porque el sandbox no tenía permiso de red para salir
a `pesito.com.ar` — el usuario ya lo habilitó en la configuración del
entorno, pero el cambio necesita una sesión/contenedor nuevo para tomar
efecto (no alcanza con reintentar en la sesión vieja).

**Si estás en una sesión nueva retomando esto**: probá primero
`curl -s -o /dev/null -w "%{http_code}\n" --max-time 15 https://www.pesito.com.ar/`
— si ya da 200, seguí con la simulación del cliente mediano y compartí los
números de Vercel Observability con el usuario al final, con contexto de
qué representa cada uno (Edge Requests vs Vercel Functions vs Middleware
vs Fast Data Transfer — ya se le explicó la diferencia antes, no hace
falta repetirla de cero).

## Otras ideas anotadas (no implementadas, sin urgencia)

Hay un sistema de tareas (TaskCreate/TaskUpdate) con más de 100 ítems ya
completados y varias ideas pendientes marcadas como tal (ej. sucursales,
sugerencia de compra automática, cierres de caja programados). No son
parte de esta rama de trabajo de optimización — quedaron anotadas para
más adelante, a pedido explícito del usuario de "no implementar todavía".
