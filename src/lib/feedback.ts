// Sugerencias y reportes de problemas: topes compartidos entre el formulario,
// la acción del servidor y la base (migración 0073: 5 a 2000 caracteres, 10 por día).
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_MIN = 5;

export type FeedbackKind = "suggestion" | "problem";
