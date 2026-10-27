"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import "driver.js/dist/driver.css";
import { TOUR_STEPS, stepNumber, type TourStep } from "@/lib/tour-steps";
import { stopTour, useTourState, writeTour } from "@/lib/tour-state";

type Driver = import("driver.js").Driver;

/** Primer elemento visible que coincide (el menú existe dos veces: escritorio y celular). */
function findVisible(selector: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function stepIndexById(id: string | undefined) {
  return id ? TOUR_STEPS.findIndex((s) => s.id === id) : -1;
}

/**
 * Motor de la guía paso a paso: señala elementos reales de la pantalla con driver.js y
 * avanza cuando la persona hace lo pedido. Nunca la deja atrapada: siempre hay "Saltar
 * paso" y "Salir de la guía", y si algo no se encuentra muestra un cartel en el centro.
 */
export function TourController({ enabled }: { enabled: boolean }) {
  const tour = useTourState();
  const pathname = usePathname();
  const router = useRouter();
  const index = enabled && tour ? tour.index : null;

  useEffect(() => {
    if (index === null) return;
    const step: TourStep | undefined = TOUR_STEPS[index];
    if (!step) {
      stopTour();
      return;
    }

    let cancelled = false;
    let drv: Driver | null = null;
    const timers: number[] = [];
    const cleanups: Array<() => void> = [];

    const go = (to: number) => {
      if (cancelled) return;
      if (to >= TOUR_STEPS.length) stopTour();
      else writeTour(to);
    };
    const next = () => go(index + 1);
    const skip = () => {
      const to = stepIndexById(step.skipTo);
      go(to > index ? to : index + 1);
    };

    const wrongPath = step.path !== "*" && step.path !== pathname;
    const { n, total } = stepNumber(index);
    const heading = step.quiet ? step.title : `Paso ${n} de ${total} · ${step.title}`;

    const addExtras = (popover: { footer: HTMLElement; nextButton: HTMLButtonElement }) => {
      // "Siguiente" apagado hasta que el campo pedido tenga algo (si no, el formulario no deja guardar).
      const req = step.advance.type === "next" ? step.advance.requires : undefined;
      if (req) {
        const positive = step.advance.type === "next" && Boolean(step.advance.positive);
        const sync = () => {
          const f = document.querySelector<HTMLInputElement>(req);
          const v = f?.value.trim() ?? "";
          popover.nextButton.disabled = !f || v === "" || (positive && !(Number(v) > 0));
        };
        sync();
        const iv = window.setInterval(sync, 200);
        cleanups.push(() => window.clearInterval(iv));
      }
      const wrap = document.createElement("div");
      wrap.className = "pesito-tour-extras";
      const mk = (label: string, fn: () => void) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.addEventListener("click", fn);
        wrap.appendChild(b);
      };
      const prev = TOUR_STEPS[index - 1];
      if (prev && !prev.quiet) mk("Atrás", () => go(index - 1));
      if (step.advance.type !== "next") mk("Saltar paso", skip);
      mk("Salir de la guía", () => stopTour());
      popover.footer.insertAdjacentElement("afterend", wrap);
    };

    // Cartel en el centro, sin señalar nada (pantalla equivocada, menú oculto, objetivo ausente).
    const showCentered = (text: string, button: { label: string; onClick: () => void } | null) => {
      drv?.destroy();
      drv = null;
      void import("driver.js").then(({ driver }) => {
        if (cancelled) return;
        drv = driver({
          animate: false,
          overlayClickBehavior: "none",
          allowClose: false,
          allowKeyboardControl: false,
          popoverClass: "pesito-tour",
          stagePadding: 6,
          stageRadius: 10,
        });
        drv.highlight({
          popover: {
            title: heading,
            description: text,
            showButtons: button ? ["next"] : [],
            nextBtnText: button?.label,
            onNextClick: button?.onClick,
            onPopoverRender: addExtras,
          },
        });
      });
    };

    // Si la condición del paso ya se cumple al llegar (por ejemplo, volvió con «Atrás» y el carrito
    // ya tiene algo), no se avanza sola: se muestra «Siguiente».
    const alreadyDone = () => {
      const a = step.advance;
      if (a.type === "enabled") {
        const t = findVisible(a.selector) as HTMLButtonElement | null;
        return Boolean(t && !t.disabled);
      }
      return a.type === "appear" ? Boolean(findVisible(a.selector)) : false;
    };
    const startedDone = alreadyDone();

    const showTarget = (el: HTMLElement) => {
      drv?.destroy();
      drv = null;
      void import("driver.js").then(({ driver }) => {
        if (cancelled) return;
        const auto = step.advance.type !== "next" && !startedDone;
        drv = driver({
          animate: false,
          overlayClickBehavior: "none",
          allowClose: false,
          allowKeyboardControl: false,
          popoverClass: "pesito-tour",
          stagePadding: 6,
          stageRadius: 10,
        });
        drv.highlight({
          element: el,
          popover: {
            title: heading,
            description: step.text,
            side: step.side ?? "bottom",
            align: "center",
            showButtons: auto ? [] : ["next"],
            nextBtnText: step.advance.type === "next" ? step.advance.label ?? "Siguiente" : "Siguiente",
            onNextClick: next,
            onPopoverRender: addExtras,
          },
        });
        // driver deja el foco en el cartel: un Enter caería en «Atrás» o «Salir» en vez de llegar a la pantalla.
        if (document.activeElement instanceof HTMLElement && document.activeElement.closest(".driver-popover")) {
          document.activeElement.blur();
        }
      });
    };

    const advanceWatch = (el: HTMLElement) => {
      const a = step.advance;
      if (a.type === "click") {
        // Inmediato: si el click navega, el efecto se reinicia y un timer se perdería.
        const onClick = () => next();
        el.addEventListener("click", onClick, true);
        cleanups.push(() => el.removeEventListener("click", onClick, true));
      }
      const poll = window.setInterval(() => {
        if (cancelled) return;
        drv?.refresh();
        if (a.type === "click" && a.orAppear && findVisible(a.orAppear)) next();
        else if (a.type === "gone" && !document.body.contains(el)) next();
        else if (a.type === "enabled" && !startedDone) {
          const t = findVisible(a.selector) as HTMLButtonElement | null;
          if (t && !t.disabled) next();
        } else if (a.type === "appear" && !startedDone) {
          if (findVisible(a.selector)) next();
        }
      }, 300);
      cleanups.push(() => window.clearInterval(poll));
    };

    // Paso sin cartel: espera a que aparezca algo.
    if (step.quiet && step.advance.type === "appear") {
      const sel = step.advance.selector;
      const back = step.watchGone;
      let goneSince = 0;
      const poll = window.setInterval(() => {
        if (findVisible(sel)) return next();
        if (!back) return;
        // Cerró el cobro sin cobrar: se vuelve al paso de "Cobrar" en vez de quedar mudo.
        if (document.querySelector(back.selector)) goneSince = 0;
        else if (!goneSince) goneSince = Date.now();
        else if (Date.now() - goneSince > 1500) go(Math.max(0, stepIndexById(back.backTo)));
      }, 300);
      cleanups.push(() => window.clearInterval(poll));
    } else if (wrongPath && step.target) {
      showCentered(step.text, {
        label: "Ir ahí",
        onClick: () => router.push(step.goTo ?? step.path),
      });
    } else if (step.target) {
      const target = step.target;
      const deadline = Date.now() + (step.waitMs ?? 2500);
      const find = window.setInterval(() => {
        if (cancelled) return;
        const el = findVisible(target);
        if (el) {
          window.clearInterval(find);
          showTarget(el);
          advanceWatch(el);
        } else if (Date.now() > deadline) {
          window.clearInterval(find);
          if (step.ifMissing === "skip") skip();
          else if (step.ifMissing === "show") {
            showCentered(step.missingText ?? step.text, step.goTo
              ? { label: "Ir ahí", onClick: () => router.push(step.goTo as string) }
              : null);
          } else {
            // Menú escondido en el celular u otra razón: cartel con un atajo.
            showCentered(step.text, {
              label: step.goTo ? "Ir ahí" : "Siguiente",
              onClick: () => {
                if (step.goTo) {
                  router.push(step.goTo);
                  timers.push(window.setTimeout(next, 300));
                } else next();
              },
            });
          }
        }
      }, 150);
      cleanups.push(() => window.clearInterval(find));
    } else {
      // Sin elemento (el cierre): cartel en el centro con "Siguiente"/"Terminar".
      const label = step.advance.type === "next" ? step.advance.label ?? "Siguiente" : "Siguiente";
      showCentered(step.text, { label, onClick: next });
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      cleanups.forEach((fn) => fn());
      try {
        drv?.destroy();
      } catch {
        /* ya destruido */
      }
    };
  }, [index, pathname, router]);

  return null;
}
