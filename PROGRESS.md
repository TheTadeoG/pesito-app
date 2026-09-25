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

## Pendiente (por prioridad)

1. **Borrar el cálculo viejo de Caja** (`legacy*` en `src/lib/caja.ts`) cuando se confirme en los logs de Vercel que no aparece "cash_register_summaries falló".
2. **Productos**: renderiza la tabla entera (~2 s con 1.600 artículos). Paginar o virtualizar.
3. **Contra conocida del PR #2**: después de vender, Caja/Reportes/Productos pueden mostrar datos de hasta 30 s atrás si se vuelve a ellos enseguida (`staleTimes` en `next.config.ts`).

## Cómo reproducir la simulación

1. `npx supabase init`
2. `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,mailpit,supavisor`. Si Docker Hub devuelve 429, reintentar el `docker pull` de cada imagen.
3. `.env.local` apuntando a `http://127.0.0.1:54321` con las keys que imprime el paso anterior.
4. `npm run build && npm run start`.
5. Registrarse, crear vendedores desde Usuarios y cargar ventas llamando a las RPC (`checkout_sale`, `register_purchase`) con los usuarios reales.

Ojo: la base local y un `next start` de una sesión anterior pueden seguir vivos. Mirar `select version from supabase_migrations.schema_migrations` (aplicar las que falten con `psql -f`) y que el puerto 3000 no lo tenga otro proceso.

No commitear `supabase/config.toml`, `supabase/.gitignore`, `supabase/.branches/` ni `.env.local`.
