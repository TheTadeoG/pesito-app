# Pesito

Sistema de gestión para kioscos y almacenes: punto de venta, inventario,
clientes con cuenta corriente y caja diaria, con una landing page y acceso
por cuenta.

Construido con [Next.js](https://nextjs.org) (App Router, TypeScript,
Tailwind CSS v4) y [Supabase](https://supabase.com) (Postgres + Auth).

## Funcionalidades

- **Landing page** pública con funciones, precios y llamada a la acción.
- **Acceso**: registro/login por email y contraseña (Supabase Auth), con un
  paso de onboarding para crear el negocio y elegir su rubro.
- **Punto de Venta**: búsqueda de productos por nombre/código de barras,
  carrito, montos libres, cliente, descuento, medio de pago y checkout
  atómico (RPC `checkout_sale`) que descuenta stock.
- **Productos e Inventario**: alta/edición/baja de productos, ajustes de
  stock con motivo, historial de movimientos.
- **Clientes**: alta/edición, cuenta corriente (fiado) y registro de pagos.
- **Caja**: apertura con monto inicial, ingresos/retiros de efectivo
  durante el turno, y cierre con conteo y detección de diferencias.
- **Reportes**: ingresos, ganancia estimada, ticket promedio, ventas por
  medio de pago y productos más vendidos/rentables de los últimos 30 días.
- **Configuración**: datos del negocio y equipo.

Compras, gestión de usuarios, recomendaciones con IA y baja rotación están
marcados como "Pronto" en el menú: la navegación ya está armada para
sumarlos sin romper nada.

## Requisitos

- Node.js 20+
- Un proyecto de [Supabase](https://supabase.com) (plan gratuito alcanza)

## Configuración

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear un proyecto en [supabase.com](https://supabase.com) y copiar sus
   credenciales (Project Settings → API).

   Si desplegás en Vercel, la
   [integración oficial de Supabase](https://vercel.com/integrations/supabase)
   puede cargar estas variables por vos automáticamente (junto con otras que
   la app no usa, como `POSTGRES_URL`). De cualquier forma, cada vez que
   agregues o cambies una variable de entorno en Vercel hay que disparar un
   **Redeploy** a mano: los deploys existentes no las recogen solos.

3. Crear `.env.local` en la raíz con:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

   # dominio real una vez desplegado (usado en metadata, sitemap.xml y robots.txt)
   NEXT_PUBLIC_SITE_URL=https://tu-dominio.com

   # sólo server-side: necesaria para que Usuarios pueda dar de alta
   # vendedores con usuario/contraseña interno (Project Settings → API →
   # service_role). Sin esta variable esa opción muestra un error pero el
   # resto de la app (incluida la invitación por link) funciona igual.
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   ```

4. Aplicar el esquema de base de datos. La migración vive en
   `supabase/migrations/0001_init.sql` y crea las tablas, políticas de RLS
   y funciones RPC (`create_organization`, `checkout_sale`) que usa la app.

   Con la [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase link --project-ref tu-proyecto
   supabase db push
   ```

   O pegando el contenido del archivo en el **SQL Editor** del panel de
   Supabase y ejecutándolo una vez.

5. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000).

## Modelo de datos

- `organizations` / `memberships`: cada negocio (kiosco) y quién tiene
  acceso a él, con rol (`owner`, `admin`, `vendedor`).
- `products`, `categories`: catálogo.
- `customers`: clientes y su saldo de cuenta corriente.
- `cash_registers`, `cash_movements`: turnos de caja por usuario e
  ingresos/retiros de efectivo dentro de un turno.
- `sales`, `sale_items`, `stock_movements`: ventas y su detalle, y el
  historial de movimientos de stock (ventas, ajustes).

Todas las tablas tienen Row Level Security: un usuario solo puede ver y
modificar datos de las organizaciones donde tiene membership
(`is_org_member`). El checkout de una venta corre en la función
`checkout_sale`, que valida stock y descuenta todo en una sola transacción.

## SEO y GEO

- Metadata completa (title/description con template, Open Graph, Twitter
  card, `metadataBase`, canonical) en `src/app/layout.tsx`, con overrides
  por página en `/login` y `/registro`.
- `src/app/robots.ts` y `src/app/sitemap.ts` generan `robots.txt` y
  `sitemap.xml`; las pantallas privadas (`/pos`, `/productos`, etc.) están
  en `disallow` y además llevan `robots: { index: false }` en su layout.
- JSON-LD (`SoftwareApplication`, `Organization`, `FAQPage`) en la landing
  vía `src/components/marketing/structured-data.tsx`, para rich snippets y
  para que buscadores/IA generativa (ChatGPT, Perplexity, AI Overviews)
  puedan citar precios y funciones con precisión.
- Sección de preguntas frecuentes en la landing (`faq.tsx`) con contenido
  en formato pregunta/respuesta: ayuda tanto al SEO clásico como a que los
  motores de respuesta generativa extraigan y citen el contenido.
- Recordá setear `NEXT_PUBLIC_SITE_URL` con el dominio real al desplegar:
  se usa en el canonical, el sitemap y el `robots.txt`.

## Scripts

```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint
```

## Despliegue

Cualquier hosting compatible con Next.js sirve (por ejemplo
[Vercel](https://vercel.com/new)). Configurar las mismas variables de
entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) en el proveedor elegido.
