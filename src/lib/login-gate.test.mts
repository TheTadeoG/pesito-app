// node --experimental-strip-types src/lib/login-gate.test.mts
import assert from "node:assert/strict";
import { ACCOUNT_CAPTCHA_AFTER, LOGIN_CAPTCHA_AFTER, LOGIN_HARD_LIMIT, captchaNextTime, loginGate } from "./login-gate.ts";
let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log("ok  -", name); };
test("pocos fallos (IP y cuenta): entra normal, sin CAPTCHA", () => {
  for (let f = 0; f < LOGIN_CAPTCHA_AFTER; f++) assert.equal(loginGate(f, 0, true), "ok");
  assert.equal(loginGate(0, ACCOUNT_CAPTCHA_AFTER - 1, true), "ok");
});
test("desde el 3.º fallo seguido de la IP pide CAPTCHA (si hay claves)", () => {
  assert.equal(loginGate(3, 0, true), "captcha");
  assert.equal(loginGate(29, 0, true), "captcha");
});
test("una cuenta con muchos fallos de varias IP pide CAPTCHA aunque esta IP esté limpia", () => {
  assert.equal(loginGate(0, ACCOUNT_CAPTCHA_AFTER, true), "captcha");
  assert.equal(loginGate(1, 500, true), "captcha");
});
test("una cuenta NUNCA se bloquea por sus fallos: sólo la IP se corta", () => {
  for (const acct of [0, 10, 100, 100000]) assert.notEqual(loginGate(0, acct, true), "blocked");
  for (const acct of [0, 10, 100000]) assert.notEqual(loginGate(0, acct, false), "blocked");
});
test("sin claves de CAPTCHA nunca lo pide", () => {
  for (let f = 0; f < LOGIN_HARD_LIMIT; f++) assert.equal(loginGate(f, 1000, false), "ok");
});
test("con muchos fallos de la IP se corta esa conexión", () => {
  assert.equal(loginGate(30, 0, true), "blocked");
  assert.equal(loginGate(500, 0, false), "blocked");
});
test("tras el fallo que completa el umbral se muestra el CAPTCHA enseguida", () => {
  assert.equal(captchaNextTime(0, 0, true), false);
  assert.equal(captchaNextTime(2, 0, true), true);
  assert.equal(captchaNextTime(0, 9, true), true);
  assert.equal(captchaNextTime(0, 8, true), false);
  assert.equal(captchaNextTime(2, 9, false), false);
});
console.log(`\n${n} pruebas pasaron`);
