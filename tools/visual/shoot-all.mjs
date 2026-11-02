import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HELIUM = "C:\\Users\\victo\\AppData\\Local\\imput\\Helium\\Application\\chrome.exe";
const out = process.argv[2];
const scheme = process.argv[3] || "light";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "helium-shots-"));

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

async function fresh() {
  await page.goto("http://localhost:8081", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}
async function shot(name) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("saved", name);
}
async function click(text) {
  await page.getByText(text, { exact: true }).first().click();
  await page.waitForTimeout(1200);
}

try {
  await fresh();
  await shot("01-home");

  await click("Hoy");
  await shot("02-hoy");

  await click("Empezar sesión");
  await shot("03-sesion");

  await fresh();
  await page.getByText(/^Agua/).first().click();
  await page.waitForTimeout(1500);
  await shot("04-agua");

  await fresh();
  await click("Historial");
  await shot("05-historial");

  await fresh();
  await click("Rutinas");
  await shot("06-rutinas");

  await fresh();
  await click("Progreso");
  await shot("07-progreso");

  for (const [i, name] of [["08","Perfil"],["09","Objetivos"],["10","Análisis"],["11","Semana"]]) {
    await fresh();
    await click(name);
    await shot(`${i}-${name.toLowerCase().replace("á","a")}`);
  }
} catch (e) {
  console.log("FAILED:", e.message);
  await page.screenshot({ path: path.join(out, "zz-failure.png") }).catch(() => {});
}
console.log("errors:", JSON.stringify(errors.slice(0, 8), null, 1));
await browser.close();
fs.rmSync(profile, { recursive: true, force: true });
