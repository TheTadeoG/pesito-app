import Link from "next/link";
import { Store } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </span>
        <span className="text-lg">Pesito</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
