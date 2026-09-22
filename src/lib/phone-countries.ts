export interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

// Argentina primero (y por defecto): Pesito es para el mercado argentino,
// el resto de la lista cubre países vecinos y otros hispanohablantes
// comunes para quien pruebe la app desde afuera.
export const phoneCountries: PhoneCountry[] = [
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷" },
  { code: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽" },
  { code: "ES", name: "España", dialCode: "+34", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸" },
];

export const defaultPhoneCountry = phoneCountries[0];
