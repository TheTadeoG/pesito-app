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

## Pendiente

- Speed Index en móvil: 3,8 s (naranja), el resto en verde.
- Accesibilidad 96: ver qué aviso queda.
- Revisar la lista de ideas que se habló en otra conversación (no quedó guardada en el repo).

## Cómo reproducir la simulación

1. `npx supabase init`
2. `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,mailpit,supavisor`. Si Docker Hub devuelve 429, reintentar el `docker pull` de cada imagen.
3. `.env.local` apuntando a `http://127.0.0.1:54321` con las keys que imprime el paso anterior.
4. `npm run build && npm run start`.
5. Registrarse, crear vendedores desde Usuarios y cargar ventas llamando a las RPC (`checkout_sale`, `register_purchase`) con los usuarios reales.

Ojo: la base local y un `next start` de una sesión anterior pueden seguir vivos. Mirar `select version from supabase_migrations.schema_migrations` (aplicar las que falten con `psql -f`) y que el puerto 3000 no lo tenga otro proceso.

No commitear `supabase/config.toml`, `supabase/.gitignore`, `supabase/.branches/` ni `.env.local`.
