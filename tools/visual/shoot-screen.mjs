import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// uso: node shoot3.mjs <outdir> <light|dark> <pantalla> [pasos...]
// pantallas: historial | rutinas | progreso | analisis
const HELIUM = "C:\\Users\\victo\\AppData\\Local\\imput\\Helium\\Application\\chrome.exe";
const [out, scheme = "light", screen = "historial"] = process.argv.slice(2);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "helium-shots-"));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launchPersistentContext(profile, {
  executablePath: HELIUM,
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: scheme,
  args: ["--no-first-run", "--no-default-browser-check"],
});
const page = browser.pages()[0] ?? (await browser.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

async function shot(name, height = 844) {
  await page.setViewportSize({ width: 390, height });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("saved", name);
}
async function click(text, nth = 0) {
  await page.getByText(text, { exact: true }).nth(nth).click();
  await page.waitForTimeout(900);
}

const NAMES = { historial: "Historial", rutinas: "Rutinas", progreso: "Progreso", analisis: "Análisis", semana: "Semana", objetivos: "Objetivos", picker: "Rutinas" };

try {
  await page.goto("http://localhost:8081", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await click(NAMES[screen]);
  await shot(`${screen}-1`, 1500);

  if (screen === "historial") {
    await click("Entreno libre");
    await shot("historial-2-abierto", 1800);
    await click("Editar");
    await shot("historial-3-editar", 2400);
  }
  if (screen === "progreso") {
    await click("Dominadas");
    await shot("progreso-2-detalle", 1700);
  }
  if (screen === "semana") {
    await click("Lunes");
    await shot("semana-2-hoja");
  }
  if (screen === "objetivos") {
    await click("Nuevo objetivo");
    await shot("objetivos-2-form", 1100);
  }
  if (screen === "picker") {
    await click("Pull Super series");
    await click("Editar");
    await page.getByLabel("Elegir ejercicio").first().click();
    await page.waitForTimeout(900);
    await shot("picker-1-lista", 1100);
    await page.getByText("Nuevo ejercicio", { exact: true }).first().click();
    await page.waitForTimeout(900);
    await shot("picker-2-nuevo", 1100);
    await page.getByText("Cancelar", { exact: true }).last().click();
    await page.waitForTimeout(700);
    await page.getByText("Editar", { exact: true }).last().click();
    await page.waitForTimeout(900);
    await shot("picker-3-editar", 1100);
  }
  if (screen === "rutinas") {
    await click("Pull Super series");
    await shot("rutinas-2-abierta", 1500);
    await click("Editar");
    await shot("rutinas-3-editar", 2400);
  }
} catch (e) {
  console.log("FAILED:", e.message);
  await page.screenshot({ path: path.join(out, "zz-failure.png") }).catch(() => {});
}
console.log("errors:", JSON.stringify(errors.slice(0, 5), null, 1));
await browser.close();
fs.rmSync(profile, { recursive: true, force: true });
