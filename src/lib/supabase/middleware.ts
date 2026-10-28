import { normalizePlanParam } from "@/lib/plan-ids";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { MFA_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { safeNextPath } from "@/lib/safe-redirect";

// Rutas públicas: landing + todo lo de "Recursos" (SEO/GEO, pensado para
// alguien que todavía no nos conoce y no tiene por qué estar logueado) más
// los archivos que leen los crawlers. Sin esto, el matcher de abajo corre
// en TODAS las rutas y cualquiera de éstas termina mandando a /login.
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/registro",
  "/olvide-mi-contrasena",
  "/restablecer-contrasena",
  "/auth",
  "/invitacion",
  "/blog",
  "/como-funciona",
  "/comparacion",
  "/comparar-planes",
  "/diccionario",
  "/pesito-para",
  "/preguntas-frecuentes",
  "/privacidad",
  "/terminos",
  "/opengraph-image",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  // Tarea diaria de correos (la llama Vercel Cron con su propio secreto) y baja de esos correos
  // (link firmado de cada mail): se abren sin sesión.
  "/api/cron",
  "/api/lifecycle",
  // Avisos de Mercado Pago (cobro de los planes): verifican su propia firma.
  "/api/mercadopago",
  // Archivos que buscan los crawlers y agentes de IA (ai-catalog.json, etc.):
  // si no existen, que respondan 404 y no la página de login.
  "/.well-known",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PATHS.some(
    (path) => path !== "/" && pathname.startsWith(`${path}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // A misconfigured deploy (missing/blank env vars) must not 500 on every
  // single request via the matcher below — that takes down the whole site,
  // including the public marketing pages that need no backend at all.
  // Fail open on public paths, fail closed (send to login) elsewhere.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase env vars are missing; skipping auth check in middleware."
    );
    if (isPublicPath(request.nextUrl.pathname)) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // getClaims (no getUser): verifica la firma del token localmente con la
  // clave pública del proyecto, sin ir al servidor de Auth en cada pedido.
  // Igual que getUser, renueva la sesión cuando el token está por vencer.
  // Si el proyecto todavía firma con la clave simétrica vieja (HS256),
  // getClaims cae solo en getUser, así que nunca es menos seguro.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Con la sesión iniciada, /login y /registro no tienen nada que mostrar:
  // van adentro (a ?next= si es una ruta interna). /registro con un plan
  // elegido en precios va directo a pagarlo. Con ?error= o ?restablecida=
  // (vuelta de Google, del mail o de cambiar la clave) se muestra la pantalla
  // para que se vea el aviso.
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/registro")) {
    const params = request.nextUrl.searchParams;
    if (!params.get("error") && !params.get("restablecida")) {
      const url = request.nextUrl.clone();
      url.search = "";
      const plan = normalizePlanParam(params.get("plan"));
      if (request.nextUrl.pathname === "/registro" && (plan === "basico" || plan === "pro" || plan === "max")) {
        url.pathname = "/suscribirse";
        url.searchParams.set("plan", plan);
        url.searchParams.set("ciclo", params.get("anual") === "1" ? "anual" : "mensual");
      } else {
        const target = new URL(
          request.nextUrl.pathname === "/login" ? safeNextPath(params.get("next"), "/pos") : "/pos",
          request.url
        );
        url.pathname = target.pathname;
        url.search = target.search;
      }
      return NextResponse.redirect(url);
    }
  }

  // Verificación en dos pasos: con la app de códigos activada y la sesión
  // sin el código todavía, primero a /login/verificar. La base igual no
  // muestra datos del negocio sin el código (migración 0046); esto es para
  // que la persona llegue a la pantalla correcta (sin ir al servidor de Auth:
  // el login deja la cookie MFA_COOKIE cuando la cuenta tiene el código).
  if (
    user &&
    user.aal !== "aal2" &&
    request.cookies.get(MFA_COOKIE)?.value === "1" &&
    !isPublicPath(request.nextUrl.pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/verificar";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
