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
  icon: LucideIcon;
}

export const businessTypes: BusinessType[] = [
  { value: "almacen", label: "Almacén", icon: Store },
  { value: "gastronomia", label: "Gastronomía", icon: Beef },
  { value: "kiosco", label: "Kiosco", icon: ShoppingBasket },
  { value: "indumentaria", label: "Indumentaria", icon: Shirt },
  { value: "servicios", label: "Servicios", icon: Wrench },
  { value: "farmacia", label: "Farmacia", icon: Pill },
  { value: "electronica", label: "Electrónica", icon: Laptop2 },
  { value: "petshop", label: "Petshop", icon: PawPrint },
  { value: "ferreteria", label: "Ferretería", icon: Hammer },
  { value: "belleza", label: "Artículos de belleza", icon: Sparkles },
  { value: "accesorios", label: "Accesorios", icon: Gem },
  { value: "otro", label: "Otro", icon: MoreHorizontal },
];
