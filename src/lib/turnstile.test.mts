// node --experimental-strip-types src/lib/turnstile.test.mts
import assert from "node:assert/strict";
import { captchaConfigured, verifyCaptcha } from "./turnstile.ts";
let n = 0;
const test = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log("ok  -", name); };
const realFetch = globalThis.fetch;
const setFetch = (impl: typeof fetch) => { globalThis.fetch = impl; };
delete process.env.TURNSTILE_SECRET_KEY; delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
await test("sin claves: no hay CAPTCHA configurado y no se puede verificar", async () => {
  assert.equal(captchaConfigured(), false);
  assert.equal(await verifyCaptcha("tok", "1.2.3.4"), "unavailable");
});
process.env.TURNSTILE_SECRET_KEY = "secreta"; process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "publica";
await test("con las dos claves está configurado", () => assert.equal(captchaConfigured(), true));
await test("sin token => failed (sin llamar a Cloudflare)", async () => {
  let called = false; setFetch((async () => { called = true; return new Response("{}"); }) as typeof fetch);
  assert.equal(await verifyCaptcha("", null), "failed"); assert.equal(called, false);
});
await test("Cloudflare dice success:true => ok, y manda el secreto, el token y la IP", async () => {
  let sent = "";
  setFetch((async (_url: string, init?: RequestInit) => { sent = String(init?.body); return new Response(JSON.stringify({ success: true })); }) as typeof fetch);
  assert.equal(await verifyCaptcha("tok123", "9.9.9.9"), "ok");
  const params = new URLSearchParams(sent);
  assert.equal(params.get("secret"), "secreta"); assert.equal(params.get("response"), "tok123"); assert.equal(params.get("remoteip"), "9.9.9.9");
});
await test("success:false => failed", async () => {
  setFetch((async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }))) as typeof fetch);
  assert.equal(await verifyCaptcha("malo", null), "failed");
});
await test("Cloudflare caído o error HTTP => unavailable (se deja pasar)", async () => {
  setFetch((async () => { throw new Error("red"); }) as typeof fetch);
  assert.equal(await verifyCaptcha("tok", null), "unavailable");
  setFetch((async () => new Response("x", { status: 500 })) as typeof fetch);
  assert.equal(await verifyCaptcha("tok", null), "unavailable");
});
globalThis.fetch = realFetch;
console.log(`\n${n} pruebas pasaron`);
