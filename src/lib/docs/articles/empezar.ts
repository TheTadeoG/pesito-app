import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-18";

export const empezarDocs: DocArticle[] = [
  {
    slug: "como-invitar-a-tu-equipo",
    title: "Cómo invitar a tu equipo",
    category: "empezar",
    summary: "Sumá empleados o administradores con un link o creales un usuario y contraseña, y elegí su rol.",
    plan: null,
    where: "**Mi equipo → Invitar por link o Crear usuario y contraseña**",
    before: ["Ser dueño o administrador.", "Tener lugar en tu plan: Gratis 1 usuario, Básico 2, Pro y Max 6."],
    intro: [
      "Cada persona que trabaja con vos puede tener su propio acceso, con su caja y sus ventas registradas. Pesito tiene tres roles: Dueño, Administrador y Vendedor.",
    ],
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
    faq: [
      { q: "¿Qué puede hacer cada rol?", a: "**Dueño**: todo (hay uno solo por negocio). **Administrador**: casi lo mismo que el dueño: gestiona usuarios, ve En vivo y los reportes de todo el equipo. **Vendedor**: vende, abre y cierra su propia caja, carga compras y clientes; no gestiona usuarios ni ve En vivo." },
      { q: "¿Cuántos usuarios puedo tener?", a: "Gratis 1, Básico 2, Pro y Max 6. Las invitaciones pendientes también cuentan." },
      { q: "¿Cuándo vence el link de invitación?", a: "A los 7 días. Si venció, generá uno nuevo." },
      { q: "¿Cómo ingresa un empleado que no usa email?", a: "Creale un usuario y contraseña con **Crear usuario y contraseña**: elegís vos el usuario y se lo pasás. Puede cambiarle la contraseña cuando quiera." },
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
    intro: [
      "Pesito tiene un plan Gratis y planes pagos (Básico, Pro y Max). Cada plan suma funciones y límites; lo que no está en tu plan lo ves igual, con el plan que lo desbloquea.",
    ],
    steps: [
      { text: "Entrá a **Mi plan**." },
      { text: "Compará lo que incluye cada plan y mirá cuál es el tuyo." },
      { text: "Elegí el plan y si lo pagás mensual o anual (con descuento) y seguí los pasos de Mercado Pago." },
    ],
    tips: [
      "Las funciones que no están en tu plan aparecen con el plan que las desbloquea y un link para contratarlo.",
      "Si querés ver las diferencias antes de entrar, mirá la página pública **Comparar planes**.",
    ],
    faq: [
      { q: "¿Cuánto dura la prueba?", a: "Al crear tu cuenta tenés 14 días del Plan Pro de regalo. Después seguís en el Plan Gratis sin perder datos, hasta que elijas un plan pago." },
      { q: "¿Cómo se paga?", a: "Con Mercado Pago, mensual o anual (con 20% de descuento)." },
      { q: "¿Qué pasa si bajo de plan?", a: "No perdés datos: las funciones del plan más alto dejan de estar disponibles y, si tenés más usuarios que los que permite el nuevo plan, los de más quedan pausados." },
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
    intro: [
      "Para empezar a vender no hace falta configurar todo: alcanza con cargar tus productos, abrir la caja y cobrar. El resto podés ir sumándolo con el tiempo.",
    ],
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
    faq: [
      { q: "¿Por dónde empiezo si tengo muchos productos?", a: "Cargalos desde Excel (**Productos → Acciones → Cargar desde Excel**, Plan Básico) o uno por uno. Empezá por los que más vendés." },
      { q: "¿Necesito un lector de códigos?", a: "No es obligatorio, pero acelera mucho el cobro: sirve cualquier lector de códigos de barras que funcione como teclado." },
      { q: "¿Tengo que cargar el stock?", a: "Conviene: ponelo en **Stock inicial** al cargar cada producto. Si no, las ventas lo dejarán en negativo." },
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
    faq: [
      { q: "¿Pide tarjeta?", a: "No. El Plan Gratis no pide tarjeta ni vence, y al crear la cuenta tenés 14 días del Plan Pro de regalo." },
      { q: "¿Puedo entrar con Google?", a: "Sí: podés registrarte o ingresar con tu cuenta de Google." },
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
