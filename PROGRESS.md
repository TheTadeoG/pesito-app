# Progreso

Última actualización: 2026-10-07.

## Hecho (PR #2, mergeado)

Probamos la app simulando un cliente mediano: almacén con 1.600 productos, 381 clientes, 2 vendedores y 30 días con ~2.500 ventas. Usamos Supabase local + `next start`.

- Reportes, POS, Compras, Productos y Clientes ya no se cortan en 1.000 filas ni en 500/300 productos/clientes.
- Migración 0037 (aplicada en producción): los negocios nuevos vuelven a tener la prueba Pro de 14 días.
- POS: una venta pasó de 42 consultas / ~710 KB a 6 consultas / ~1,5 KB. La sesión se valida con `getClaims`.
- Errores de hidratación #418 arreglados: formato de fechas, cronómetro de caja y `<html>`.

## Hecho: Caja y cierre de caja

- Migración 0038 (aplicada en producción): función `cash_register_summaries(uuid[])` que calcula efectivo y cobros por medio de pago de varias cajas en una sola consulta, más un índice en `sales (cash_register_id)`.
- `src/lib/caja.ts`: `getCashRegisterSummaries` la usa para todas las cajas de la página; `computeCashOnHand` (usado al cerrar, retirar, comprar y pagar a proveedores) también. Si la función no existe o falla, calcula como antes, caja por caja (`legacy*`); ese código se puede borrar cuando 0038 esté en producción.
- Visita a Caja: de 3 a 8 consultas por caja del historial a ~11 fijas. Cerrar la caja: ~23. El detalle de una caja: 9, y ya no se corta en 1000 ventas.
- Verificado contra el cálculo anterior con ventas anuladas, mixtas (con y sin desglose), fiado, cobros de deuda, ingresos/retiros, compras (mixtas y anuladas) y pagos a proveedores: mismos números. Un negocio no puede ver cajas de otro.

## Costos (cliente mediano, por mes, después del PR #4)

Simulación del 2026-09-25 con "Almacén La Esquina" (dueña + 2 vendedores, 1.600 productos, 381 clientes, ~2.500 ventas/mes). Uso supuesto por mes: 2.526 ventas, 60 aperturas y 60 cierres de caja, 60 recargas del POS, 90 logins, 150 visitas a Caja, 30 a Reportes (30 días), 15 a Productos, 8 a Stock, 10 a Compras, 15 a Clientes.

- Supabase: ~22.600 consultas (antes ~84.000) y ~0,15 GB transferidos. Lo que más transfiere: Reportes (~59 MB) y cargar el catálogo en el POS (~62 MB). La base crece ~2,7 KB por venta (~7 MB por mes).
- Vercel: ~7.900 invocaciones, ~11.400 edge requests, ~0,08 h de servidor, ~60 MB transferidos.
- Precios (septiembre 2026): Supabase Pro US$25 (250 GB de transferencia, 8 GB de disco, servidor Micro incluido; después US$0,09/GB, US$0,125/GB de disco). Vercel Pro US$20 por desarrollador con US$20 de crédito (1 TB de transferencia y 10 M de edge requests aparte; después US$2 por millón de edge requests).
- Límites: el disco de 8 GB se llena primero (~95 clientes con un año de historial; cada GB extra cuesta US$0,125). Los 10 M de edge requests de Vercel alcanzan para ~870 clientes. La transferencia de Supabase, para ~1.600. El servidor Micro no está medido con carga real: estimamos que hay que agrandarlo entre 300 y 500 clientes.
- Total estimado: 100 clientes ~US$45/mes; 300 clientes ~US$47-52 (con servidor Small); 1.000 clientes ~US$110 (con servidor Medium). Cada cliente extra cuesta entre US$0,05 y US$0,10 por mes.

## Hecho: bajar el costo por cliente (7/10/2026) — migraciones 0061 a 0064 (**faltan aplicar en producción, ANTES de pasar el código a `main`**)

Salió de la medición del 7/10 (Postgres 16 local con las 60 migraciones, 1.600 productos y hasta 15.000 ventas en 30 días). Se aplicaron las sugerencias 1, 2, 3, 5 y 7:

1. **Reportes en SQL** (0061: `report_overview`, `report_totals`, `report_stock_value`; `security definer` con `is_org_member`). Antes: ~360 consultas HTTP y ~28 MB por visita a 500 ventas/día. Ahora: 1 consulta de ~11 KB para todo lo que se ve (más unas 8 chicas: suscripción, vendedores, cajas, deudores). La base la resuelve en ~0,3 s con 15.000 ventas. Las políticas RLS de `sale_items` buscaban la venta fila por fila y la misma cuenta tardaba 13 s, por eso no es `security invoker`. `report-insights.ts` ahora recibe `salesCount`, `weekdays` y `hours` ya sumados.
2. **Cobrar en una consulta** (0062: `checkout_sale_full`, nombre nuevo para no crear un overload de `checkout_sale`). Antes ~7,5 consultas por venta desde el servidor; ahora 2 (plan + cobrar). La base tarda +1,6 ms por venta (3,8 → 5,5 ms con 5 cobrando a la vez) y devuelve stock de la sucursal de la caja, saldo del cliente y las 8 ventas recientes (~4 KB).
3. **En vivo** (0063: `live_pulse`, ~140 bytes y ~1 ms contra ~10 KB y ~40 ms de `live_overview`). Pregunta cada 60 s (antes 30 s) y trae el resumen sólo si el aviso cambió o cada 5 minutos. Texto público actualizado ("cada minuto").
5. **Catálogo del POS con copia en el navegador** (0064: `pos_catalog`). Un producto nuevo o cambiado llega por `updated_at`; la lista `[id, stock]` de los activos es la lista oficial (lo que no está se borra de la copia). La llama el navegador directo a Supabase (no gasta Vercel). Carga en frío ~460 KB, con copia ~85 KB. Sin conexión usa la copia. `src/app/(dashboard)/pos/pos-catalog.tsx`. **Ajuste del 7/10:** la copia se muestra al instante (sin cartel de carga) y se actualiza en segundo plano; la primera vez en un navegador (sin la cookie `pesito-pos-cache`) los productos van adentro de la página; si `pos_catalog` no responde en 6 s se baja por el servidor (`loadCatalogFallback`); si todo falla, error con Reintentar.
7. **Fotos de productos** (`src/lib/compress-image.ts`): se achican en el navegador a WebP de máx. 800 px (una foto de celular de 3 a 5 MB queda en ~50 a 150 KB). Se aceptan originales de hasta 20 MB y se sube el achicado (máx. 5 MB). No se probó con el almacenamiento real de Supabase.

Sin hacer (de la lista): 4 (comprar RAM sólo si se mide), 6 (índice duplicado de `sales`, ahorra ~2%), 8.

Antes de pasar a `main`: aplicar 0061, 0062, 0063 y 0064 en Supabase. Sin 0061 falla Reportes, sin 0062 falla el cobro y sin 0064 el POS no carga productos (En vivo sí funciona sin 0063, trae el resumen completo cada vez).

## Costos: re-medición del 7/10/2026 (reemplaza la de arriba)

Modelo y supuestos: `scratchpad/cost.py` (no está en el repo). Lo medido es la base (ms, KB y disco por venta: 1,9 KB de disco y ~5,3 KB de log por venta). Lo calculado a partir del código: consultas, edge requests, invocaciones y transferencia. No está medido: Vercel y Supabase reales, el servidor Micro con carga, las imágenes.

Costo fijo de plataforma: **US$45 por mes** (Supabase Pro 25 + Vercel Pro 20). Mientras no se agoten los cupos incluidos del Pro, no hay costo variable: cada cliente cuesta **45 ÷ cantidad de clientes**.

| Clientes | Costo por cliente |
|---|---|
| 1 | US$45 |
| 5 | US$9 |
| 10 | US$4,50 |
| 25 | US$1,80 |
| 50 | US$0,90 |
| 100 | US$0,45 |

Cuánto del Pro usa **un** cliente por mes, y cuántos de ese tipo caben (se agota lo que primero llegue a 100%):

| Tipo de cliente | Consultas/mes (antes → ahora) | Transferencia/mes (antes → ahora) | Disco al año | Cupo por disco (7,5 GB) | Cupo por invocaciones (1 M) | Cupo por transferencia (250 GB) |
|---|---|---|---|---|---|---|
| Gratis (150 ventas/mes) | 3.400 → 2.400 | 48 → 33 MB | 7 MB | ~1.100 | ~515 | ~7.600 |
| Chico (100 ventas/día, 3 usuarios) | 60.000 → 30.000 | 519 → 78 MB | 70 MB | **~109** | ~119 | ~3.300 (antes ~490) |
| Mediano (300/día, 5 usuarios) | 113.000 → 48.000 | 904 → 126 MB | 204 MB | **~38** | ~56 | ~2.000 (antes ~280) |
| Grande (500/día, 6 usuarios) | 164.000 → 64.000 | 1.275 → 174 MB | 338 MB | **~23** | ~39 | ~1.470 (antes ~200) |

- **Lo que se agota primero con el Pro es el disco**, para todos los clientes que venden. Las optimizaciones no lo tocan (sale de los datos de venta): bajaron consultas (−50 a −60%) y transferencia (−85%), que dejó de ser un límite.
- **Ejemplo de mezcla** (50% gratis, 30% chicos, 15% medianos, 5% grandes; es una suposición): el Pro se llena a ~107 clientes por disco y ~134 por invocaciones. Hasta ahí, US$45 ÷ clientes (a 100 clientes, US$0,45 cada uno).
- **Pasado el Pro** (variable, precios de lista): cada cliente extra suma ~US$0,01 (gratis), ~US$0,04 (chico), ~US$0,08 (mediano) o ~US$0,12 (grande) por mes en disco, invocaciones, edge y transferencia; mezcla ~US$0,04. Aparte, escalones de servidor de base: Small (~+US$5 netos) cuando el Micro se quede corto de memoria y Medium (~+US$50) más adelante. **No está medido**: estimamos Micro hasta ~15 a 20 clientes grandes o ~50 chicos con los datos de 30 días en memoria.
- **Imágenes (sin medir)**: van al almacenamiento de Supabase (100 GB incluidos, aparte del disco de la base) y a la transferencia. Con fotos de 3 a 5 MB, 1.000 productos con foto pesaban ~4 GB (se llenaban con ~25 clientes). Achicadas, ~0,15 GB: ~650 clientes. Sólo vale para fotos nuevas; las ya subidas siguen pesadas.
- Para pasar a pesos: multiplicar por la cotización del día.

### Costos con servidor (captura de Supabase del 7/10/2026) y mezcla 80% gratis

- Servidores (por mes, 730 h): Nano US$0 (0,5 GB), Micro US$9,81 (1 GB), Small US$15,04 (2 GB), Medium US$60 (4 GB), Large US$110,74 (8 GB, dedicado), XL US$210 (16 GB). El Pro da US$10 de crédito de cómputo (a confirmar en la factura): Micro sale gratis, Small +US$5, Medium +US$50, Large +US$101, XL +US$200. El proyecto parece estar en **Nano**; pasarlo a Micro no cuesta nada con el crédito.
- Memoria (estimada, no medida): cada GB aguanta ~50 clientes chicos, ~30 medianos o ~18 grandes (~800 gratis).
- **Mezcla 80% gratis, 12% chicos, 6% medianos, 2% grandes** (el cliente promedio usa ~33 MB de disco al año, ~4.100 invocaciones y ~47 MB de transferencia por mes). Cupos del Pro: disco ~233 clientes, invocaciones ~241, edge ~1.660, transferencia ~5.400; memoria: Nano ~77, Micro ~154, Small ~307, Medium ~614, Large ~1.230.

| Clientes (pagos) | Servidor | Total por mes | Por cliente | Por cliente pago |
|---|---|---|---|---|
| 10 (2) | Nano | US$45 | US$4,50 | US$22,50 |
| 50 (10) | Nano | US$45 | US$0,90 | US$4,50 |
| 100 (20) | Micro | US$45 | US$0,45 | US$2,25 |
| 200 (40) | Small | US$50 | US$0,25 | US$1,25 |
| 500 (100) | Medium | US$97 | US$0,19 | US$0,97 |
| 1.000 (200) | Large | US$151 | US$0,15 | US$0,75 |
| 2.000 (400) | XL | US$261 | US$0,13 | US$0,65 |

La memoria del servidor es lo que más pesa en el costo cuando hay clientes medianos y grandes. Con todos los clientes de un mismo tipo, 100 grandes ya piden un Large (US$150 por mes, US$1,50 por cliente). Más de 16 GB de memoria no se estima.

### Probado y descartado: resúmenes diarios para Reportes (7/10/2026)

Idea: guardar por cada día cerrado un resumen (por sucursal/vendedor/medio de pago, por hora, por producto y por cliente) para que Reportes no tenga que leer las ventas y renglones de 30 días, y así bajar la memoria que necesita cada cliente en el servidor. Se escribió (migración 0065, con triggers de invalidación al anular o insertar ventas y un armado perezoso de los días) y se probó en la simulación: mismos resultados que `report_overview_raw` (138 de 140 comparaciones iguales; las 2 distintas eran empates en el 5.º puesto de "más vendidos"), anular una venta rearma el día, 6 reportes simultáneos sin duplicados, y el cobro no se vuelve más lento (4,3 a 4,7 ms con y sin triggers).

Pero el ahorro medido es mucho menor al proyectado (−60% de memoria):

| Cliente | Memoria que toca una visita a Reportes (30 días) | Tiempo en frío | Disco extra |
|---|---|---|---|
| 500 ventas/día | 11,2 → 6,2 MB (−45%) | 982 → 331 ms | +5,3 MB (+~10% de las tablas de ventas) |
| 100 ventas/día | 2,8 → 2,2 MB (−22%) | 263 → 182 ms | +1,2 MB (+21%) |

Motivo: el resumen por producto y por día casi no comprime (en un día se venden casi tantos productos distintos como renglones hay) y pesa más que todo el resto junto. Con los datos de la simulación (catálogo de 1.600 productos con ventas parejas) es el peor caso; con ventas concentradas en pocos productos ahorraría más, pero no lo medimos. No se aplicó; el SQL quedó fuera del repo. Alternativa si más adelante hiciera falta: guardar por día sólo los mejores N productos (los rankings quedarían aproximados).

### Costos: resumen y pendientes (7/10/2026)

- Simulación local de memoria (600 clientes de la mezcla, 30 días, 60 ops/s, memoria limitada con cgroup): 1 GB sin degradación visible, 512 MB empieza a degradarse (cache hit 96,8%). Disco local más rápido que el de Supabase: por eso el caso base usa un margen ×2 (la mitad de clientes por GB que lo medido: ~300 por GB contra ~600).
- Caso base, 90% gratis (resto 60% chicos, 30% medianos, 10% grandes), por mes: 5.000 clientes US$291 (US$0,58 por cliente que paga), 10.000 US$570, 15.000 US$656, 20.000 US$1.294 (US$0,44 a US$0,65 por cliente que paga). Con 95% gratis: ~US$0,70. Año de antigüedad: +2 a 4 centavos por cliente que paga por año (sólo disco). Un pago (Esencial, ~US$10 neto) cubre ~500 gratis.
- Pendientes: (1) medir memoria real en un Supabase de pruebas (paquete: `seed.sql`, `work.sql`, `mix.pgb` de la simulación; hay que permitir los dominios en la red del entorno y poner las claves como secretos); (2) correr `disco_por_cliente.sql` y mirar Usage de Supabase y Vercel con clientes reales; (3) medidor de uso por cliente dentro de la app; (4) política de historial por plan (con aviso y exportación a Excel); (5) índice duplicado `sales_org_id_idx` (una línea); (6) alternativas de infraestructura (servidor propio) cuando el servidor de Supabase pase de ~US$400–500 por mes (cuidar la región: Hetzner no tiene Sudamérica).

## Hecho: protecciones contra abusos (7/10/2026) — migración 0065 (**falta aplicar en producción**)

- `rate_limit_hit` (tabla UNLOGGED `rate_limits`, ventana fija por negocio y tipo de pedido; error `P0429`). Se usa sólo en lo pesado. Las funciones que llama el navegador directo (`report_overview`, `pos_catalog`, `live_pulse`, `live_overview`) pasan a ser envoltorios que cuentan y llaman a `*_raw` (sin permiso para los usuarios). Límites por minuto y por negocio: Reportes 20, catálogo del POS 30, aviso de En vivo 30, En vivo completo 12.
- En las acciones del servidor (`src/lib/rate-limit.ts`, `checkRateLimit`): carga masiva de clientes y de productos (240 tandas de 250 filas por hora: tres archivos de 20.000), aumentos masivos de precios (300 por hora), alta de usuarios y de invitaciones (20 por hora). Si el contador falla o la migración no está aplicada, deja pasar (no frena a nadie).
- Topes técnicos por negocio con triggers por sentencia: 50.000 clientes, 5.000 proveedores, 5.000 marcas, 2.000 categorías (error `P0430`). Cierra el hueco de insertar filas directo en la API.
- Reportes muestra "Estás haciendo demasiados pedidos seguidos" con Reintentar si se pasa del límite. Las fotos de productos suben con caché de un año (nombre nuevo cada vez).
- Medido en la simulación: el contador agrega ~0,2 a 0,4 ms por pedido pesado; un insert masivo de 500 clientes con el tope tarda 27 ms.
- Pendiente (a configurar en los paneles): reglas de Vercel Firewall (límite por IP en /login, /registro, /auth y /api), límites y ajustes de Supabase Auth, CAPTCHA (Turnstile) en registro y login, `statement_timeout` por rol (revisar los valores actuales).

## Catálogo del POS: copia en IndexedDB, sólo lo que cambió y consulta cada 60 s (7/10/2026) — migración 0066 (**falta aplicar en producción**)

- `pos_catalog_delta` (0066): devuelve sólo los productos modificados y el stock de los que tuvieron movimiento o cambio desde la última sincronización, más `active_count`. Dos fuentes independientes de "qué cambió" (`stock_movements` y `products.updated_at`, que también sube con cada cambio de stock). `pos_catalog` queda igual y es el camino de respaldo. Mismo cupo de límite de ritmo que `pos_catalog` (30 por minuto).
- `src/lib/pos-catalog-merge.ts` (mezcla pura, con `pos-catalog-merge.test.mts`: `node --experimental-strip-types src/lib/pos-catalog-merge.test.mts`): ante cualquier cosa que no cuadre (cantidad de activos, stock de un producto desconocido, números inválidos) devuelve null y el navegador baja el catálogo completo.
- `src/lib/pos-catalog-store.ts`: la copia va en localStorage si entra y, si no (catálogos grandes), en IndexedDB; un resumen chico en localStorage. La cookie `pesito-pos-cache2` que le avisa al servidor que ya hay copia se pone sólo después de comprobar que se guardó; si no se pudo guardar, el servidor sigue mandando los productos con la página.
- `pos-catalog.tsx`: con copia, delta; catálogo completo una vez por día o ante cualquier duda; no vuelve a consultar si la última consulta fue hace menos de 60 s; sin copia, igual que antes (productos con la página, o base y servidor en paralelo).
- Pruebas: 16 pruebas de la mezcla (incluye 5.000 rondas de cambios al azar); prueba de convergencia en la base con ventas simultáneas, cambios de precio, activar/desactivar y productos nuevos (3.291 ventas y 606 ediciones en dos corridas, 0 diferencias de stock, precio o cantidad, 0 sincronizaciones inconsistentes); el almacenamiento probado en Chromium real (localStorage, cuota llena → IndexedDB, sin IndexedDB, datos dañados, cookie sólo si se guardó). No probado: contra tu Supabase real ni la pantalla completa en un navegador.
- Con 20.000 productos: la entrada al POS pasa de ~1 MB (o ~5 MB si la copia no entraba) a ~0,1 a 10 KB (un delta vacío son 109 bytes).

## Seguridad: clave secreta en una variable pública (7/10/2026)

- La consola del POS mostró `Forbidden use of secret API key in browser` (401): `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel tenía una clave `sb_secret_...`, que se publica en el navegador de cada visitante. Supabase la rechazaba en el navegador (por eso `pos_catalog` fallaba en producción), pero la clave estaba expuesta.
- Resuelto: se puso la publishable en esa variable, se creó una secret key nueva (`pesito_vercel_servidor`) en `SUPABASE_SERVICE_ROLE_KEY` (sólo servidor), se probó login, contraseña mala, alta de usuario y `/admin`, y se borró la clave vieja en Supabase.
- Protección: `next.config.ts` hace fallar el build si una variable `NEXT_PUBLIC_*` trae `sb_secret_...` o un JWT con rol `service_role` (probado con los cuatro casos).
- Pendiente (opcional): mirar los logs de API de Supabase y los usuarios nuevos por si alguien usó la clave mientras estuvo expuesta; desactivar las claves antiguas (legacy anon/service_role) cuando ninguna variable las use.

## Límite de ritmo por IP en los formularios públicos (7/10/2026) — migración 0067 (**falta aplicar en producción**)

- Sin servicios de afuera ni costo extra (en vez de las reglas de límite de ritmo de Vercel Firewall, que cobran US$0,50 por millón de pedidos permitidos). `rate_limit_ip` (tabla UNLOGGED `ip_rate_limits`), sólo ejecutable con la clave secreta del servidor; la app guarda una huella de la IP (HMAC con `SUPABASE_SERVICE_ROLE_KEY`), no la IP. Si no se puede saber la IP, o la función falla o no existe, deja pasar.
- `src/lib/ip-rate-limit.ts` (`checkIpRateLimit`), usado en: login (20 por minuto por IP), registro (5 cada 10 minutos) y alta desde una invitación (5 cada 10 minutos). Además sigue el bloqueo por cuenta de la migración 0045.
- Las reglas que se hayan creado en Vercel Firewall (Login, Registro) pueden quedar o borrarse: no se pisan.

## Login sin bloqueo de cuentas: por IP y con CAPTCHA sólo si fuerzan (7/10/2026) — migración 0068 (**falta aplicar en producción**)

- Se sacó el bloqueo por cuenta del login (`check_login_lockout`, `register_login_failure`, `register_login_success` ya no se llaman; las funciones y la tabla `login_lockouts` quedan sin uso). Nadie puede dejar afuera a otra persona.
- Ahora todo es por IP (huella con HMAC): 20 envíos por minuto (0067); desde el 3.er intento fallido seguido en 15 minutos se pide CAPTCHA (si hay claves); con 30 fallos se corta esa conexión un rato. El contador de fallos no se borra al entrar bien (así nadie lo resetea con una cuenta propia): vence solo a los 15 minutos. Registro: 5 por 10 minutos y CAPTCHA desde el 3.º. El alta desde invitación sigue sólo con el tope de 5 por 10 minutos (sin CAPTCHA).
- CAPTCHA: Cloudflare Turnstile (gratis). `src/lib/turnstile.ts` verifica el token del lado del servidor; si Cloudflare no responde, deja pasar. `src/components/auth/turnstile-field.tsx` muestra el cuadro sólo cuando el servidor lo pide. Variables: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (navegador) y `TURNSTILE_SECRET_KEY` (servidor). Sin las dos, nunca se pide CAPTCHA y el resto sigue funcionando. NO activar el CAPTCHA integrado de Supabase Auth (Attack Protection): pediría el token en todos los logins.
- Decisión en `src/lib/login-gate.ts`, con pruebas (`login-gate.test.mts`, `turnstile.test.mts`, con `node --experimental-strip-types`). No probado: el cuadro de Turnstile en un navegador real (el entorno de pruebas no llega a Cloudflare).
- Listo: si una cuenta suma 10 o más fallos en 15 minutos (desde cualquier IP), se pide CAPTCHA a quien intente entrar a esa cuenta. Nunca se bloquea: quien tiene la contraseña entra resolviendo el CAPTCHA. Los contadores no se borran al entrar bien.

## Hecho: tanda rápida

- Precarga: `prefetch={false}` en los links a la ficha de cada cliente (/clientes y deudores en Caja) y a /configuracion (banner de prueba Pro, tarjetas Pro bloqueadas, pestañas de Configuración).
- Reportes: los ítems sin producto ("Monto libre" o productos borrados) ya no entran en "más vendidos", "más ganancia" ni "vendidos a pérdida". Siguen contando en ingresos y ganancia estimada.
- Usuarios: el alta dice "otro negocio" en vez de "otro kiosco".

## Hecho: Productos, Caja sin cálculo viejo, datos frescos después de vender

- Productos: la tabla muestra 100 filas y agrega de a 100 al bajar (o con "Mostrar más"). Buscar, filtrar y ordenar siguen trabajando sobre todo el catálogo. Con 1.600 artículos pasó de ~2 s a ~0,5 s.
- Caja: se borró el cálculo viejo caja por caja (`legacy*`). Si `cash_register_summaries` falla, la página de Caja da error y las acciones (retirar, cerrar, comprar o pagar a proveedores en efectivo, quitar un usuario con la caja abierta) devuelven "No pudimos calcular el efectivo de la caja" en vez de usar un monto equivocado. La tarjeta "Vender" muestra "—" en caja.
- Después de cobrar en el POS, la primera página que se abre fuera del POS se refresca una vez (`RefreshAfterSale` + `markSaleCompleted` en `src/lib/cash-events.ts`). El POS sigue sin refrescarse.
- Textos del panel: "negocio" en vez de "kiosco" en Configuración, Recomendaciones y Soporte. La web pública y el registro siguen nombrando kioscos a propósito.

## Hecho: landing y auditoría de PageSpeed

- Landing: el hero y el título de Precios remarcan que se empieza gratis; Precios muestra solo los planes pagos (a pedido). Sección nueva "¿Te aumentó el proveedor?" sobre aumentos masivos por proveedor o marca, y fila en la comparación.
- `/llms.txt` (se genera al compilar desde los mismos datos que el sitemap). `/.well-known/*` es pública: si no existe da 404 en vez de mandar a /login.
- Accesibilidad: nombres en botones de ícono, mockup del POS sin botones falsos, áreas táctiles de 24 px.
- PageSpeed (2026-09-25): móvil 98 / 96 / 100 / 100 / 3 de 3; ordenador 100 / 96 / 100 / 100 / 3 de 3. Los avisos de "JavaScript antiguo" y "JavaScript que no se usa" son del propio Next.js; `inlineCss` se descartó (experimental y global).
- Historial de precios: el botón y el email ya no se cortan.

## Hecho: deshacer aumentos masivos

- Migración 0039 (aplicada en producción el 2026-09-25): tabla `bulk_price_changes`, columna `bulk_change_id` en los historiales de precio y costo, `bulk_increase_field` (misma firma) registra cada aumento y `revert_bulk_price_change` lo deshace. Sólo vuelve atrás los productos que siguen con el valor del aumento; hasta 30 días.
- En "Aumentar precios/costos", abajo, "Aumentos anteriores" con "Deshacer". Hasta aplicar 0039 la lista no aparece y el aumento funciona igual que antes.
- Espacio: ~55 bytes extra por renglón de historial que viene de un aumento masivo (~0,4 MB por año para un cliente mediano).
- Historial de precios y costos (menú de cada producto): pestañas "Precio de venta" y "Costo", "Volver a este precio/costo", y etiqueta "Aumento masivo · +13% · Proveedor" en los cambios que vinieron de un aumento. Sin 0039 se ve igual pero sin la etiqueta.
- Menú de los tres puntos en Productos: se posiciona fijo en pantalla y se abre hacia arriba si no entra (antes agrandaba la tabla con una barra de scroll). Acompaña al botón si la tabla o la página se mueven.

## Hecho: precio de venta en Compras y ticket en el POS

- Compras: cada renglón muestra el precio de venta actual, un campo "Nuevo" (vacío = no cambia) y el botón "Mantener margen" cuando el costo cambió (precio × costo nuevo / costo anterior, redondeado a pesos). Avisa "Venderías a pérdida". Los precios se guardan después de registrar la compra, en la misma acción (sin migración); si alguno falla, la compra queda y se avisa.
- POS: al cobrar se abre "¡Venta cobrada!" con el total, el vuelto (si pagó en efectivo con más) e "Imprimir ticket". Enter o Escape la cierran; escanear el próximo producto también la cierra y el código entra al buscador. El ticket (`.ticket-print` en globals.css) ocupa el ancho del papel (58/80 mm) y dice "Comprobante no válido como factura".

## Hecho: aumento de costo que sube también el precio

- Migración 0040 (aplicada en producción el 2026-09-25): `bulk_increase_cost_with_price`. En "Aumentar costos", la casilla "Aumentar también el precio de venta en la misma proporción" sube cada precio × costo nuevo / costo anterior (con % es el mismo %; con monto fijo, cada producto en su proporción). Sólo productos con costo > 0. Deja un aumento de costo y otro de precio, cada uno se deshace por separado; el de precio con monto fijo figura como "Proporcional al costo".
- "Ajustar precios" y "Ajustar costos" (antes "Aumentar"): el diálogo tiene un selector Aumentar / Bajar. Bajar manda el valor en negativo a las mismas funciones (la base ya lo admitía, sin migración): porcentaje menor a 100, o monto fijo (el valor nunca queda menor a 0). Bajar con monto fijo junto con el precio del costo no está permitido (dejaría precios en $0); con porcentaje sí. El historial muestra "-5%" o "-$200" y se deshace igual.
- Historial de aumentos: un aumento de costo que subió también el precio muestra "Con aumento de precio (N productos)", y al deshacerlo hay una casilla "Deshacer también el aumento de precio" (sin tildar por defecto). El vínculo no se guarda: se deduce porque el costo y el precio de la misma tanda tienen la misma fecha y hora y el mismo proveedor o marca. Sin migración. Son dos deshacer independientes: si falla el segundo, el costo queda deshecho y se avisa.
- Sin 0040 aplicada, marcar la casilla da error ("No pudimos actualizar los costos y precios"); sin marcarla funciona como antes.

## Hecho: reportes por vendedor y recordatorio de cierre de caja

- Reportes (dueños/administradores): selector "Todos los vendedores" / uno en particular (`?vendedor=<user_id>`), que filtra ventas, indicadores, gráficos, rankings, comparación con el período anterior y diferencias de caja. Fiado y stock valorizado son de todo el negocio: con un vendedor elegido no se muestran ni se consultan. Tarjeta nueva "Ventas por vendedor" (ventas, ticket promedio, ingresos, ganancia estimada y % del total); cada fila abre el reporte de ese vendedor. Los vendedores siguen viendo Reportes como antes, sin selector.
- Migración 0041 (**falta aplicar en producción**): `organizations.cash_close_time` (hora de Argentina, null = sin recordatorio). Configuración → "Cierre de caja" (sólo dueños/administradores): activar y elegir la hora.
- Aviso arriba del panel (también en el POS) para quien tiene la caja abierta: 15 minutos antes de la hora de cierre, a la hora de cierre, y siempre que la caja siga abierta desde un día anterior (esto último funciona aunque no haya hora configurada ni 0041). Se calcula en el navegador cada 30 s, sin consultas extra; se puede descartar (vale para esa pestaña). Una caja abierta después de la hora de cierre (turno noche) no avisa hasta el día siguiente. Lógica en `src/lib/cash-reminder.ts`.
- Caja → "Cajas abiertas del equipo": etiquetas "Abierta desde otro día" y "Pasó la hora de cierre".
- Sin 0041 aplicada: no hay recordatorio por horario y guardar la hora da "No pudimos guardar el cambio."; el resto funciona.
- Probado en local con "Almacén La Esquina": la suma por vendedor coincide con el total (1.211 + 1.177 = 2.388 ventas en 30 días) y el filtro de un vendedor muestra los mismos números que su fila.

## Hecho: pantalla "En vivo" (etapa 1 de sucursales)

- Nueva página `/en-vivo` (menú Análisis, sólo dueños/administradores). Muestra lo de hoy (día de Argentina): vendido, ventas, ticket, comparación con ayer a la misma hora, cajas abiertas, cada persona del equipo (estado de caja, efectivo en caja, ventas y monto de hoy, última venta, aviso si lleva más de 30 min sin vender con la caja abierta, faltante/sobrante al cerrar), ventas por hora y las últimas 10 ventas.
- Migración 0042 (**falta aplicar en producción**): función `live_overview(p_org_id)` que devuelve todo en una consulta (~3,5 KB, ~100 ms con el almacén simulado) + índice `sales (org_id, created_at)`. Sólo owner/admin (un vendedor recibe error).
- Se actualiza cada 30 s sólo con la pestaña visible; en segundo plano no consulta nada; al volver consulta en el momento y retoma cada 30 s. La consulta va directo del navegador a Supabase (no gasta invocaciones de Vercel). Con la pantalla abierta 8 h/día: ~29.000 consultas/mes por dueño, ~100 MB.
- Sin 0042 aplicada, `/en-vivo` da error; el resto funciona.

## Hecho: sucursales con stock propio (etapa 2)

Decidido con el usuario: una sola sesión trabaja esto; **stock por sucursal**; la primera sucursal es de todos los planes y las adicionales son Pro (plan pro/ia o prueba vigente); "En vivo" muestra las sucursales y dentro de cada una sus vendedores.

- Migración 0043 (**falta aplicar en producción, después de la 0042**): tablas `branches` (una `is_main` por negocio, "Principal", se crea sola) y `branch_stock`; `branch_id` en `cash_registers`, `sales`, `purchases`, `stock_movements` y `memberships` (sucursal asignada). Todo lo existente queda en la Principal.
- `products.stock` = suma de `branch_stock`, mantenido por triggers. Un cambio directo a `products.stock` (código viejo, SQL Editor) se aplica a la sucursal "de contexto" (`set_stock_branch`, que fijan venta/compra/anulaciones/ajustes) o a la Principal. Por eso la migración es compatible con el código anterior y el código nuevo funciona sin la migración (sin sucursales, como antes: probado).
- `checkout_sale` controla y descuenta el stock de la sucursal de la caja; `register_purchase` (nuevo parámetro opcional `p_branch_id`) suma en la de la caja o la elegida; `void_sale`/`void_purchase` en la de la venta/compra. RPCs nuevas: `create_branch` (admin; Pro desde la segunda), `set_member_branch`, `adjust_branch_stock`, `transfer_stock` (admin; movimientos tipo "transferencia"). `live_overview` suma sucursales (totales, ayer, cajas abiertas, por hora) y lo vendido por persona en cada sucursal.
- App: `src/lib/branches.ts` (`getBranchContext`: vendedor = su sucursal asignada o la Principal; dueño/admin = la elegida en el menú, cookie `pesito-branch`). Selector en el menú lateral y en el del celular (sólo con 2+ sucursales). La caja se abre en la sucursal actual; POS muestra y controla el stock de la sucursal de la caja; Compras, Productos (tabla, stock bajo, movimientos, ajustes, stock inicial de un producto nuevo) usan la sucursal actual. Configuración → Sucursales (crear/renombrar). Usuarios → sucursal de cada persona. Productos → "Transferir a otra sucursal".
- En vivo: ranking de sucursales (la que más vende hoy destacada) y filtro por sucursal (equipo, lo vendido por cada persona en esa sucursal, ventas por hora y últimas ventas).
- Proveedores, arreglo de vencimientos (migración 0058 `purchases.paid_amount`, **hay que correrla**): antes el reparto de los pagos entre compras se calculaba al mostrar y cambiaba al asignar una fecha (reaparecían compras viejas "sin fecha" y la que se acababa de fechar desaparecía). Ahora cada pago queda aplicado en `register_supplier_payment` (primero la que vence antes, sin fecha la más vieja) y lo ya pagado se completa con los pagos existentes (las compras más viejas primero). Sin la migración se sigue calculando como antes. Calendario: vista "Todas las deudas" (con y sin fecha, filtros, asignar fecha una por una, con el plazo del proveedor o en lote). "Registrar pago" tiene buscador. Estadísticas: "Cuánto le debés a cada uno" (con el estado de cada parte) en lugar de compras y pagos por mes.
- Pantalla de Caja nueva (`caja/manage-caja.tsx`): franja con el estado y las acciones (Vender, Ingresar / Retirar, Ver detalle, Cerrar caja), tarjeta "En caja ahora" con el extracto (apertura, ventas en efectivo, cobros de fiado, ingresos, retiros, pagos a proveedores, compras en efectivo; sólo se muestran las filas con monto) y tarjeta "Vendido en este turno" con el total y una barra por medio de pago (el fiado va aparte, como pendiente de cobro). Sin cantidad de ventas ni ticket promedio (no se calculan acá). Para dueños y administradores, debajo hay un bloque de tres líneas (Equipo, Fiado, Proveedores: total y, sólo si hay algo urgente, un aviso de deuda vencida; el detalle vive en Clientes y Proveedores), un aviso de faltantes recurrentes que sólo aparece si hay un patrón y el historial como tabla (fecha, quién, horario, esperado, contado y diferencia con color; los medios de pago siguen en el detalle). Sin la antigüedad del fiado (no se calcula ahí). "Movimientos del turno" (en la rama): los ingresos, retiros y pagos a proveedores en efectivo uno por uno; ventas, cobros de fiado y compras en efectivo en una fila cada uno (con la cantidad de ventas), y la apertura; muestra 5 y "Ver todos →" abre el detalle de la caja (se sacó el botón "Ver detalle").
- Excel en Clientes (en la rama): menú "Excel" (sólo dueños/administradores) con Cargar desde Excel, Exportar todos los clientes, Exportar solo los que deben y Descargar planilla modelo. Exportar: todos los planes; cargar: Plan Esencial (`customerImport` en `plan-access.ts`; textos públicos alineados: `plan-features.ts`, `faq-data.ts` —pregunta nueva y fiado—, `blog-data.ts` —cómo controlar el fiado— y `llms.txt`). La exportación trae el ID de Pesito (para volver a subirla sin duplicar) y, en gris, Saldo / Debe desde / Último pago / Última compra, que NO se importan. Importar (`lib/customer-import.ts`, `clientes/import-actions.ts`, `customer-import-dialog.tsx`): crea clientes y, si se pide, actualiza nombre, razón social, teléfono, mail, documento, tipo de factura y notas (una celda vacía nunca borra un dato). Coincidencia con los existentes: ID, documento, mail, teléfono y, por último, nombre único; si hay varios con el mismo nombre y no hay otro dato, la fila se omite con aviso. El saldo (fiado), las ventas y los pagos nunca se tocan (el saldo sólo cambia con funciones del sistema, ver 0045). Pendiente: cargar saldos iniciales de fiado (haría falta una función `security definer` y un criterio de caja).
- Clientes con panel de deuda (en la rama, `clientes/page.tsx` y `clientes-client.tsx`): tarjetas de total y antigüedad (más de 30 días, 8 a 30, hasta 7), pestañas Con deuda / Todos / Al día, "Filtrar" por antigüedad, títulos que ordenan y columnas Te debe, Debe desde, Último pago y Última compra; "Cobrar" abre WhatsApp con un recordatorio armado (si el teléfono es válido) y "Registrar pago". "Debe desde" = la compra a fiado más vieja que sigue sin pagarse, suponiendo que los pagos cancelan primero lo más viejo (es una estimación: el saldo es uno solo por cliente). Última compra sólo se calcula para quienes deben. Sin Excel todavía. También se arregló el margen de más de la lista de Proveedores (CardContent con p-0 no pisa p-5).
- Filtro por sucursal (en la rama, sin probar con datos reales): Caja (`?sucursal=`, `caja/branch-filter.tsx`) filtra equipo, faltantes e historial; Reportes (`?sucursal=`, `reportes/branch-selector.tsx`) filtra ventas, cajas y comparación del período (fiado y stock se ocultan, igual que con el filtro de vendedor) y, sin filtro, muestra la tabla "Ventas por sucursal" justo debajo de los indicadores, seguida del "Resumen del período" (los dos van en `afterTiles` de `ReportesDashboard`; el resumen ya no va arriba de los indicadores) (ventas, vendido, ganancia estimada —Plan Pro, igual que el indicador— y parte del total). Sólo dueños y administradores con más de una sucursal. `reportesHref(query, sellerId, branchId)` conserva el filtro al cambiar el período o el vendedor.
- Sucursales y caja (en la rama): con más de una sucursal, la caja dice de cuál es (franja de Caja, bloque del menú, equipo e historial). Al cambiar de sucursal con una caja abierta en otra, el selector pregunta: quedarme, cerrar mi caja primero (te lleva a Caja) o sólo mirar la otra (el punto de venta sigue con la caja y el stock de la sucursal de la caja). Pendiente, si se quiere: una caja por sucursal (cambia la regla de una caja abierta por persona y el límite de cajas por plan) y una vista de todas las sucursales para dueños.
- Menú más compacto (para que entre sin barra de scroll en notebooks): filas y títulos con menos alto, cabecera sin el mail (ya está arriba a la derecha), el bloque de la caja se queda con su tamaño original (estado y ojito, monto grande, "Abierta hace…" y botones).
- Menú reorganizado (`src/lib/nav.ts`): Mostrador (Punto de Venta y Caja; en escritorio los cubre el bloque de la caja), Mercadería (Productos, Compras), Personas (Clientes, Proveedores, Mi equipo = /usuarios), Análisis (Reportes, En vivo), Asistente IA (Qué comprar = /recomendaciones, Baja rotación, Mercado) y, abajo, Ajustes, Mi plan y Ayuda (`footer: true`). Los títulos de pantalla siguen los nombres del menú; la web pública y las FAQ mantienen "Recomendaciones". Buscador del menú (`nav-search.tsx`, Ctrl/⌘ K): sólo lleva a pantallas. Pendiente: numerito rojo en "Qué comprar" cuando hay faltantes críticos (pide una consulta de reposición en el layout).
- Panel lateral, bloque "Turno" (`vender-card.tsx`): junta Vender y Caja (el ítem Caja ya no está en el menú de escritorio). Degradé verde con sombra suave; el monto lleva a Caja y se puede ocultar con el ojito (localStorage `pesito-hide-cash`); pasa a ámbar en los últimos 15 minutos antes de la hora de cierre (`getCashReminder`) o con una caja de un día anterior; con la caja cerrada muestra "Abrir caja" y "Caja". Pendiente: pantalla de Caja nueva (extracto "En caja ahora", "Vendido en este turno", links cortos en lugar de las tarjetas de equipo/fiado/proveedores) y el bloque en el menú del celular (ahí Caja sigue como ítem).
- Celular, Proveedores: el menú muestra el numerito rojo de vencidos (y un punto rojo en el botón del menú) y la tira de 14 días se ve como lista de chips sólo con los días que vencen algo (en escritorio sigue la tira completa).
- Anular un pago a proveedor (migración 0060, **hay que correrla**): botón "Anular" en la cuenta corriente de la ficha, sólo mientras la caja donde se registró siga abierta. `supplier_payments.allocations` guarda a qué compras fue cada pago (lo escriben `register_supplier_payment` y `register_supplier_purchase_payments`, mismas firmas); `void_supplier_payment` devuelve el saldo y lo pagado de cada compra y **borra** el pago (así la caja recupera el dinero). Los pagos anteriores a 0060 no tienen el reparto: se devuelve de las compras que se pagaron último (aproximado). Plan Esencial.
- Proveedores, vencimientos más visuales: arriba cuatro tarjetas (Deuda total, Vencido en rojo, Vence esta semana en ámbar, Más adelante con lo sin fecha) y la tira "Próximos 14 días" con el monto de cada día (hoy suma lo vencido); tocar un día filtra la lista. Calendario: cada vencimiento muestra el monto primero y el nombre abajo, y "+N más · monto" cuando hay varios. Se sacó el interruptor "por vencimiento / por antigüedad" del resumen.
- Proveedores, versión final (migración 0059 `register_supplier_purchase_payments`, **hay que correrla**; sin ella el pago por monto sigue andando y pagar facturas puntuales avisa que falta actualizar): lista de 4 columnas (Proveedor, Le debés, Próximo pago "monto · cuándo", Última compra) con filas que se despliegan compra por compra ("Pagar esta", "Asignar/Cambiar fecha"), pestañas Con deuda / Todos / Al día + "Filtrar" por estado, títulos que ordenan al tocarlos, Excel como ícono, WhatsApp que aparece al pasar el mouse, saldo a favor como "A tu favor". El pago tiene dos modos: "Un monto" (avisa si es más de lo que se debe: queda a favor y se descuenta de la próxima compra a cuenta; si es menos, muestra qué queda de cada compra) y "Elegir qué facturas pago" (monto editable por compra, tope = lo que falta). El calendario paga la compra puntual cuando el día tiene una sola. La ficha del proveedor también tiene "Pagar esta" en cada compra.
- Proveedores simplificado (rama `claude/dazzling-dirac-ybwunn`, **sin pasar a `main` todavía**; migración 0057 `suppliers.payment_terms_days`, hay que correrla): resumen en una tarjeta, estadísticas en desplegable, lista que arranca en "Con deuda", títulos de columna con orden y filtro (las pestañas son atajos del filtro de estado), WhatsApp por proveedor (`chatWhatsappUrl`, asume celulares argentinos), descarga de la deuda en Excel (`debt-excel.ts`), plazo de pago por proveedor (la compra a cuenta trae el vencimiento puesto), pago parcial con el reparto entre compras (`applyPayment`, con fecha primero y sin fecha después) y numerito rojo en el menú con los proveedores con deuda vencida (`countOverdueSuppliers`, sólo menú de escritorio: el del celular no muestra etiquetas).
- Proveedores rediseñado (migración 0056, **hay que correrla en Supabase**; sin ella todo anda pero las compras quedan "sin fecha" y no se cargan días de entrega): panel con deuda por vencimiento (vencida / vence pronto en 7 días / no vencida / sin fecha) o por antigüedad, tarjeta de vencidas y próximo vencimiento, gráfico de compras y pagos de 6 meses, a quién se le compra más, calendario corto, lista con estado de la deuda y filtros, últimos movimientos, y calendario completo en `/proveedores/calendario` (mes/lista, asignar fecha a compras sin vencimiento). La compra a cuenta pide el vencimiento (opcional, `set_purchase_due_date`); los pagos se aplican primero a lo que vence antes (se calcula en `src/lib/supplier-debt.ts`, no se guarda). Días de entrega por proveedor (`suppliers.delivery_days`). Reemplaza la vista en tarjetas. La ficha del proveedor muestra la deuda compra por compra con su vencimiento (se puede asignar, cambiar o quitar) y la cuenta corriente indica cuándo vence cada compra; Compras muestra "vence d/m" en la lista y "Vence el" en el detalle. Migración 0056 ya aplicada en producción.
- En vivo (0055): además de lo vendido, muestra lo ganado hoy (ganancia estimada = venta menos costo actual del producto, igual que Reportes) en el negocio, cada sucursal, vendedor y caja. **Hay que correr la migración 0055 en Supabase** (sin ella la pantalla funciona igual, sin las cifras de ganancia). Cada caja muestra el turno completo y, si arrancó antes de hoy, el desde y "de eso hoy".
- Probado en local: 29 casos de base (venta/compra/anulación/ajuste/transferencia por sucursal, stock insuficiente en una sucursal aunque otra tenga, compatibilidad con código viejo, Pro, otro negocio no ve ni toca) y el flujo completo en el navegador.
- Pendiente / límites: Reportes y Caja no filtran por sucursal todavía (Reportes "stock valorizado" es el total); no se pueden borrar sucursales; si se vence el Pro, las sucursales existentes siguen funcionando pero no se pueden crear nuevas.

## Hecho: En vivo desglosado negocio → sucursal → vendedor → caja

- `/en-vivo` ahora muestra primero el negocio (vendido, ventas, ticket, cajas abiertas, vs ayer), después una tarjeta por sucursal (totales, ticket, cajas abiertas, vs ayer, "la que más vende hoy") y adentro sus vendedores: lo vendido en esa sucursal hoy y sus cajas de esa sucursal (abierta: hace cuánto, efectivo, vendido en la caja; cerradas hoy: horario, vendido y faltante/sobrante). Un vendedor que trabajó en dos sucursales aparece en las dos con lo suyo de cada una. Abajo, ventas por hora y últimas ventas del negocio.
- Migración 0044 (aplicada en producción): `live_overview` suma por caja lo vendido y, en las cerradas hoy, sucursal, apertura y monto de cierre. Sin 0044 la pantalla anda igual pero sin "vendió $X" por caja (y las cajas cerradas quedan en la sucursal asignada de la persona).

## Hecho: landing, planes, preguntas y blog (SEO/GEO)

- Precios: tarjeta del Plan Gratis + cada plan pago con "Todo lo del Plan X, y además"; aviso de 14 días de Pro; lo del Plan IA que no existe aparece como "Pronto" (campo `soon` en `plan-features`).
- Precios en la landing: 4 tarjetas + recorrido en 3 pasos arriba (14 días de Pro → Plan Gratis → plan pago), sin color a propósito para no quitarle atención al Pro. Botón a `/comparar-planes` (también en Recursos y el pie): tabla por tema desde `planComparison` en `plan-features.ts` (mantenerla alineada con las features de cada plan) + preguntas de planes con FAQPage.
- Arreglo: el tope de 150 ventas/mes ya no aplica al Plan Esencial (`hasMonthlySalesLimit` en `lib/subscription.ts`).
- Preguntas: `src/lib/faq-data.ts` (23 en 6 temas; la landing muestra 8). Blog: 10 artículos, autor "Tadeo, de Pesito", `seoTitle` para títulos cortos en Google.
- Distribución de planes (decidida por el usuario): Gratis = 150 ventas/mes, caja y fiado, stock y compras, reportes básicos, 1 usuario/1 caja. Esencial = + ventas ilimitadas, gestión de stock (pestaña Stock: mínimos, faltantes, reposición, movimientos; `stockManagement`), cuentas corrientes de clientes y proveedores, ventas y diferencias de caja por empleado, 2 usuarios/2 cajas. Pro = + aumentos masivos (precios y costos, con deshacer), reportes avanzados de ganancias (qué deja más, a pérdida, comparación de períodos), En vivo, historial completo de caja, 6 usuarios/6 cajas, soporte prioritario (1 sucursal). IA = + hasta 2 sucursales con pases de mercadería (`branches`), soporte 24/7 y funciones IA.
- Bloqueo por plan en la app: `src/lib/plan-access.ts` (`featureMinPlan`, `planLimits`, `canUse`) + `src/lib/plan-limits.ts` (usuarios con invitaciones pendientes, cajas abiertas a la vez, sucursales). Aviso con `ProLockedCard`; el menú muestra "Pro" en En vivo. La prueba Pro cuenta como Pro.
- "Soporte prioritario 24/7" del Plan IA es una promesa comercial.

## Skills del proyecto (`.agents/skills`, con acceso en `.claude/skills`)

- graphify: mapa (grafo) del código en `graphify-out/` para encontrar relaciones sin leer todo. El CLI se instala y el mapa se regenera solo al arrancar cada sesión (`.claude/hooks/graphify-setup.sh`, en segundo plano). `graphify-out/` no se commitea.

Instaladas con `npx skills add` (quedan en `skills-lock.json`). Además de las que ya estaban (docx, pdf, pptx, xlsx, frontend-design, webapp-testing, mcp-builder, skill-creator, find-skills):

- `design-taste-frontend` (Leonxlnx/taste-skill): diseño "anti-plantilla" para landing, portfolios y rediseños. Ella misma aclara que **no** es para dashboards ni tablas: usarla para la web pública, no para el panel.
- `image-to-code` (Leonxlnx/taste-skill): genera imágenes de referencia de un diseño y lo implementa a partir de ellas. Pensada para Codex; acá sirve sobre todo pasándole una captura o un diseño para copiar.
- `web-design-guidelines` (vercel-labs/agent-skills): auditoría de UI/accesibilidad contra las Web Interface Guidelines de Vercel ("revisá la UI de …").
- `playwright-cli` (microsoft/playwright-cli): manejar el navegador desde la terminal para probar pantallas; si no está el comando, se instala con `npm install -g @playwright/cli@latest`.
- `design-references` (propia, `.agents/skills/design-references`): usa la colección awesome-design-md (VoltAgent, 74 `DESIGN.md` de marcas como Stripe, Linear, Notion, Wise) como fuente de ideas. No copia los archivos al repo: baja el `DESIGN.md` que haga falta desde raw.githubusercontent.com en el momento. Regla: tomar ideas (layout, densidad, tipografía, componentes) y aplicarlas con los tokens de Pesito, sin copiar logos, paletas ni fuentes de otra marca.

Nota: el buscador de skills.sh está bloqueado en este entorno (`npx skills find` no encuentra nada), pero `npx skills add owner/repo --skill <nombre>` funciona porque va por GitHub. El nombre de `--skill` es el `name:` del SKILL.md, no la carpeta (`--list` los muestra).

## Hecho: seguridad (migraciones 0045 y 0046, aplicadas en producción)

Revisión con la checklist de 20 puntos. Ya estaba bien: claves (sólo la anon en el navegador), SQL injection (todo parametrizado), aislamiento entre negocios (RLS en las 31 tablas), /admin (requirePlatformAdmin + 404), `npm audit` limpio.
Arreglado en 0045 (probado en local con ataques de un vendedor, todos rechazados, y el flujo normal abrir/retirar/vender/cerrar OK):
- Caja: cerrada = intocable; sólo quien la abrió o un admin la cierra; el esperado lo calcula la base (`cash_register_summaries`); movimientos de caja no se editan ni borran; no se borran cajas.
- Saldos de clientes/proveedores y stock (con sucursales) sólo cambian vía funciones del sistema (`is_direct_write()`: current_user authenticated/anon). Sin insert directo de ventas/compras.
- Imágenes: carpeta `<org_id>/` por negocio, sólo imágenes, 5 MB. La app sube a esa carpeta (`ProductForm` recibe `orgId`).
- Bloqueo de ingreso: las RPC de login_lockouts sólo con service role (la app usa `createAdminClient`).
- Plan y límites en la base: `require_plan`, `plan_limit`, `require_user_slot` (mismos valores que `plan-access.ts`) en aumentos masivos, En vivo, cuenta corriente de proveedores, sucursales, pases, invitaciones/usuarios y cajas abiertas.
- `?next=` del login y del mail de confirmación sólo acepta rutas internas (`lib/safe-redirect.ts`).
- Backups: el plan gratis de Supabase no tiene copias diarias; pendiente cuando se pase a Supabase Pro.
- Migración 0046: verificación en dos pasos OPCIONAL (TOTP, Configuración → Seguridad). `is_org_member`/`is_org_admin` exigen `aal2` sólo a quien la activó (`mfa_ok()`), así que sin el código la base no muestra nada. El login consulta los factores y deja la cookie `pesito-mfa` para que el middleware mande a `/login/verificar`. En Supabase de producción TOTP viene activado por defecto (Authentication → Multi-Factor).
- `login_events` (0046): cada ingreso con su dispositivo (cookie `pesito-device`); aviso en el panel a dueños/admins por ingresos desde un dispositivo nuevo (48 h) y "Últimos ingresos" en Configuración → Seguridad.
- Cabeceras de seguridad en `next.config.ts` (X-Frame-Options, frame-ancestors, nosniff, HSTS, Referrer/Permissions-Policy).

## Hecho: cobro de los planes con Mercado Pago (migración 0047)

- Checkout con plan (`/preapproval_plan`, uno por cobro con `external_reference` = `org|plan|ciclo`): Configuración → Plan → "Contratar"/"Cambiar al" → mensual o anual (12 meses con 20% menos, débito automático cada 12 meses) → `init_point`. No se pide el email de Mercado Pago: en el checkout pagan con tarjeta o iniciando sesión. La suscripción que se crea trae `preapproval_plan_id` y de ahí se saca el negocio (`referenceOf` en `lib/billing.ts`).
- Alta con plan pago desde precios: `/registro?plan=&anual=` guarda `selected_plan`/`selected_cycle` en el usuario → onboarding crea el negocio → `/suscribirse` (paga con Mercado Pago, vuelve ahí con `?preapproval_id` y entra al POS). Link discreto para seguir con el Plan Gratis.
- El checkout se abre en otra pestaña y la pantalla pregunta cada 4 s (`checkPendingCheckout`) si ya se pagó: Mercado Pago no vuelve solo a Pesito en las suscripciones. Cada checkout se anota en `billing_events` (topic `checkout`) y `syncPendingCheckouts` busca su pago con `/preapproval/search?preapproval_plan_id=` (también al abrir Configuración → Plan), así el plan se activa aunque no llegue el webhook ni vuelva con el id.
- El plan actual se ve siempre en la barra lateral ("Plan Pro", "Prueba Pro").
- Pantalla de pago `/suscribirse?plan=&ciclo=&metodo=&desde=alta` (diseño "B": panel del plan con su color a la izquierda, pago a la derecha; en celular una columna). Se llega desde Configuración → Plan ("Contratar") y como paso 3 del alta. Mensual/anual y dos formas de pago:
  - Débito automático (`/preapproval_plan`).
  - Pago único (Checkout Pro `/checkout/preferences`, `external_reference` = `org|plan|ciclo|u<id>`): un mes o un año con tarjeta, dinero en cuenta o efectivo; se guarda como `payment_status = 'cancelled'` sin `mp_preapproval_id` (vence solo por `org_effective_plan`), se suma al tiempo pago del mismo plan y da de baja un débito anterior. Efectivo: queda "Pago pendiente" hasta que se acredita. Aviso para renovar 5 días antes (`expiringPaidPlan`).
  - Vuelta de Mercado Pago en la pestaña del pago: `/suscribirse/listo`. Webhook: también topic `payment` (hay que tildar "Pagos" en el webhook de Mercado Pago).
- `lib/mercadopago.ts` (API + firma de avisos), `lib/billing.ts` (aplica suscripciones y cobros; `external_reference` = `org|plan|ciclo`), webhook `/api/mercadopago/webhook` (público, verifica `x-signature` y siempre re-consulta la API), acciones en `configuracion/billing-actions.ts` (contratar, cancelar, actualizar medio de pago, sincronizar al volver con `?preapproval_id=`).
- Estados en `organization_subscriptions`: `payment_status` active / past_due (gracia 7 días) / cancelled (sigue hasta `current_period_end`). `org_effective_plan` (base) y `getSubscription` (app) bajan a Gratis al vencer; no hay tarea programada.
- Cambio de plan = suscripción nueva; al autorizarse se cancela la anterior (sin prorrateo).
- Configuración pendiente del lado del usuario: `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en Vercel; en Mercado Pago → Tus integraciones → Webhooks: URL `https://www.pesito.com.ar/api/mercadopago/webhook`, eventos "Planes y suscripciones".

## Funciones pendientes (tasklist)

Anunciadas en la web como "Pronto" pero todavía no existen. Al hacer cada una: controlarla con `canUse` (ya tiene su plan en `featureMinPlan`), sacarle el "Pronto" en `plan-features.ts` (cards y `planComparison`), `faq-data.ts`, blog y páginas por rubro.

- [x] Carga masiva de productos con Excel — Plan Esencial (`productImport`). Botón "Cargar desde Excel" en Productos (sólo administradores): planilla modelo .xlsx, acepta .xlsx y CSV, reconoce las columnas por título, muestra una vista previa con errores antes de guardar, no duplica (mismo código de barras o SKU; interruptores para elegir qué datos actualizar: precio, costo, marca, nombre, stock mínimo, unidad, SKU, código) y respeta el límite de productos del plan. Sin migración: `src/lib/product-import.ts` (lectura en el navegador), `productos/import-actions.ts` (por tandas de 250), `productos/import-dialog.tsx`. Con sucursales, el stock inicial entra por `adjust_branch_stock`.
- [x] Generar e imprimir códigos de barras — Plan Esencial (`barcodeLabels`). Los códigos propios son EAN-13 que empiezan con 200 (rango de uso interno de GS1, no choca con productos de fábrica) y se generan al azar sin repetirse dentro del negocio (`src/lib/barcode.ts`, `productos/barcode-actions.ts`). Botón "Generar" en el formulario del producto y diálogo "Etiquetas" (elegir productos, generar los que faltan, tamaño de etiqueta, copias, precio) que imprime con el diálogo del navegador. Sólo imprime EAN-13 y UPC-A; otros códigos se marcan "No es EAN-13". Sin migración: la unicidad se controla al generar (no hay índice único en la base).
- [ ] **ANTES DE LANZAR ANUNCIOS (Google Ads y Meta Ads) — recordarle al usuario cuando avise que va a hacer ads** (Analytics y Clarity ya están; hoy no se usan cookies de publicidad):
  - Píxel de Meta (más adelante idealmente con la API de conversiones), mandando los mismos eventos: `sign_up`, `begin_checkout`, `purchase` (`src/lib/track.ts`).
  - Google Ads: cuenta vinculada a Analytics (`G-D1HHB4MG1Q`); activar etiquetación automática, marcar `sign_up` y `purchase` como eventos clave en Analytics, importarlos como conversiones en Ads y tener activo el uso compartido "Productos y servicios de Google".
  - Banner de consentimiento de cookies y actualizar `/privacidad` (hoy dice que no hay cookies de publicidad; ya menciona Analytics y Clarity).
  - Opcional: mandar `purchase` desde el servidor (Measurement Protocol) para no perder pagos si la persona no vuelve a `/suscribirse/listo`.
- [ ] Combos y kits — Plan Esencial (`productBundles`). En la card del Esencial: "Talles, combos y kits".
- [ ] Talles y colores como variantes de un producto — Plan Esencial (`productVariants`). Mencionado también en /como-funciona, /comparacion y /pesito-para/indumentaria.
- [ ] Ofertas y promociones — Plan Pro (`promotions`).
- [x] Ganancias separadas por sucursal (reportes) — Plan IA: columna de ganancia estimada en la tabla por sucursal de Reportes.
- [ ] Control por usuario: una vista por persona con sus movimientos de stock, de caja (retiros, ingresos, aperturas y cierres) y sus diferencias — Plan Pro (`userActivity`). Los datos ya se guardan (`user_id` en `stock_movements` y `cash_movements`); falta la pantalla. En el Esencial ya están los reportes de ventas y diferencias de caja por vendedor.
- [ ] Inventarios físicos (contar todo el stock y ajustar las diferencias de una vez) — Plan Pro (`physicalInventory`). Hoy sólo existe el ajuste a mano por producto.
- [ ] Balanzas conectadas — Plan Pro (`scales`). En el POS ya hay un botón "Balanza (próximamente)".
- [ ] Carteles de precios para imprimir, que se arman solos con el precio actual — Plan Pro (`priceSigns`).
- [ ] Catálogo online (1 por negocio) — Plan Pro (`onlineCatalog`).
- [ ] Factura electrónica ARCA/AFIP: la web dice que no existe (no está anunciada como "Pronto").

Ideas aprobadas por el usuario (7/10/2026), sin hacer. Al hacer cada una: definir plan (`featureMinPlan`), alinear textos públicos y sacar el "Pronto".

Para el cliente:
- [ ] Factura electrónica ARCA, por etapas (primero factura C para monotributistas). Hoy la web dice que no existe. Candidata a Esencial o Pro.
- [ ] Cobro con QR de Mercado Pago o MODO integrado al POS, con la venta marcada como pagada sola.
- [ ] POS sin internet: guarda las ventas y las sube al reconectar.
- [ ] Catálogo online y pedidos por WhatsApp (ya figura como "Pronto" en el Pro).
- [ ] Resumen diario por WhatsApp o mail: ventas, caja, deuda nueva y qué reponer.
- [ ] Recordatorio automático de deuda en fechas elegidas (hoy sólo el botón manual de WhatsApp).
- [ ] Impresión en impresoras térmicas y etiquetas, con plantillas con el logo del negocio.
- [ ] Inventario físico con el celular escaneando códigos (junto con "Inventarios físicos").
- [ ] Plan IA: preguntarle al sistema en lenguaje natural ("¿cuánto vendí de bebidas este mes?").
- [ ] Plan IA: alertas proactivas (producto que dejó de venderse, costo que subió, cliente que dejó de venir).

Para Pesito (negocio):
- [ ] Panel interno de métricas: altas por día, paso de prueba Pro a pago, plan elegido, caídas en el registro, uso por función. **Prioridad 1.**
- [ ] Correos automáticos del ciclo de vida: bienvenida, "cargá tus primeros productos", "te quedan 3 días de Pro", pagos fallidos. **Prioridad 2.**
- [ ] Onboarding guiado dentro del panel: lista de pasos y negocio de ejemplo.
- [ ] Programa de referidos (un mes gratis por traer otro negocio).
- [ ] Más SEO/GEO: páginas por rubro y ciudad, "alternativas a X" por competidor, glosario.
- [ ] Copias y exportación completa de datos, visible para el cliente.
- [ ] Alertas internas de errores y de cobros (Sentry o similar; aviso si falla el webhook de Mercado Pago).
- [ ] Rutina mensual de Claude (a definir con el usuario): revisar competencia de `blog-rankings.ts` y auditar coherencia de textos públicos, en rama con aviso.
- Orden sugerido: métricas internas, correos del ciclo de vida, factura electrónica por etapas.

Técnicas pendientes:
- [ ] Bloqueo por plan también en la base: hoy se controla en las páginas y acciones del servidor; las RPC (`bulk_increase_field`, `live_overview`, etc.) se podrían llamar directo con el token del usuario.
- [ ] Menú del celular (`mobile-nav.tsx`): no muestra las etiquetas ("Pronto", "Pro") ni oculta los ítems sólo para administradores.

## Pendiente

- Speed Index en móvil: 3,8 s (naranja), el resto en verde.
- Accesibilidad 96: ver qué aviso queda.

## Ideas pendientes (funcionalidad, no relacionadas a performance)

Estas no están en ninguna consulta a la base ni en Vercel — son ideas de producto anotadas y no arrancadas. La lista completa con más detalle vive en la tarea de cada sesión (`TaskList`), pero eso es local a cada sesión, así que quedan resumidas acá para que cualquier sesión nueva las vea:

- Tour interactivo de onboarding (primera venta guiada).
- Reportes con tabs (Resumen/Ventas/Productos/Métodos de pago/Historial).
- Más toggles en Configuración → Sistema.
- Modal de ayuda de atajos de teclado en el POS.
- Sistema de "temas" visuales seleccionables (Neobrutalismo, Terminal, Fintech pop, etc.).
- Facturación electrónica ARCA/AFIP (pausado, falta definir proveedor).

### Sucursales / multi-usuario (a futuro)

- Reportes y Caja filtrados por sucursal (En vivo y el stock ya son por sucursal).
- Reportes por sucursal y por caja (por vendedor ya está).
- Cierres automáticos de caja por horario (los recordatorios ya están).
- Sugerencia de compra automática (stock para X días, por proveedor/marca/producto).
- Preguntar el objetivo del usuario en el onboarding.

## Cómo reproducir la simulación

1. `npx supabase init`
2. `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,mailpit,supavisor`. Si Docker Hub devuelve 429, reintentar el `docker pull` de cada imagen.
3. `.env.local` apuntando a `http://127.0.0.1:54321` con las keys que imprime el paso anterior.
4. `npm run build && npm run start`.
5. Registrarse, crear vendedores desde Usuarios y cargar ventas llamando a las RPC (`checkout_sale`, `register_purchase`) con los usuarios reales.

Ojo: la base local y un `next start` de una sesión anterior pueden seguir vivos. Mirar `select version from supabase_migrations.schema_migrations` (aplicar las que falten con `psql -f`) y que el puerto 3000 no lo tenga otro proceso.

No commitear `supabase/config.toml`, `supabase/.gitignore`, `supabase/.branches/` ni `.env.local`.

## Hecho: período de gracia al bajar de plan (migración 0048)

- Pasar a un plan más barato: 7 días con el plan anterior (`grace_plan` / `plan_grace_until`, lo escribe `downgradeGraceFields` en `lib/billing.ts`). Débito cancelado o pago único vencido: 7 días más después del fin del período. Cobro fallido: 7 días (0047). La prueba Pro no tiene gracia.
- `org_effective_plan` (misma firma) y `lib/subscription.ts` (`grace`) aplican la misma regla. Avisos en el panel ("Pasaste al…", "Tu plan venció…").
- Usuarios de más pasada la gracia: pausados los últimos que se sumaron, nunca el dueño (`lib/member-pause.ts`, controlado en `requireOrgContext` → `/cuenta-pausada`). Se ven como "Pausado" / "Se pausa el …" en Usuarios. Control sólo en la app (no en `is_org_member`, para no sumar una consulta a cada política).
- Pendiente del usuario: correr 0048 en Supabase.

## Hecho: precios nuevos con promo del primer mes

- Precios: Esencial $17.000, Pro $29.000, IA $34.000 (`plan-features.ts`). Promo de lanzamiento: el primer mes pagando mensual a $15.000 / $25.000 / $28.000 (`promoPrice`), sólo para quien nunca pagó un plan (`isPromoEligible` en `lib/billing.ts`). El anual no tiene promo (ya tiene 20% menos).
- Débito automático: el plan de Mercado Pago se crea con el monto promo y, recién con el primer cobro APROBADO (`/authorized_payments/search`), `bumpPromoAmount` la pasa al precio normal (`PUT /preapproval/{id}`). Se revisa al autorizarse, con cada cobro que llega y al abrir Planes (`ensurePromoEnded`), así un reintento del primer cobro sale con la promo. Sólo las que salieron de un checkout con `promo: true`.
- Pago único mensual: el primer pago con la promo; se acepta el monto promo en `applyOneTimePayment`.
- Textos: landing, comparar planes, JSON-LD, FAQ, llms.txt, registro, Planes y la pantalla de pago.

## Hecho: límite de productos por plan (migración 0049) y página Planes

- Productos activos: Gratis 1.000, Esencial 4.000, Pro 12.000, IA 20.000 (`planLimits.products`; los desactivados no cuentan). Se controla al crear y al reactivar (`checkProductLimit`) y en la base (`guard_product_limit`, `plan_limit(..., 'products')`, misma firma). Cerca del límite se ve "X de Y productos"; al llegar, "Nuevo producto" lleva a contratar el plan siguiente.
- Planes tiene su página (`/planes`); `/configuracion?tab=plan` redirige. Configuración queda sólo con los datos del negocio.
- Pendiente del usuario: correr 0049 en Supabase (y 0048 si todavía no).

## Hecho: funciones del Plan IA sin modelo (migración 0050)

- Baja rotación (`/baja-rotacion`, `lowRotation`), Recomendaciones (`/recomendaciones`: reposición `restockRecommendations` + precios `priceSuggestions`). Son cuentas sobre las ventas, sin llamar a ningún modelo de IA: `src/lib/product-insights.ts`. Los planes bloquean con `ProLockedCard`; el menú muestra el plan.
- Baja rotación: productos con stock, más viejos que el período (60/90/180 días), sin ventas o con stock para más de 6 meses; ordenados por plata parada (stock × costo).
- Reposición: ritmo de los últimos 30 días, stock para 14 días, nunca menos que el mínimo; agrupado por proveedor habitual con pedido para WhatsApp. Sin proveedor asignado queda en "Sin proveedor asignado".
- Precios: costo que subió después del último cambio de precio (mismo margen), vendido a pérdida o con menos de 10% (margen de la marca o del negocio); "Aplicar" cambia `products.price` (queda en el historial). Sólo dueño/admin.
- Migración 0050 (aplicada en producción el 2026-09-28): `product_sales_stats(p_org_id, p_days, p_branch_id)` (exige plan IA con `require_plan`). Sin 0050 las pantallas dan error.
- Reportes avanzados con IA (`aiReports`): tarjeta "Resumen del período" arriba de Reportes, escrita con reglas fijas sobre los números del período (`src/lib/report-insights.ts`: tendencia, margen, mejor día y hora pico, producto estrella, ventas a pérdida, medio de cobro, fiado). Sin modelo ni conexión externa. Sin el plan, aviso con `PlanLockNote`.
- Análisis de mercado (`marketAnalysis`): pantalla `/mercado` (menú IA) con notas que carga Pesito desde `/admin` → "Análisis de mercado" (tabla `market_insights`, migración 0051, aplicada en producción el 2026-09-28; lectura por `market_insights_for`, que exige plan IA y filtra por rubro). El contenido lo juntamos nosotros (con IA o a mano); los clientes no se conectan a ninguna IA. Cargar sólo información verificada y con fuente.
- Recomendación de compra, etapa 1 (migración 0052, aplicada en producción el 2026-09-29): plazo de entrega por proveedor (`suppliers.lead_time_days`, se carga en el formulario del proveedor), unidades por bulto por producto (`products.pack_size`, en el formulario del producto: el pedido sale en bultos enteros) y ajustes del negocio (`organizations.restock_target_days` 14, `restock_window_days` 30, `restock_safety_days` 0; panel "Cómo se calcula" en Recomendaciones, sólo administradores). Cantidad a pedir = ritmo × (cobertura + plazo + colchón) − stock, mínimo el stock mínimo. "Urgente" si alcanza menos que el plazo + colchón (mínimo 3 días); "Se acaba antes de que llegue un pedido" si alcanza menos que el plazo. Falta: nada de las 3 etapas (mini gráfico de venta por producto quedó afuera: pide una consulta nueva de ventas por semana).
- Recomendaciones rediseñada: pantalla de inicio "Hoy tenés que pedirle a N proveedores" (una tarjeta por proveedor con lo urgente en palabras y un botón Armar pedido) y pantalla para armar el pedido (`recomendaciones/restock-flow.tsx`, datos preparados en `src/lib/restock-view.ts`). Estados en palabras de negocio (Ya se acabó / Se acaba pronto / Queda poco), barra con la marca de cuándo llega el pedido, "¿Por qué esta cantidad?" en una frase, cantidad con − y +, lo que no urge queda plegado ("Pueden esperar" / "Sumar al pedido"), mensaje visible, WhatsApp / Copiar / Mail y, después de mandarlo, "¿Ya se lo mandaste?" que lo deja en camino. Reemplaza la tabla anterior y el resumen con gráfico de gasto. Pendiente para más adelante: revisar los grupos "hoy / esta semana / pueden esperar" (hoy: urgente = se acaba antes de plazo + colchón, mínimo 3 días).
- Recomendaciones: vuelve la versión de cuadrados por proveedor (encabezado con "Empezar a pedir · 1 de N", totales, gráfico por proveedor, buscador y filtros, pantalla aparte para armar el pedido, Saltear, elegir proveedor cuando no tienen uno habitual). Se probó una versión simple con filas que se abren en el lugar (acordeón) y no gustó: se ve pegada y poco clara. Sigue de esa prueba: en Esperando, "Llegó → cargar la compra" abre Compras (`/compras?pedido=`) con los productos y cantidades que faltaban recibir. Se le sacó lo innecesario: las 4 tarjetas de totales, el filtro de urgencia, el orden, el filtro por proveedor, "Limpiar" y el interruptor de proveedores de esta semana (al terminar el recorrido de hoy ofrece "Seguir con esos"); "Cómo se calcula" pasó a un engranaje junto al buscador. Pendiente: historial de pedidos cerrados.
- Recomendaciones, pantalla del pedido: dos cajas separadas. "En tu pedido" (con cantidades, subtotal y aviso "Esto es lo que vas a pedir") y "¿Querés sumar algo más? · todavía no está en tu pedido" (sugeridos sin cantidad ni subtotal, botón "+ Sumar al pedido", "Sumar todos", "Ver todos", aviso "Sumado · Deshacer"). Reemplaza "Pedilo hoy / esta semana" y "Pueden esperar" dentro del pedido. Sin verlo renderizado todavía.
- Recomendaciones, ajustes de cálculo: línea fija arriba del encabezado ("Calculamos para tener stock para [− 14 días +] después de que llegue, con [− 5 días +] de reserva"), editable con − y +, se guarda sola y recalcula. El engranaje abre una ventanita con los días de ventas a mirar y "Ver ejemplo". Se sacó el buscador. "¿Por qué esta cantidad?" ahora es una cuenta con renglones y cada producto del pedido tiene ✕ para sacarlo. Sin verlo renderizado todavía.
- Recomendaciones, gráficos nuevos (reemplazan el de gasto por proveedor; en `restock-flow.tsx`, `RestockCharts`): barra del pedido total hoy/semana con porcentajes, "Qué pasa si no pedís" (ventas que se perderían en 7 días: ritmo × días sin stock × precio de venta; es una estimación y se dice así), "Los que más vendés y se te acaban" (5 productos) y "Lo que se te va acabando, día por día". Los ajustes del cálculo pasaron a una línea tipo operación debajo de los gráficos. Sin verlo renderizado todavía.
- Google Analytics y Microsoft Clarity (`src/components/analytics.tsx`, en el layout raíz): sólo en la web pública (landing, blog, precios, FAQ, etc.), nunca en el panel, porque Clarity graba pantallas. Se activan con `NEXT_PUBLIC_GA_ID` y `NEXT_PUBLIC_CLARITY_ID` (sin ID no cargan nada); carga diferida para no afectar PageSpeed. La política de privacidad ya lo dice. GA se carga con `NEXT_PUBLIC_GA_ID` en Vercel; el ID de Clarity (público) va como valor por defecto en el componente.
- Eventos de medición (`src/lib/track.ts`, `components/track-event.tsx`): `sign_up` al llegar a Onboarding (una vez por navegador), `begin_checkout` al tocar pagar en Suscribirse y `purchase` (con valor en ARS y plan) en `/suscribirse/listo` cuando el pago figura activo, una vez por pago. Google Analytics también mide `/registro`, `/onboarding` y `/suscribirse`; Clarity sólo la web pública. Límite: `purchase` sólo se manda si la persona vuelve a `/suscribirse/listo` (si cierra la pestaña antes, no se cuenta; lo cubriría un evento desde el servidor con Measurement Protocol). Falta: marcarlos como eventos clave en Analytics y sumar píxel de Meta y aviso de cookies antes de anunciar.
- Recomendación de compra, etapa 3 (migración 0054, aplicada en producción el 2026-09-29): pedido mínimo por proveedor (`suppliers.min_order_amount`, en el formulario del proveedor; el grupo avisa cuánto falta para llegar). Sin migración: resumen arriba de Recomendaciones (sin stock, urgentes, pedido estimado, en camino), barra de días de stock por producto, gráfico de cuánto se gastaría en cada proveedor y aviso "Pocos datos de venta" (producto de menos de 14 días o con ventas en menos de 3 días). Código en `recomendaciones/restock-visuals.tsx`.
- Recomendación de compra, etapa 2 (migración 0053, aplicada en producción el 2026-09-29): pedidos en camino (`restock_orders` y `restock_order_items`). El botón "Ya lo pedí" de cada proveedor en Recomendaciones guarda el pedido con la fecha estimada (pedido + plazo del proveedor); mientras está pendiente, la cantidad sugerida descuenta lo que viene en camino. Se cierra solo cuando se registra una compra a ese proveedor (`registerPurchase` llama a `applyPurchaseToOrders`: descuenta lo recibido producto por producto, del pedido más viejo al más nuevo, y cierra los completos) o a mano con "Llegó" / "Cancelar". Anular una compra no reabre el pedido. Código en `src/lib/restock-orders.ts`.
- Texto público alineado (`plan-features`, comparar planes, FAQ, llms.txt, landing, indumentaria). Quedan como "Pronto" en el Plan IA sólo las ganancias por sucursal. Análisis de competidores puntuales NO existe y se quitó del texto público (llms.txt lo aclara).

## Frases de portada para reutilizar (rediseño de la landing, 2026-09-30)

La portada quedó con **"El sistema para manejar tu negocio sin dolores de cabeza"** (pedido del usuario: le gusta esa frase). Estas otras se probaron y se guardan para usar en otros lados (secciones, CTA final, blog, anuncios, redes). Sólo prometen lo que el sistema ya hace.

Títulos:
- "Cobrás, y todo lo demás se hace solo" (ahora en el subtítulo de la portada)
- "Tu negocio entero, en una sola pantalla"
- "Lo que hoy anotás en el cuaderno, lo hace Pesito"
- "Dejá el cuaderno y la calculadora. Pesito lleva la cuenta."
- "Cobrá en el mostrador. Controlá desde donde estés."
- "De abrir la caja a cerrarla, Pesito te acompaña"
- "Cobrá, controlá el stock y cerrá la caja desde un solo lugar"
- "Una venta. Todo se actualiza solo."
- "Sabé cuánto vendiste, qué te falta y quién te debe"
- "Hacé tu primera venta en 10 segundos" (para una demo que se toca)

Subtítulos:
- "Cobrá, controlá el stock, cerrá la caja y anotá el fiado. Todo se actualiza solo con cada venta."
- "Quién te debe, cuánto vendiste, qué pedir, si la caja cuadra. Todo ordenado, sin sumar a mano."
- "Vendés desde la compu o la tablet y mirás las ventas del día en tu celular. Stock y caja siempre al día."
- "Un solo sistema para todo el día del negocio."

Frases chicas (eyebrows, etiquetas):
- "Sistema de ventas, stock y caja"
- "Punto de venta para tu negocio" (la que usa la portada)
- "Funciona en el navegador, sin instalar nada"
- "Probalo ahora, sin registrarte"

Ideas de diseño guardadas: costados de la portada con nodos y avisos (hecho: F), celular + impresora + tarjetas conectadas (K), avisos que salen del panel (H), nodos con datos (I), un aviso a la vez (J), feed de avisos (E). Escenas del panel que hoy no corren solas pero se pueden tocar: Caja, Productos, Clientes, Proveedores.

## SEO/GEO: rankings y preguntas frecuentes en el blog (7/10/2026)

- `src/lib/blog-rankings.ts`: 6 listicles "los mejores…" (kioscos, gratis, SaaS POS, stock, fiado, POS general). Pesito va primero y lo decimos de entrada; datos de otros sistemas sólo de sus sitios públicos, con fecha ("consultados el …"), y "consultá en su sitio" cuando no hay dato. Siempre se aclara que Pesito no emite factura electrónica. Al tocar un precio, sale de `planDefinitions`. Revisar fechas y precios de la competencia cada tanto (cambiar `CHECKED`).
- `src/lib/blog-faqs.ts`: ~3 preguntas concretas por cada nota existente; los rankings traen las suyas. Salen como `FAQPage`, y los rankings también como `ItemList`.
- El blog muestra "Respuesta corta", tablas y "Preguntas frecuentes"; sitemap y `llms.txt` salen de `blogPosts`.
- Corregido: `comparacion-data.ts` ya no promete factura electrónica como complemento.

## Webhook de Mercado Pago: sin secreto, en producción se rechaza
- `verifyWebhookSignature` ya no acepta avisos cuando falta `MP_WEBHOOK_SECRET` en producción (antes seguía sin verificar). En desarrollo sigue permitido. Revisado: el aviso sólo dispara una consulta a la API con nuestro token, los pagos únicos validan monto y son idempotentes.
- No se controla la antigüedad de `ts` a propósito: Mercado Pago reintenta avisos viejos y rechazarlos perdería cobros; el manejo es idempotente.

## Security Advisor: migración 0069 (sin aplicar)
- `supabase/migrations/0069_hardening_advisor.sql`: fija `search_path` en 7 funciones, saca a `anon` y `PUBLIC` la ejecución de las funciones de `public` (excepto `get_invitation_preview`, `username_available`, `accept_invitation`, usadas en la página de invitación) y reemplaza la lectura pública de `storage.objects` del bucket `product-images` por lectura de la carpeta del propio negocio (la URL pública de las fotos sigue andando).
- Sin probar contra una base real: aplicar y revisar que el login, el POS, las invitaciones y la subida de fotos sigan andando.
- Pendiente del lado del usuario: "Leaked password protection" (Auth → Password security; en Supabase es de plan Pro).

## Olvidé mi contraseña (sin push hasta aprobación)
- `/olvide-mi-contrasena` (pide el email) → mail de Supabase (SMTP de Resend) → `/auth/confirm?next=/restablecer-contrasena` → `/restablecer-contrasena` (clave nueva, mínimo 8) → se cierra la sesión del link y se vuelve a `/login?restablecida=1`.
- Siempre responde lo mismo exista o no el email. Límites: por IP 5 cada 10 min (CAPTCHA desde el 2.º pedido) y por email 3 por hora, en silencio.
- Usuarios internos (`usuario#1234`) no tienen casilla: se avisa que el dueño les cambia la clave desde Usuarios.
- Pendiente del usuario: probar con un email real; opcional, pasar la plantilla "Reset password" de Supabase (Emails → Templates) a español.

## Registro: avisar si el email ya tiene cuenta (migración 0070)
- Con "Confirm email" activado Supabase no avisa cuando el email existe. `email_registered(p_email)` (0070, sólo `service_role`) lo consulta en `auth.users`; el registro la llama después del límite por IP y del CAPTCHA, y muestra "Ya existe una cuenta con ese email" con links a ingresar y recuperar la contraseña. Si la función no existe todavía, el registro sigue como antes (falla abierto).
- Costo: se puede averiguar si un email tiene cuenta (limitado a 5 intentos cada 10 min por IP, CAPTCHA desde el 3.º). Login y "Olvidé mi contraseña" siguen sin revelarlo.

## Selector de país del teléfono con banderas
- `src/components/ui/phone-country-select.tsx`: desplegable propio con banderas SVG (`country-flag-icons`, sólo los 11 países de `phone-countries.ts`). Los emoji de bandera se ven como letras en Windows y un `<select>` nativo no muestra imágenes. Lo usan el registro (`PhoneInput`) y el formulario de clientes. Teclado: flechas, Enter, Esc.
- Si se agrega un país a `phone-countries.ts`, también va su bandera en el mapa `flags` del componente.

## Ingresar con Google (para crear el negocio)
- Botón "Continuar con Google" en `/login` y "Registrarme con Google" en `/registro` (`src/components/auth/google-button.tsx`, acción `signInWithGoogle`). Permisos básicos (email, perfil): sin verificación de Google ni tope de usuarios. Requiere el proveedor Google activado en Supabase con las credenciales de Google Cloud.
- Sin leyendas de "sólo dueños" en pantalla. Vuelve por `/auth/confirm`: si la cuenta es de equipo (usuario interno, o miembro sin ser dueño de ningún negocio) se cierra la sesión y se manda a `/login?error=google_solo_duenos`; quien no tiene negocio sigue a `/onboarding`. Con verificación en dos pasos pasa por `/login/verificar`. El plan pago elegido en precios viaja como `plan`/`cycle` y se guarda como en el registro con email.
- La invitación no se puede aceptar con una sesión de Google. El botón no está en `/invitacion`.
- Textos al día: FAQ ("¿Puedo crear mi cuenta o ingresar con Google?"), `llms.txt`, política de privacidad.
- El login con Google no pasa por el CAPTCHA ni por los contadores del login (lo valida Google); tiene su propio límite por IP (20 por minuto).
- Sin probar con Google real (no se llega desde el entorno de desarrollo).
- Cuenta vinculada: si alguien con cuenta de email y contraseña entra con Google usando el mismo email, Supabase une las dos; se le muestra una vez `/cuenta-vinculada` ("Vinculamos tu cuenta de Google", con link para cambiar la contraseña si no fue ella). Se detecta porque la identidad de Google se creó hace menos de 2 minutos y ya había otra.
- Alta con Google: `/onboarding` pide además el teléfono (mismo selector con banderas) cuando la cuenta no lo tiene; `createKiosco` lo valida (8 dígitos o más) y lo guarda en el negocio. El nombre para el saludo sale de `first_name`, `given_name` o la primera palabra de `full_name`/`name` (`lib/org.ts`).

## Nombre del negocio: 2 líneas y tope de 30 caracteres
- Menú lateral (`sidebar.tsx`): el nombre ocupa hasta 2 líneas (`line-clamp-2`) y muestra el nombre entero al pasar el mouse. El menú del celular no se tocó (sigue con "…").
- Tope `BUSINESS_NAME_MAX = 30` (`lib/business-name.ts`) al registrarse, al crear el negocio y al cambiarlo en Configuración (formulario y servidor). Los nombres más largos que ya existían se siguen mostrando y se pueden dejar tal cual.
