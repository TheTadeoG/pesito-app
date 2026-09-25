# Progreso

Última actualización: 2026-09-25.

## Hecho (PR #2, mergeado)

Probamos la app simulando un cliente mediano: almacén con 1.600 productos, 381 clientes, 2 vendedores y 30 días con ~2.500 ventas. Usamos Supabase local + `next start`.

- Reportes, POS, Compras, Productos y Clientes ya no se cortan en 1.000 filas ni en 500/300 productos/clientes.
- Migración 0037 (aplicada en producción): los negocios nuevos vuelven a tener la prueba Pro de 14 días.
- POS: una venta pasó de 42 consultas / ~710 KB a 6 consultas / ~1,5 KB. La sesión se valida con `getClaims`.
- Errores de hidratación #418 arreglados: formato de fechas, cronómetro de caja y `<html>`.

## Hecho: Caja y cierre de caja

- Migración 0038 (**falta aplicarla en producción**): función `cash_register_summaries(uuid[])` que calcula efectivo y cobros por medio de pago de varias cajas en una sola consulta, más un índice en `sales (cash_register_id)`.
- `src/lib/caja.ts`: `getCashRegisterSummaries` la usa para todas las cajas de la página; `computeCashOnHand` (usado al cerrar, retirar, comprar y pagar a proveedores) también. Si la función no existe o falla, calcula como antes, caja por caja (`legacy*`); ese código se puede borrar cuando 0038 esté en producción.
- Visita a Caja: de 3 a 8 consultas por caja del historial a ~11 fijas. Cerrar la caja: ~23. El detalle de una caja: 9, y ya no se corta en 1000 ventas.
- Verificado contra el cálculo anterior con ventas anuladas, mixtas (con y sin desglose), fiado, cobros de deuda, ingresos/retiros, compras (mixtas y anuladas) y pagos a proveedores: mismos números. Un negocio no puede ver cajas de otro.

## Costos (cliente mediano, por mes, después del PR #2)

- Supabase: ~80.000 consultas y ~0,34 GB transferidos. La base crece ~2,7 KB por venta (~7 MB por mes).
- Vercel: ~10.000 invocaciones y ~0,16 h de servidor (centavos de dólar).
- Supabase Pro (250 GB) alcanza para unos 740 clientes. Con 300 clientes: ~US$45/mes (Vercel Pro US$20 + Supabase Pro US$25), más un servidor de Supabase más grande si hace falta.

## Pendiente (por prioridad)

1. **Aplicar la migración 0038 en producción** (ver arriba). Hasta entonces Caja funciona igual que antes, con el cálculo viejo.
2. **Precarga de listas**: /clientes precarga el detalle de cada cliente visible y /configuracion se precarga muchas veces. Poner `prefetch={false}` en esos links.
3. **Productos**: renderiza la tabla entera (~2 s con 1.600 artículos). Paginar o virtualizar.
4. **Reportes**: "Monto libre" aparece primero en "más vendidos" y "más ganancia" (se agrupa todo junto y no tiene costo). Excluirlo de esos rankings.
5. **Usuarios**: el texto del alta dice "otro kiosco" aunque el rubro sea otro.
6. **Contra conocida del PR #2**: después de vender, Caja/Reportes/Productos pueden mostrar datos de hasta 30 s atrás si se vuelve a ellos enseguida (`staleTimes` en `next.config.ts`).

## Cómo reproducir la simulación

1. `npx supabase init`
2. `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,mailpit,supavisor`. Si Docker Hub devuelve 429, reintentar el `docker pull` de cada imagen.
3. `.env.local` apuntando a `http://127.0.0.1:54321` con las keys que imprime el paso anterior.
4. `npm run build && npm run start`.
5. Registrarse, crear vendedores desde Usuarios y cargar ventas llamando a las RPC (`checkout_sale`, `register_purchase`) con los usuarios reales.

Ojo: la base local y un `next start` de una sesión anterior pueden seguir vivos. Mirar `select version from supabase_migrations.schema_migrations` (aplicar las que falten con `psql -f`) y que el puerto 3000 no lo tenga otro proceso.

No commitear `supabase/config.toml`, `supabase/.gitignore`, `supabase/.branches/` ni `.env.local`.
