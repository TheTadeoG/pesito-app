// Saca las imágenes de las guías de /ayuda con los componentes reales del panel (ver README.md).
// Uso: node scripts/docs-shots/shots.mjs [nombre ...]   (sin nombres: todas)
// Con SHOTS_URL=http://localhost:3112 usa un servidor ya levantado en vez de levantar uno.
import { spawn } from "node:child_process";
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url).pathname;
const out = `${root}public/ayuda`;
const PORT = 3190;
const base = process.env.SHOTS_URL ?? `http://localhost:${PORT}`;
const GREEN = "#059669";
function load(name) {
  try {
    return require(name);
  } catch {
    return require(`${execSync("npm root -g").toString().trim()}/${name}`);
  }
}
const { chromium } = load("playwright");
const sharp = require("sharp");

// Carrito de ejemplo para el POS (se recupera de localStorage al abrir).
const P = {
  p1: { id: "p1", name: "Gaseosa cola 500 ml", barcode: "7790000000011", sku: "P-00001", price: 1800, stock: 24, min_stock: 6, unit: "u", image_url: null },
  p2: { id: "p2", name: "Alfajor triple", barcode: "7790000000028", sku: "P-00002", price: 1200, stock: 40, min_stock: 10, unit: "u", image_url: null },
};
const cart = JSON.stringify([
  { kind: "product", product: P.p1, quantity: 1 },
  { kind: "product", product: P.p2, quantity: 2 },
]);

// Cada captura: pantalla de prueba, cómo llegar al estado, qué resaltar y qué recortar.
const shots = [
  { name: "pos-buscador", page: "pos", cart, hot: [(p) => p.getByPlaceholder(/Escaneá el código/)], clip: "#shot" },
  { name: "pos-combos", page: "pos", cart, hot: [(p) => p.getByRole("button", { name: /Combos/ }).first()], clip: "#shot" },
  { name: "pos-cobrar", page: "pos", cart, hot: [(p) => p.getByRole("button", { name: /Cobrar/ })], clip: "#shot" },
  { name: "pos-descuento", page: "pos", cart, hot: [(p) => p.getByRole("button", { name: /Agregar descuento o recargo/ })], clip: "#shot" },
  {
    name: "pos-descuento-campos",
    page: "pos",
    cart,
    setup: (p) => p.getByRole("button", { name: /Agregar descuento o recargo/ }).click(),
    hot: [(p) => p.getByText("Descuento", { exact: true }).locator("xpath=ancestor::div[2]")],
    clip: "#shot",
  },
  { name: "pos-manual", page: "pos", cart, hot: [(p) => p.getByRole("button", { name: "Agregar monto manual" })], clip: "#shot" },
  { name: "pos-cliente", page: "pos", cart, hot: [(p) => p.getByRole("button", { name: /Consumidor Final/ })], clip: "#shot" },
  {
    name: "pos-medios",
    page: "pos",
    cart,
    setup: async (p) => p.getByRole("button", { name: /Cobrar/ }).click(),
    hot: [(p) => p.getByRole("button", { name: /Efectivo/ }).first()],
    clip: { dialog: "¿Cómo paga?" },
  },
  {
    name: "pos-efectivo",
    page: "pos",
    cart,
    setup: async (p) => {
      await p.getByRole("button", { name: /Cobrar/ }).click();
      await p.getByRole("button", { name: /Efectivo/ }).first().click();
      await p.locator("input[inputmode=decimal]").first().fill("5000");
    },
    hot: [(p) => p.locator("input[inputmode=decimal]").first()],
    clip: { dialog: "Pago en efectivo" },
  },
  {
    name: "pos-mixto",
    page: "pos",
    cart,
    setup: async (p) => {
      await p.getByRole("button", { name: /Cobrar/ }).click();
      await p.getByRole("button", { name: /Mixto/ }).first().click();
    },
    hot: [],
    clip: { dialog: "Combinar medios de pago" },
  },
];


// Productos: menús de Acciones y de cada fila, formulario y filtros.
const acciones = [
  ["productos-descargar-excel", "Descargar Excel"],
  ["productos-cargar-excel", "Cargar desde Excel"],
  ["productos-etiquetas", "Etiquetas con código de barras"],
  ["productos-ajustar-precios", "Ajustar precios"],
  ["productos-marcas", "Marcas"],
];
for (const [name, item] of acciones) {
  shots.push({
    name,
    page: "productos",
    setup: (p) => p.getByRole("button", { name: /^Acciones/ }).first().click(),
    hot: [[(p) => p.locator("button, [role=menuitem]").filter({ hasText: new RegExp(`^\\s*${item}\\s*$`) }).first(), "inset"]],
    clip: "#shot",
  });
}
const fila = [
  ["productos-ajustar-stock", "Ajustar stock"],
  ["productos-historial", "Historial de precios y costos"],
  ["productos-desactivar", "Desactivar"],
  ["productos-agregar-talles", "Agregar talles o colores"],
];
for (const [name, item] of fila) {
  shots.push({
    name,
    page: "productos",
    setup: (p) => p.getByRole("button", { name: "Más acciones" }).first().click(),
    hot: [[(p) => p.locator("button, [role=menuitem]").filter({ hasText: new RegExp(`^\\s*${item}\\s*$`) }).first(), "inset"]],
    clip: "#shot",
  });
}
const nuevo = (name, hot) => ({
  name,
  page: "productos",
  setup: (p) => p.getByRole("button", { name: /Nuevo producto/ }).first().click(),
  hot,
  clip: { dialog: "¿Qué tipo de producto es?" },
});
shots.push(
  nuevo("productos-nuevo-sku", [(p) => p.locator("#p-sku")]),
  nuevo("productos-nuevo-talles", [(p) => p.getByText("Con talles o colores", { exact: true }).locator("xpath=ancestor::button[1]")]),
  nuevo("productos-nuevo-combo", [(p) => p.getByText("Combo o kit", { exact: true }).locator("xpath=ancestor::button[1]")]),
  nuevo("productos-nuevo-iva", [(p) => p.getByText("Ocultar IVA").first()]),
  nuevo("productos-nuevo-unidad", [(p) => p.locator("#p-unit")]),
  nuevo("productos-nuevo-imagen", [(p) => p.getByRole("button", { name: "Subir imagen" })]),
  nuevo("productos-nuevo-minimo", [(p) => p.locator("#p-min")])
);
shots.push(
  {
    name: "productos-nuevo",
    page: "productos",
    setup: (p) => p.getByRole("button", { name: /Nuevo producto/ }).first().click(),
    hot: [],
    clip: { dialog: "¿Qué tipo de producto es?" },
  },
  {
    name: "productos-filtros",
    page: "productos",
    setup: (p) => p.getByRole("button", { name: /^Filtros/ }).first().click(),
    hot: [],
    clip: "#shot",
  },
  {
    name: "productos-buscador",
    page: "productos",
    hot: [(p) => p.getByPlaceholder(/Buscar por nombre, marca/)],
    clip: "#shot",
  }
);

// Caja: resumen del turno, ingresos y retiros, cierre, apertura y equipo.
const btn = (re) => (p) => p.getByRole("button", { name: re }).first();
const cajaDialog = (name, setup, hot, title) => ({ name, page: "caja", setup, hot, clip: { dialog: title } });
shots.push(
  { name: "caja-resumen", page: "caja", hot: [(p) => p.getByText("= En caja").locator("xpath=ancestor::div[1]")], clip: "#shot" },
  { name: "caja-botones", page: "caja", hot: [btn(/Ingresar \/ Retirar/)], clip: "#shot" },
  { name: "caja-cerrar-boton", page: "caja", hot: [btn(/Cerrar caja/i)], clip: "#shot" },
  cajaDialog("caja-gestionar", async (p) => btn(/Ingresar \/ Retirar/)(p).click(), [(p) => p.getByRole("button", { name: /Ingresar efectivo/ }).first()], "Revisá tu efectivo disponible"),
  cajaDialog(
    "caja-ingreso",
    async (p) => {
      await btn(/Ingresar \/ Retirar/)(p).click();
      await p.getByRole("button", { name: /Ingresar efectivo/ }).first().click();
    },
    [(p) => p.locator("input").first()],
    "Sumá efectivo a tu caja"
  ),
  cajaDialog(
    "caja-cerrar",
    async (p) => {
      await btn(/Cerrar caja/i)(p).click();
      await p.locator("input").first().fill("86900");
    },
    [(p) => p.locator("input").first()],
    "Contá todo el efectivo en caja"
  ),
  { name: "caja-abrir", page: "caja-abrir", hot: [(p) => p.locator("input").first()], clip: { dialog: "Abrir caja" } },
  { name: "caja-equipo", page: "caja-equipo", hot: [(p) => p.getByText("Abierta desde otro día").first()], clip: "#shot" }
);

// Compras, Clientes, Proveedores, Ajustes, Equipo y Reportes.
const byRole = (role, re) => (p) => p.getByRole(role, { name: re }).first();
const card = (id) => (p) => p.locator(id);
shots.push(
  { name: "compras-proveedor", page: "compras", hot: [(p) => p.getByPlaceholder(/Buscar proveedor/)], clip: "#shot" },
  { name: "compras-producto", page: "compras", hot: [(p) => p.getByPlaceholder(/Buscar producto o escanear/)], clip: "#shot" },
  { name: "compras-pago", page: "compras", hot: [(p) => p.getByText("¿Cómo se paga esta compra?").locator("xpath=ancestor::div[1]")], clip: "#shot" },
  {
    name: "compras-registrar",
    page: "compras",
    setup: async (p) => {
      await p.getByPlaceholder(/Buscar producto o escanear/).fill("gaseosa");
      await p.getByPlaceholder(/Buscar producto o escanear/).press("Enter");
    },
    hot: [byRole("button", /Registrar Compra/)],
    clip: "#shot",
  },
  { name: "clientes-nuevo", page: "clientes", hot: [byRole("button", /Nuevo cliente/)], clip: "#shot" },
  { name: "clientes-buscador", page: "clientes", hot: [(p) => p.getByPlaceholder(/Buscar por nombre, teléfono/)], clip: "#shot" },
  { name: "clientes-descargar", page: "clientes", setup: (p) => p.getByRole("button", { name: /^Acciones/ }).first().click(), hot: [[(p) => p.locator("button, [role=menuitem]").filter({ hasText: /^\s*Descargar Excel\s*$/ }).first(), "inset"]], clip: "#shot" },
  { name: "clientes-excel", page: "clientes", setup: (p) => p.getByRole("button", { name: /^Acciones/ }).first().click(), hot: [[(p) => p.locator("button, [role=menuitem]").filter({ hasText: /^\s*Cargar desde Excel/ }).first(), "inset"]], clip: "#shot" },
  { name: "clientes-recordar", page: "clientes", hot: [(p) => p.locator("[aria-label*=Recordarle], [title*=Recordarle], a:has-text('Recordarle')").first()], clip: "#shot" },
  { name: "clientes-pago", page: "clientes-pago", hot: [(p) => p.locator("input").first()], clip: { dialog: "Registrar pago" } },
  { name: "proveedores-lista", page: "proveedores", hot: [(p) => p.getByRole("button", { name: /Registrar pago/ }).first()], clip: "#shot" },
  { name: "proveedores-calendario", page: "proveedores", hot: [(p) => p.getByRole("button", { name: /Calendario/ })], clip: "#shot" },
  { name: "proveedores-pago", page: "proveedores-pago", hot: [], clip: { dialog: "Elegir qué facturas pago" } },
  { name: "ajustes-nombre", page: "ajustes", hot: [card("#s-nombre input")], clip: "#s-nombre" },
  { name: "ajustes-cierre", page: "ajustes", hot: [card("#s-cierre [role=switch]")], clip: "#s-cierre" },
  { name: "ajustes-sucursales", page: "ajustes", hot: [(p) => p.getByPlaceholder("Nombre de la nueva sucursal")], clip: "#s-sucursales" },
  { name: "ajustes-medios", page: "ajustes", hot: [(p) => p.getByPlaceholder(/Mercado Pago, Talo/)], clip: "#s-medios" },
  { name: "ajustes-ticket", page: "ajustes", hot: [(p) => p.getByRole("switch", { name: "Mostrar el nombre del negocio" })], clip: "#s-ticket" },
  { name: "usuarios-invitar", page: "usuarios", hot: [byRole("button", /Invitar por link/)], clip: "#shot" },
  { name: "usuarios-crear", page: "usuarios", hot: [byRole("button", /Crear usuario y contraseña/)], clip: "#shot" },
  { name: "usuarios-roles", page: "usuarios", hot: [(p) => p.getByText("Rol: qué puede hacer cada uno").locator("xpath=ancestor::div[2]")], clip: "#shot" },
  { name: "usuarios-editar", page: "usuarios", hot: [(p) => p.getByRole("button", { name: /Editar usuario/ }).first()], clip: "#shot" },
  {
    name: "usuarios-quitar",
    page: "usuarios",
    setup: (p) => p.getByRole("button", { name: "Más acciones" }).last().click(),
    hot: [[(p) => p.locator("button, [role=menuitem]").filter({ hasText: /Quitar del equipo/ }).first(), "inset"]],
    clip: "#shot",
  },
  { name: "usuarios-cancelar-invitacion", page: "usuarios", hot: [(p) => p.locator("button:has(svg.lucide-x)").last()], clip: "#shot" },
  { name: "reportes-periodo", page: "reportes", hot: [byRole("link", /Este mes/)], clip: "#shot" }
);

async function highlight(loc, inset = false) {
  await loc.evaluate(
    (el, [color, inset]) => {
      if (inset) {
        // Dentro de menús (que recortan lo que se sale): borde y fondo hacia adentro.
        el.style.boxShadow = `inset 0 0 0 3px ${color}`;
        el.style.background = `${color}22`;
        el.style.borderRadius = "8px";
      } else {
        el.style.outline = `3px solid ${color}`;
        el.style.outlineOffset = "3px";
        el.style.boxShadow = `0 0 0 8px ${color}33`;
      }
    },
    [GREEN, inset]
  );
}

// El diálogo no usa role=dialog: se busca por un texto y se sube hasta el panel que está dentro del fondo fijo.
async function dialogBox(page, text) {
  const h = await page.getByText(text).last().elementHandle();
  const panel = await h.evaluateHandle((el) => {
    let cur = el;
    while (cur.parentElement && getComputedStyle(cur.parentElement).position !== "fixed") cur = cur.parentElement;
    return cur;
  });
  return panel.asElement();
}

async function run() {
  const only = process.argv.slice(2);
  const todo = shots.filter((s) => only.length === 0 || only.includes(s.name));
  let server = null;
  if (!process.env.SHOTS_URL) {
    cpSync(`${root}scripts/docs-shots/pages`, `${root}src/app/blog/zz-shots`, { recursive: true });
    server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      cwd: root,
      env: { ...process.env, NEXT_PUBLIC_DOCS_SHOTS: "1", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_dummy", SUPABASE_SERVICE_ROLE_KEY: "dummy" },
      stdio: "ignore",
    });
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(base);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  mkdirSync(out, { recursive: true });
  const manifestPath = `${out}/manifest.json`;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const browser = await chromium.launch();
  try {
    for (const s of todo) {
     try {
      const ctx = await browser.newContext({ viewport: { width: s.width ?? 1440, height: 1000 }, deviceScaleFactor: 2 });
      if (s.cart) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["pesito-pos-cart-r1", s.cart]);
      const page = await ctx.newPage();
      await page.goto(`${base}/blog/zz-shots/${s.page}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      if (s.setup) await s.setup(page);
      for (const h of s.hot ?? []) {
        if (Array.isArray(h)) await highlight(h[0](page), h[1] === "inset");
        else await highlight(h(page));
      }
      await page.waitForTimeout(150);
      const target = typeof s.clip === "string" ? page.locator(s.clip).first() : await dialogBox(page, s.clip.dialog);
      const png = await target.screenshot();
      const info = await sharp(png).webp({ quality: 82 }).toFile(`${out}/${s.name}.webp`);
      manifest[s.name] = { w: Math.round(info.width / 2), h: Math.round(info.height / 2) };
      console.log("ok", s.name);
      await ctx.close();
     } catch (e) {
      console.log("FALLÓ", s.name, String(e.message).split("\n")[0]);
     }
    }
  } finally {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    await browser.close();
    if (server) server.kill();
    if (!process.env.SHOTS_URL && existsSync(`${root}src/app/blog/zz-shots`)) rmSync(`${root}src/app/blog/zz-shots`, { recursive: true });
  }
}
run();
