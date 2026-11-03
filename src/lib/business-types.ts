import type { LucideIcon } from "lucide-react";
import {
  Beef,
  Gem,
  Hammer,
  Laptop2,
  MoreHorizontal,
  PawPrint,
  Pill,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Store,
  Wrench,
} from "lucide-react";

export interface BusinessType {
  value: string;
  label: string;
  /** Cómo completa la frase «Mi negocio es …». */
  phrase: string;
  icon: LucideIcon;
}

export const businessTypes: BusinessType[] = [
  { value: "almacen", label: "Almacén", phrase: "un almacén", icon: Store },
  { value: "gastronomia", label: "Gastronomía", phrase: "de gastronomía", icon: Beef },
  { value: "kiosco", label: "Kiosco", phrase: "un kiosco", icon: ShoppingBasket },
  { value: "indumentaria", label: "Indumentaria", phrase: "de indumentaria", icon: Shirt },
  { value: "servicios", label: "Servicios", phrase: "de servicios", icon: Wrench },
  { value: "farmacia", label: "Farmacia", phrase: "una farmacia", icon: Pill },
  { value: "electronica", label: "Electrónica", phrase: "de electrónica", icon: Laptop2 },
  { value: "petshop", label: "Petshop", phrase: "un petshop", icon: PawPrint },
  { value: "ferreteria", label: "Ferretería", phrase: "una ferretería", icon: Hammer },
  { value: "belleza", label: "Artículos de belleza", phrase: "de artículos de belleza", icon: Sparkles },
  { value: "accesorios", label: "Accesorios", phrase: "de accesorios", icon: Gem },
  { value: "otro", label: "Otro", phrase: "de otro rubro", icon: MoreHorizontal },
];
