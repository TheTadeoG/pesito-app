// Opciones del selector de "capital parado" (Stock) y el valor con el que arranca. Archivo aparte
// porque lo usa un componente de navegador y `product-insights` depende de código del servidor.
export const IDLE_DAYS_OPTIONS = [7, 15, 30, 60, 90] as const;
export const IDLE_DEFAULT_DAYS = 30;
