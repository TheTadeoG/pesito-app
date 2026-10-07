// node --experimental-strip-types src/lib/login-gate.test.mts
import assert from "node:assert/strict";
import { captchaNextTime, loginGate, LOGIN_CAPTCHA_AFTER, LOGIN_HARD_LIMIT } from "./login-gate.ts";
let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log("ok  -", name); };
test("sin fallos o con pocos: entra normal, sin CAPTCHA", () => {
  for (let f = 0; f < LOGIN_CAPTCHA_AFTER; f++) assert.equal(loginGate(f, true), "ok");
});
test("desde el 3.º fallo seguido pide CAPTCHA (si hay claves)", () => {
  assert.equal(loginGate(3, true), "captcha");
  assert.equal(loginGate(29, true), "captcha");
});
test("sin claves de CAPTCHA nunca lo pide", () => {
  for (let f = 0; f < LOGIN_HARD_LIMIT; f++) assert.equal(loginGate(f, false), "ok");
});
test("con muchos fallos se corta esa conexión (con o sin CAPTCHA)", () => {
  assert.equal(loginGate(30, true), "blocked");
  assert.equal(loginGate(500, false), "blocked");
});
test("tras el 3.º fallo se muestra el CAPTCHA enseguida; antes no", () => {
  assert.equal(captchaNextTime(0, true), false);
  assert.equal(captchaNextTime(1, true), false);
  assert.equal(captchaNextTime(2, true), true);
  assert.equal(captchaNextTime(2, false), false);
});
console.log(`\n${n} pruebas pasaron`);
