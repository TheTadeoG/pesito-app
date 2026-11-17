import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const empezarDocs: DocArticle[] = [
  {
    slug: "como-invitar-a-tu-equipo",
    title: "Cómo invitar a tu equipo",
    category: "empezar",
    summary: "Sumá empleados o administradores con un link o creales un usuario y contraseña, y elegí su rol.",
    plan: null,
    where: "**Mi equipo → Invitar usuario**",
    before: ["Ser dueño o administrador.", "Tener lugar en tu plan: Gratis 1 usuario, Básico 2, Pro y Max 6."],
    steps: [
      { text: "Entrá a **Mi equipo** y tocá **Invitar usuario**." },
      { text: "Elegí el rol: **Administrador** (gestiona productos, clientes, proveedores y el equipo) o el de empleado (vende, carga compras y ve el catálogo)." },
      {
        text: "Elegí cómo ingresa: con su email (**Generar link** y se lo pasás) o con usuario y contraseña (**Crear usuario y contraseña**), para empleados que no usan email.",
        note: "Si elegís usuario y contraseña, el sistema te muestra los datos para que se los pases a tu empleado.",
      },
      { text: "Pasale el link o los datos a la persona. Al entrar ya queda en tu negocio." },
    ],
    tips: [
      "Las invitaciones pendientes aparecen en **Invitaciones pendientes** y las podés **Cancelar invitación**.",
      "Podés cambiar el usuario o la contraseña de alguien con **Editar usuario y contraseña**, o sacarlo con **Quitar del equipo**.",
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
