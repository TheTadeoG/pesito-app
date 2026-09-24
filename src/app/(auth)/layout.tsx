import Link from "next/link";
import { LogoIcon } from "@/components/marketing/logo-icon";
import { Wordmark } from "@/components/marketing/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-foreground">
        <LogoIcon />
        <Wordmark className="text-2xl" />
      </Link>
      <div className="w-full max-w-4xl">{children}</div>
    </div>
  );
}
