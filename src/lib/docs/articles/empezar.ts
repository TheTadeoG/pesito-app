import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const empezarDocs: DocArticle[] = [
  {
    slug: "como-invitar-a-tu-equipo",
    title: "Cómo invitar a tu equipo",
    category: "empezar",
    summary: "Sumá empleados o administradores con un link o creales un usuario y contraseña, y elegí su rol.",
    plan: null,
    where: "**Mi equipo → Invitar por link o Crear usuario y contraseña**",
    before: ["Ser dueño o administrador.", "Tener lugar en tu plan: Gratis 1 usuario, Básico 2, Pro y Max 6."],
    steps: [
      { text: "Entrá a **Mi equipo**. Arriba, en la tarjeta de roles, ves qué puede hacer cada uno: **Dueño**, **Administrador** y **Vendedor**.", images: [{ name: "usuarios-roles", alt: "Mi equipo con la tarjeta que explica qué puede hacer cada rol resaltada" }] },
      { text: "Si la persona tiene email, tocá **Invitar por link**. En la ventana **Invitar usuario** elegí el rol (**Administrador** o **Vendedor**) y tocá **Generar link**.", images: [{ name: "usuarios-invitar", alt: "Mi equipo con el botón Invitar por link resaltado" }] },
      { text: "Copiá el link (**Copiar link**) y mandáselo por WhatsApp o mail. La persona se registra con su propio email y queda en tu negocio." },
      { text: "Si la persona no usa email, tocá **Crear usuario y contraseña**: elegís el usuario (por ejemplo, lucia) y una contraseña de al menos 8 caracteres, y se los pasás.", images: [{ name: "usuarios-crear", alt: "Mi equipo con el botón Crear usuario y contraseña resaltado" }] },
      { text: "Si tenés sucursales (Plan Max), asignale su sucursal en la fila de la persona." },
    ],
    tips: [
      "El link de invitación vence a los 7 días. Mientras no se use, aparece en **Invitaciones pendientes** y la podés cancelar.",
      "Las invitaciones pendientes también cuentan para el máximo de usuarios de tu plan.",
      "El rol de cada persona se puede cambiar después desde su fila. El Dueño es uno solo y no se puede cambiar ni quitar.",
      "Si tu plan baja, los usuarios de más quedan pausados.",
    ],
    keywords: ["equipo", "empleado", "invitar", "usuario", "rol", "administrador", "vendedor", "cajero", "permisos", "mi equipo"],
    related: ["como-ver-lo-que-hizo-cada-persona-del-equipo", "como-elegir-o-cambiar-de-plan"],
    connections: [
      { slug: "como-usar-mas-de-una-caja", text: "Cada persona puede tener su caja abierta." },
      { slug: "como-ver-las-ventas-de-cada-vendedor", text: "Después ves lo que vendió cada uno en **Reportes**." },
    ],
    updatedAt: UPDATED,
  },
  {
    slug: "como-elegir-o-cambiar-de-plan",
    title: "Cómo elegir o cambiar de plan",
    category: "empezar",
    summary: "Mirá qué incluye cada plan, suscribite o cambiá de plan con Mercado Pago.",
    plan: null,
    where: "**Mi plan**",
    steps: [
      { text: "Entrá a **Mi plan**." },
      { text: "Compará lo que incluye cada plan y mirá cuál es el tuyo." },
      { text: "Elegí el plan y si lo pagás mensual o anual (con descuento) y seguí los pasos de Mercado Pago." },
    ],
    tips: [
      "Las funciones que no están en tu plan aparecen con el plan que las desbloquea y un link para contratarlo.",
      "Si querés ver las diferencias antes de entrar, mirá la página pública **Comparar planes**.",
    ],
    keywords: ["plan", "precio", "suscribirme", "cambiar de plan", "pagar", "mercado pago", "mensual", "anual", "upgrade", "mi plan", "basico", "pro", "max"],
    related: ["como-invitar-a-tu-equipo"],
    updatedAt: UPDATED,
  },
  {
    slug: "primeros-pasos-en-pesito",
    title: "Primeros pasos en Pesito: de cero a la primera venta",
    category: "empezar",
    summary: "El camino corto para empezar: cargá tus productos, abrí la caja y hacé tu primera venta.",
    plan: null,
    where: "**Productos → Caja → Punto de Venta**",
    steps: [
      { text: "Cargá tus productos: uno por uno con **Productos → Nuevo producto**, o varios juntos desde Excel." },
      { text: "Entrá a **Caja** y abrí la caja con el efectivo con el que empezás el día." },
      { text: "Entrá a **Punto de Venta**, buscá o escaneá un producto, agregalo y cobrá." },
      { text: "Al terminar el día, cerrá la caja y mirá el resultado en **Reportes**." },
    ],
    tips: [
      "Podés mirar cada tema en detalle en las otras guías de esta ayuda.",
      "Si tenés una duda que no encuentres acá, escribinos desde **Ayuda**.",
    ],
    keywords: ["empezar", "primeros pasos", "comenzar", "tutorial", "como empiezo", "configurar", "primera venta", "inicio"],
    related: ["como-cargar-un-producto", "como-abrir-la-caja", "como-hacer-una-venta"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-crear-tu-cuenta-y-tu-negocio",
    title: "Cómo crear tu cuenta y tu negocio en Pesito",
    category: "empezar",
    summary: "Registrate gratis con tu email o con Google y completá el nombre y el tipo de tu negocio.",
    plan: null,
    where: "**Pantalla de registro → Creá tu cuenta gratis**",
    steps: [
      { text: "Entrá a Pesito y tocá **Creá tu cuenta gratis**." },
      { text: "Registrate con tu email y una contraseña de al menos 8 caracteres, o con tu cuenta de Google." },
      { text: "Completá el **Nombre del negocio**, el **Tipo de negocio** y un teléfono de contacto. Si tu rubro no está, elegí “otro”." },
      { text: "Se crea tu negocio y entrás al panel, listo para cargar productos." },
    ],
    tips: [
      "La cuenta Gratis alcanza para empezar: después podés cambiar de plan.",
      "Si ya tenés cuenta, ingresá con tu email y contraseña desde **Ingresar**.",
    ],
    keywords: ["crear cuenta", "registrarme", "registro", "darme de alta", "empezar gratis", "google", "nuevo negocio", "ingresar"],
    connections: [
      { slug: "primeros-pasos-en-pesito", text: "Después de crear tu cuenta, seguí con los primeros pasos." },
      { slug: "como-recuperar-la-contrasena", text: "Si no recordás la contraseña, se recupera por email." },
    ],
    related: ["como-elegir-o-cambiar-de-plan"],
    updatedAt: UPDATED,
  },
];
