# Progreso

Última actualización: 2026-09-25.

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
- Probado en local: 29 casos de base (venta/compra/anulación/ajuste/transferencia por sucursal, stock insuficiente en una sucursal aunque otra tenga, compatibilidad con código viejo, Pro, otro negocio no ve ni toca) y el flujo completo en el navegador.
- Pendiente / límites: Reportes y Caja no filtran por sucursal todavía (Reportes "stock valorizado" es el total); no se pueden borrar sucursales; si se vence el Pro, las sucursales existentes siguen funcionando pero no se pueden crear nuevas.

## Hecho: En vivo desglosado negocio → sucursal → vendedor → caja

- `/en-vivo` ahora muestra primero el negocio (vendido, ventas, ticket, cajas abiertas, vs ayer), después una tarjeta por sucursal (totales, ticket, cajas abiertas, vs ayer, "la que más vende hoy") y adentro sus vendedores: lo vendido en esa sucursal hoy y sus cajas de esa sucursal (abierta: hace cuánto, efectivo, vendido en la caja; cerradas hoy: horario, vendido y faltante/sobrante). Un vendedor que trabajó en dos sucursales aparece en las dos con lo suyo de cada una. Abajo, ventas por hora y últimas ventas del negocio.
- Migración 0044 (**falta aplicar en producción, después de la 0043**): `live_overview` suma por caja lo vendido y, en las cerradas hoy, sucursal, apertura y monto de cierre. Sin 0044 la pantalla anda igual pero sin "vendió $X" por caja (y las cajas cerradas quedan en la sucursal asignada de la persona).

## Hecho: landing, planes, preguntas y blog (SEO/GEO)

- Precios: tarjeta del Plan Gratis + cada plan pago con "Todo lo del Plan X, y además"; aviso de 14 días de Pro; lo del Plan IA que no existe aparece como "Pronto" (campo `soon` en `plan-features`).
- Precios en la landing: 4 tarjetas + recorrido en 3 pasos arriba (14 días de Pro → Plan Gratis → plan pago), sin color a propósito para no quitarle atención al Pro. Botón a `/comparar-planes` (también en Recursos y el pie): tabla por tema desde `planComparison` en `plan-features.ts` (mantenerla alineada con las features de cada plan) + preguntas de planes con FAQPage.
- Arreglo: el tope de 150 ventas/mes ya no aplica al Plan Esencial (`hasMonthlySalesLimit` en `lib/subscription.ts`).
- Preguntas: `src/lib/faq-data.ts` (23 en 6 temas; la landing muestra 8). Blog: 10 artículos, autor "Tadeo, de Pesito", `seoTitle` para títulos cortos en Google.
- Pendiente de negocio (no es código): los límites de usuarios por plan (1/2/10) se anuncian pero la app no los controla; "Soporte prioritario 24/7" del Plan IA es una promesa comercial.

## Skills del proyecto (`.agents/skills`, con acceso en `.claude/skills`)

Instaladas con `npx skills add` (quedan en `skills-lock.json`). Además de las que ya estaban (docx, pdf, pptx, xlsx, frontend-design, webapp-testing, mcp-builder, skill-creator, find-skills):

- `design-taste-frontend` (Leonxlnx/taste-skill): diseño "anti-plantilla" para landing, portfolios y rediseños. Ella misma aclara que **no** es para dashboards ni tablas: usarla para la web pública, no para el panel.
- `image-to-code` (Leonxlnx/taste-skill): genera imágenes de referencia de un diseño y lo implementa a partir de ellas. Pensada para Codex; acá sirve sobre todo pasándole una captura o un diseño para copiar.
- `web-design-guidelines` (vercel-labs/agent-skills): auditoría de UI/accesibilidad contra las Web Interface Guidelines de Vercel ("revisá la UI de …").
- `playwright-cli` (microsoft/playwright-cli): manejar el navegador desde la terminal para probar pantallas; si no está el comando, se instala con `npm install -g @playwright/cli@latest`.
- `design-references` (propia, `.agents/skills/design-references`): usa la colección awesome-design-md (VoltAgent, 74 `DESIGN.md` de marcas como Stripe, Linear, Notion, Wise) como fuente de ideas. No copia los archivos al repo: baja el `DESIGN.md` que haga falta desde raw.githubusercontent.com en el momento. Regla: tomar ideas (layout, densidad, tipografía, componentes) y aplicarlas con los tokens de Pesito, sin copiar logos, paletas ni fuentes de otra marca.

Nota: el buscador de skills.sh está bloqueado en este entorno (`npx skills find` no encuentra nada), pero `npx skills add owner/repo --skill <nombre>` funciona porque va por GitHub. El nombre de `--skill` es el `name:` del SKILL.md, no la carpeta (`--list` los muestra).

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
