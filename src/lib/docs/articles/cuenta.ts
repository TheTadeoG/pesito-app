import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const cuentaDocs: DocArticle[] = [
  {
    slug: "como-activar-la-verificacion-en-dos-pasos",
    title: "Cómo activar la verificación en dos pasos",
    category: "cuenta",
    summary: "Protegé tu cuenta con un código de una app de autenticación, además de la contraseña.",
    plan: null,
    where: "**Ajustes → Cuenta y seguridad**",
    before: ["Tener una app de códigos en el celular (Google Authenticator, Authy o similar)."],
    steps: [
      { text: "Entrá a **Ajustes** y abrí **Cuenta y seguridad**." },
      { text: "En la tarjeta de verificación en dos pasos tocá **Activar**." },
      { text: "Escaneá el código QR con la app de códigos." },
      { text: "Escribí el código de 6 dígitos que muestra la app y confirmá." },
    ],
    tips: [
      "Desde ese momento, al ingresar te pide la contraseña y el código de la app.",
      "Para desactivarla, salí y volvé a ingresar con el código de la app.",
    ],
    keywords: ["dos pasos", "2fa", "seguridad", "autenticacion", "codigo", "proteger cuenta", "google authenticator", "verificacion"],
    related: ["como-recuperar-la-contrasena"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-recuperar-la-contrasena",
    title: "Cómo recuperar la contraseña",
    category: "cuenta",
    summary: "Si no te acordás de la contraseña, pedí un link por email para elegir una nueva.",
    plan: null,
    where: "**Pantalla de ingreso → Olvidé mi contraseña**",
    steps: [
      { text: "En la pantalla de ingreso tocá **Olvidé mi contraseña**." },
      { text: "Escribí el email con el que te registraste y pedí el link." },
      { text: "Abrí el mail que te llega (mirá también en spam) y tocá el link." },
      { text: "Elegí tu nueva contraseña y guardala." },
    ],
    tips: [
      "El link vence: si pasó tiempo, pedí uno nuevo.",
      "Si te registraste con Google, ingresá con **Continuar con Google**: no tenés contraseña de Pesito.",
      "Si tu empleado ingresa con usuario y contraseña, el dueño se la cambia desde **Mi equipo**.",
    ],
    keywords: ["olvide mi contrasena", "recuperar contrasena", "restablecer", "no puedo entrar", "clave", "password", "ingresar"],
    related: ["como-activar-la-verificacion-en-dos-pasos", "como-invitar-a-tu-equipo"],
    updatedAt: UPDATED,
  },
  {
    slug: "como-configurar-los-avisos-del-negocio",
    title: "Cómo configurar el recordatorio de cierre de caja",
    category: "cuenta",
    summary: "Elegí a qué hora querés que Pesito te recuerde cerrar la caja, y cambiá el nombre de tu negocio.",
    plan: null,
    where: "**Ajustes → Negocio**",
    steps: [
      { text: "Entrá a **Ajustes** y abrí **Negocio**." },
      { text: "En **Nombre del negocio** escribí o cambiá el nombre y tocá **Guardar**." },
      { text: "En **Recordar el cierre de caja** elegí el horario y guardá." },
    ],
    tips: [
      "En **Ajustes → Avisos** (dueño y administradores) elegís qué alertas querés recibir.",
      "El nombre del negocio aparece en los tickets si dejás activada la opción **Mostrar el nombre del negocio**.",
    ],
    keywords: ["ajustes", "nombre del negocio", "recordatorio", "cierre de caja", "avisos", "alertas", "configurar negocio", "horario"],
    related: ["como-cerrar-la-caja"],
    updatedAt: UPDATED,
  },
];
