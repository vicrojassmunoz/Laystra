import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HELIUM = "C:\\Users\\victo\\AppData\\Local\\imput\\Helium\\Application\\chrome.exe";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "helium-motion-"));
const browser = await chromium.launchPersistentContext(profile, {
  executablePath: HELIUM,
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  args: ["--no-first-run", "--no-default-browser-check"],
});
const page = browser.pages()[0] ?? (await browser.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 200)}`);
});

await page.goto("http://localhost:8081", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByText("Hoy", { exact: true }).first().click();
await page.waitForTimeout(1200);

// 1) Escala al pulsar: busca la caja animada del botón "Empezar sesión"
const label = page.getByText("Empezar sesión", { exact: true }).first();
const box = await label.boundingBox();
const readTransform = () =>
  label.evaluate((el) => {
    let n = el;
    while (n && n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.transitionProperty && cs.transitionProperty.includes("transform")) {
        return { transform: cs.transform, opacity: cs.opacity, duration: cs.transitionDuration, easing: cs.transitionTimingFunction };
      }
      n = n.parentElement;
    }
    return null;
  });

console.log("reposo  :", JSON.stringify(await readTransform()));
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(260);
console.log("pulsado :", JSON.stringify(await readTransform()));
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 300); // sacar el dedo: cancela la pulsación
await page.mouse.up();
await page.waitForTimeout(260);
console.log("soltado :", JSON.stringify(await readTransform()));

// 2) La barra de progreso de agua lleva transición de ancho
const bar = await page.evaluate(() => {
  const el = document.querySelector('[role="progressbar"]');
  if (!el || !el.firstElementChild) return null;
  const cs = getComputedStyle(el.firstElementChild);
  return { property: cs.transitionProperty, duration: cs.transitionDuration };
});
console.log("barra   :", JSON.stringify(bar));

// 3) Recorrido por pantallas sin errores
for (const name of ["Home"]) {
  /* ya estamos en Hoy; volver */
}
await page.mouse.click(26, 32);
await page.waitForTimeout(800);
for (const screen of ["Agua", "Historial", "Rutinas", "Progreso", "Análisis", "Semana", "Objetivos", "Perfil"]) {
  await page.getByText(screen, { exact: false }).first().click();
  await page.waitForTimeout(900);
  await page.mouse.click(26, 32);
  await page.waitForTimeout(700);
}
console.log("errores :", JSON.stringify(errors.slice(0, 6), null, 1));
await browser.close();
fs.rmSync(profile, { recursive: true, force: true });
