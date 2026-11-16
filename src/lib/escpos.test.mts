import assert from "node:assert/strict";
import { COLUMNS, EscposBuilder, encodeText, wrapText } from "./escpos.ts";

// Acentos en la página 858 y sin acentos
assert.deepEqual(encodeText("Ñandú ¿sí?", true), [0xa5, 0x61, 0x6e, 0x64, 0xa3, 0x20, 0xa8, 0x73, 0xa1, 0x3f]);
assert.deepEqual(encodeText("Ñandú ¿sí?", false), [..."Nandu ?si?"].map((c) => c.charCodeAt(0)));
// Espacios duros y rayas raras
assert.deepEqual(encodeText("$ 5", true), [0x24, 0x20, 0x35]);
assert.deepEqual(encodeText("a—b", true), [0x61, 0x2d, 0x62]);
// Lo que no existe sale como ?
assert.deepEqual(encodeText("漢", true), [0x3f]);

// Renglones
assert.deepEqual(wrapText("hola mundo cruel", 10), ["hola mundo", "cruel"]);
assert.deepEqual(wrapText("abcdefghijkl", 5), ["abcde", "fghij", "kl"]);

// Fila: izquierda y derecha en 32 columnas
const b = new EscposBuilder({ columns: COLUMNS[58], accents: true });
b.row("TOTAL", "$ 1.500");
const text = String.fromCharCode(...b.build()).replace(/\n$/, "");
assert.equal(text.length, 32);
assert.ok(text.startsWith("TOTAL") && text.endsWith("$ 1.500"));

// Inicio, corte y cajón
const init = new EscposBuilder({ columns: 48, accents: true }).init().build();
assert.deepEqual([...init], [0x1b, 0x40, 0x1b, 0x74, 19]);
const cut = [...new EscposBuilder({ columns: 48, accents: false }).cut().build()];
assert.deepEqual(cut.slice(-4), [0x1d, 0x56, 66, 0]);
assert.deepEqual([...new EscposBuilder({ columns: 48, accents: false }).openDrawer().build()], [0x1b, 0x70, 0, 25, 250]);

// Letra grande: entra la mitad
const big = new EscposBuilder({ columns: 32, accents: false }).setSize("big").row("TOTAL", "$ 1");
const bigText = String.fromCharCode(...big.build()).replace(/\n$/, "").slice(3);
assert.equal(bigText.length, 16);

console.log("escpos ok");
