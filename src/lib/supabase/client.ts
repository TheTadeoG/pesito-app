import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: SESSION_COOKIE_OPTIONS }
  );
}
